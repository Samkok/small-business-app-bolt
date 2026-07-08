import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
} from 'react';
import { Session, User } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter, useSegments } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as Linking from 'expo-linking';

import { supabase } from '../config/supabase';
import { clearAuthStorage, verifySessionCleared, updateLastActivityTimestamp } from '../lib/authStorage';
import { clearRememberMeCredentials } from '../lib/secureStorage';
import { businessAccessHistoryService, BusinessAccessHistory } from '../utils/businessAccessHistory';
import { notificationCleanupService } from '../utils/notificationCleanup';
import { dataCleanupRegistry } from '../utils/dataCleanupRegistry';
import { isNetworkError } from '../lib/network';
import { dataCache } from '../lib/dataCache';
import { referralService } from '../services/referralService';

import { AuthContextType, Business, UserProfile } from './authTypes';
import {
  useBusinessManager,
  fetchUserBusinesses,
  businessArraysEqual,
} from '../hooks/useBusinessManager';
import { useSessionManager, isInvalidTokenError } from '../hooks/useSessionManager';
import { useRealtimeBusinessRoles } from '../hooks/useRealtimeBusinessRoles';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const SESSION_REFRESH_GRACE_PERIOD = 300 * 1000;
const SECURITY_CHECK_GRACE_PERIOD = 5 * 1000;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const mounted = useRef(true);
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [userBusinesses, setUserBusinesses] = useState<Business[]>([]);
  const [currentBusiness, setCurrentBusiness] = useState<Business | null>(null);
  const [userBusinessRoles, setUserBusinessRoles] = useState<Map<string, 'admin' | 'staff'>>(
    new Map(),
  );
  const [loading, setLoading] = useState(true);
  const [dataLoadingState, setDataLoadingState] = useState<'idle' | 'loading' | 'loaded'>('idle');
  const [signedOutDueToInactivity, setSignedOutDueToInactivity] = useState(false);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
  const [businessAccessHistory, setBusinessAccessHistory] = useState<BusinessAccessHistory>({});
  const [isExplicitSignOut, setIsExplicitSignOut] = useState(false);

  // Refs to expose stable snapshots to callbacks without re-triggering effects
  const userRef = useRef<User | null>(null);
  const userBusinessesRef = useRef<Business[]>([]);
  const currentBusinessRef = useRef<Business | null>(null);
  const businessAccessHistoryRef = useRef<BusinessAccessHistory>({});
  const isExplicitSignOutRef = useRef(false);
  const signedOutDueToInactivityRef = useRef(false);
  const lastBackgroundTimeRef = useRef(0);
  const lastSecurityCheckTimeRef = useRef(0);
  const isFirstLaunchRef = useRef(true);
  const isLoadingAuthDataRef = useRef(false);

  const router = useRouter();
  const segments = useSegments();

  const initialDataLoaded = dataLoadingState === 'loaded';

  // Keep refs in sync
  useEffect(() => { userRef.current = user; }, [user]);
  useEffect(() => { userBusinessesRef.current = userBusinesses; }, [userBusinesses]);
  useEffect(() => { currentBusinessRef.current = currentBusiness; }, [currentBusiness]);
  useEffect(() => { businessAccessHistoryRef.current = businessAccessHistory; }, [businessAccessHistory]);
  useEffect(() => { isExplicitSignOutRef.current = isExplicitSignOut; }, [isExplicitSignOut]);
  useEffect(() => { signedOutDueToInactivityRef.current = signedOutDueToInactivity; }, [signedOutDueToInactivity]);

  // ── Business manager ────────────────────────────────────────────────────────
  const {
    switchBusiness,
    determineCurrentBusiness,
    shouldAutoRedirectOnAssignment,
    cleanupRemovedBusiness,
  } = useBusinessManager({
    userId: user?.id,
    userBusinessesRef,
    businessAccessHistoryRef,
    setCurrentBusiness,
    setBusinessAccessHistory,
  });

  // ── Invalid token handler ────────────────────────────────────────────────────
  const handleInvalidToken = useCallback(async () => {
    await clearAuthStorage();
    if (mounted.current) {
      setSession(null);
      setUser(null);
      setUserProfile(null);
      setUserBusinesses([]);
      setCurrentBusiness(null);
      setLoading(false);
      setDataLoadingState('loaded');
    }
    await supabase.auth.signOut({ scope: 'local' });
  }, []);

  // ── Session manager ─────────────────────────────────────────────────────────
  const {
    refreshSessionIfNeeded,
    checkSessionActivity,
    markRecentlyAuthenticated,
  } = useSessionManager({
    setSession,
    setUser,
    userRef,
    onInvalidToken: handleInvalidToken,
    onInactivitySignOut: () => {
      setSignedOutDueToInactivity(true);
      signedOutDueToInactivityRef.current = true;
    },
  });

  // ── Business access security check ──────────────────────────────────────────
  const checkBusinessAccessSecurity = useCallback(async () => {
    if (!userRef.current?.id) return;
    const { data: roles, error } = await supabase
      .from('user_business_roles')
      .select('business_id')
      .eq('user_id', userRef.current.id);

    if (error) return;

    const current = new Set((roles || []).map((r: any) => r.business_id));
    const previous = new Set(userBusinessesRef.current.map(b => b.id));
    const removed = Array.from(previous).filter(id => !current.has(id));

    if (removed.length > 0) await refreshUserBusinesses();
    lastSecurityCheckTimeRef.current = Date.now();
  }, []);

  // ── Realtime business roles ──────────────────────────────────────────────────
  useRealtimeBusinessRoles({
    userId: user?.id,
    session,
    userBusinessesRef,
    currentBusinessRef,
    businessAccessHistoryRef,
    segments: segments as string[],
    setUserBusinesses,
    setUserBusinessRoles,
    switchBusiness,
    setCurrentBusiness,
    shouldAutoRedirectOnAssignment,
    onInvalidToken: handleInvalidToken,
    refreshSessionIfNeeded,
  });

  // ── Auth data caching helpers ────────────────────────────────────────────────
  const cacheAuthData = useCallback(async (userId: string, profile: UserProfile, businesses: Business[], business: Business | null) => {
    try {
      await AsyncStorage.setItem(`cached_profile_${userId}`, JSON.stringify(profile));
      await AsyncStorage.setItem(`cached_businesses_${userId}`, JSON.stringify(businesses));
      if (business) {
        await AsyncStorage.setItem(`cached_current_business_${userId}`, JSON.stringify(business));
      }
    } catch (e) {
      console.log('[Auth] Failed to cache auth data:', e);
    }
  }, []);

  const restoreCachedAuthData = useCallback(async (userId: string): Promise<boolean> => {
    try {
      const [profileStr, businessesStr, currentStr] = await Promise.all([
        AsyncStorage.getItem(`cached_profile_${userId}`),
        AsyncStorage.getItem(`cached_businesses_${userId}`),
        AsyncStorage.getItem(`cached_current_business_${userId}`),
      ]);
      if (profileStr && businessesStr) {
        const profile = JSON.parse(profileStr) as UserProfile;
        const businesses = JSON.parse(businessesStr) as Business[];
        const business = currentStr ? JSON.parse(currentStr) as Business : null;
        if (mounted.current) {
          setUserProfile(profile);
          setUserBusinesses(businesses);
          setCurrentBusiness(business);
          setLoading(false);
          setDataLoadingState('loaded');
        }
        console.log('[Auth] Restored auth data from cache');
        return true;
      }
    } catch (e) {
      console.log('[Auth] Failed to restore cached auth data:', e);
    }
    return false;
  }, []);

  // ── Load auth data ───────────────────────────────────────────────────────────
  const loadAuthData = async (userId: string) => {
    if (isLoadingAuthDataRef.current) return;
    isLoadingAuthDataRef.current = true;
    setDataLoadingState('loading');

    const MAX_RETRIES = 3;
    const INITIAL_DELAY_MS = 500;
    let lastError: any = null;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const { data, error } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle();

        if (error) {
          if (isInvalidTokenError(error)) {
            await handleInvalidToken();
            if (mounted.current) { setLoading(false); setDataLoadingState('loaded'); }
            isLoadingAuthDataRef.current = false;
            return;
          }
          lastError = error;
          if (attempt < MAX_RETRIES - 1) {
            await new Promise(r => setTimeout(r, INITIAL_DELAY_MS * 2 ** attempt));
            continue;
          }
          throw error;
        }

        if (data) {
          if (mounted.current) setUserProfile(data);

          const result = await fetchUserBusinesses(userId);
          if (!result) throw new Error('Failed to fetch businesses');

          const { businesses, rolesMap } = result;
          if (mounted.current) setUserBusinessRoles(rolesMap);

          const determinedBusiness = await determineCurrentBusiness(
            userId,
            businesses,
            currentBusiness,
          );

          if (mounted.current) {
            if (!businessArraysEqual(businesses, userBusinesses)) {
              setUserBusinesses(businesses);
            }
            if (!currentBusiness || !determinedBusiness || currentBusiness.id !== determinedBusiness.id) {
              setCurrentBusiness(determinedBusiness);
              if (determinedBusiness) {
                businessAccessHistoryService.updateAccess(determinedBusiness.id).catch(console.error);
              }
            }
            setLoading(false);
            setDataLoadingState('loaded');
          }
          // Cache successful auth data for offline access
          cacheAuthData(userId, data, businesses, determinedBusiness ?? null).catch(() => {});
          isLoadingAuthDataRef.current = false;
          return;
        } else {
          // Auto-create missing profile
          try {
            const { data: authUser, error: authError } = await supabase.auth.getUser();
            if (authError || !authUser.user) throw authError ?? new Error('No auth user');

            await supabase.from('user_profiles').upsert(
              {
                user_id: userId,
                email: authUser.user.email || '',
                full_name: authUser.user.user_metadata?.full_name || authUser.user.email?.split('@')[0] || 'User',
              },
              { onConflict: 'user_id' }
            );

            isLoadingAuthDataRef.current = false;
            return await loadAuthData(userId);
          } catch {
            if (mounted.current) {
              setUserProfile(null);
              setUserBusinesses([]);
              setCurrentBusiness(null);
              setLoading(false);
              setDataLoadingState('loaded');
            }
            isLoadingAuthDataRef.current = false;
            return;
          }
        }
      } catch (retryError) {
        if (isInvalidTokenError(retryError)) {
          await handleInvalidToken();
          if (mounted.current) { setLoading(false); setDataLoadingState('loaded'); }
          isLoadingAuthDataRef.current = false;
          return;
        }
        lastError = retryError;
        if (attempt === MAX_RETRIES - 1) break;
        await new Promise(r => setTimeout(r, INITIAL_DELAY_MS * 2 ** attempt));
      }
    }

    if (lastError) {
      console.error('All auth data loading attempts failed:', lastError);
      // Try to restore cached data so the app remains functional offline
      const restored = await restoreCachedAuthData(userId);
      if (!restored && mounted.current) {
        setUserProfile(null);
        setUserBusinesses([]);
        setCurrentBusiness(null);
        setLoading(false);
        setDataLoadingState('loaded');
      }
    }
    isLoadingAuthDataRef.current = false;
  };

  // ── Initial session + auth state change listener ─────────────────────────────
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    async function init() {
      const history = await businessAccessHistoryService.getHistory();
      if (mounted.current) {
        setBusinessAccessHistory(history);
        businessAccessHistoryRef.current = history;
      }
    }
    init();
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session }, error }) => {
      if (error) {
        // Don't sign out on network errors -- trust any locally cached session
        if (isNetworkError(error)) {
          console.log('[Auth] Network error on getSession, restoring from cache');
          // Try to get userId from any previously stored session
          const keys = await AsyncStorage.getAllKeys();
          const profileKey = keys.find(k => k.startsWith('cached_profile_'));
          if (profileKey) {
            const userId = profileKey.replace('cached_profile_', '');
            await restoreCachedAuthData(userId);
          } else if (mounted.current) {
            setLoading(false);
            setDataLoadingState('loaded');
          }
          return;
        }
        if (isInvalidTokenError(error)) {
          await handleInvalidToken();
          if (mounted.current) { setLoading(false); setDataLoadingState('loaded'); }
          return;
        }
      }

      if (session) checkSessionActivity(session);
      if (mounted.current) { setSession(session); setUser(session?.user ?? null); }

      if (session?.user) {
        loadAuthData(session.user.id);
      } else {
        if (mounted.current) { setLoading(false); setDataLoadingState('loaded'); }
      }
    }).catch(async error => {
      if (isNetworkError(error)) {
        console.log('[Auth] Network error on getSession catch, restoring from cache');
        const keys = await AsyncStorage.getAllKeys();
        const profileKey = keys.find(k => k.startsWith('cached_profile_'));
        if (profileKey) {
          const userId = profileKey.replace('cached_profile_', '');
          await restoreCachedAuthData(userId);
        } else if (mounted.current) {
          setLoading(false);
          setDataLoadingState('loaded');
        }
      } else if (isInvalidTokenError(error)) {
        await handleInvalidToken();
        if (mounted.current) { setLoading(false); setDataLoadingState('loaded'); }
      } else {
        if (mounted.current) { setLoading(false); setDataLoadingState('loaded'); }
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      (async () => {
        if (event === 'PASSWORD_RECOVERY') {
          if (mounted.current) {
            setIsPasswordRecovery(true);
            setSession(session);
            setUser(session?.user ?? null);
          }
          return;
        }

        if (event === 'SIGNED_OUT') {
          if (!isExplicitSignOutRef.current) {
            setSignedOutDueToInactivity(true);
            signedOutDueToInactivityRef.current = true;
          } else {
            setSignedOutDueToInactivity(false);
            signedOutDueToInactivityRef.current = false;
          }
          if (mounted.current) {
            setSession(null);
            setUser(null);
            setUserProfile(null);
            setUserBusinesses([]);
            setCurrentBusiness(null);
            setLoading(false);
            setDataLoadingState('loaded');
          }
          setIsExplicitSignOut(false);
          isExplicitSignOutRef.current = false;
          return;
        }

        if (event === 'SIGNED_IN') {
          setSignedOutDueToInactivity(false);
          signedOutDueToInactivityRef.current = false;
          markRecentlyAuthenticated();
          try {
            await AsyncStorage.removeItem('lastActivityTimestamp');
            await AsyncStorage.setItem('lastActivityTimestamp', Date.now().toString());
          } catch {}

          // Auto-claim pending referral code on sign-in
          (async () => {
            try {
              const pendingCode = await referralService.getPendingReferralCode();
              if (pendingCode) {
                await referralService.claimReferral(pendingCode);
              }
            } catch {}
          })();
        }

        if (isExplicitSignOutRef.current) {
          setIsExplicitSignOut(false);
          isExplicitSignOutRef.current = false;
        }

        if (mounted.current) { setSession(session); setUser(session?.user ?? null); }

        if (session?.user) {
          loadAuthData(session.user.id);
        } else {
          if (mounted.current) {
            setUserProfile(null);
            setUserBusinesses([]);
            setCurrentBusiness(null);
            setLoading(false);
            setDataLoadingState('loaded');
          }
        }
      })();
    });

    return () => subscription.unsubscribe();
  }, []);

  // ── Deep link handling for mobile password recovery ─────────────────────────
  useEffect(() => {
    if (Platform.OS === 'web') return;

    const handleDeepLink = async (url: string) => {
      if (!url) return;

      // Handle referral deep links: businessmanager://refer/{code} or https://bizmanage.app/refer/{code}
      const referralMatch = url.match(/\/refer\/([A-Za-z0-9]+)/);
      if (referralMatch) {
        const code = referralMatch[1].toUpperCase();
        await referralService.storePendingReferralCode(code);
        await referralService.recordClick(code);
        return;
      }

      // Handle PKCE flow: ?code=AUTH_CODE
      try {
        const urlObj = new URL(url);
        const code = urlObj.searchParams.get('code');
        if (code) {
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          if (!error && data.session) {
            if (mounted.current) {
              setIsPasswordRecovery(true);
              setSession(data.session);
              setUser(data.session.user);
            }
          }
          return;
        }
      } catch (_) {
        // URL parsing failed, try hash approach
      }

      // Handle implicit flow: #access_token=...&refresh_token=...&type=recovery
      const hashIndex = url.indexOf('#');
      if (hashIndex === -1) return;

      const hash = url.substring(hashIndex + 1);
      const params = new URLSearchParams(hash);
      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');
      const type = params.get('type');

      if (accessToken && refreshToken && type === 'recovery') {
        const { data, error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (!error && data.session) {
          if (mounted.current) {
            setIsPasswordRecovery(true);
            setSession(data.session);
            setUser(data.session.user);
          }
        }
      }
    };

    Linking.getInitialURL().then((url) => {
      if (url) handleDeepLink(url);
    });

    const sub = Linking.addEventListener('url', (event) => {
      handleDeepLink(event.url);
    });

    return () => sub.remove();
  }, []);

  // ── Safety timeout ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!loading) return;
    const t = setTimeout(() => {
      if (mounted.current) setLoading(false);
    }, 15000);
    return () => clearTimeout(t);
  }, [loading]);

  // ── App state (foreground/background) ────────────────────────────────────────
  useEffect(() => {
    const sub = AppState.addEventListener('change', async nextAppState => {
      const previousState = (AppState as any).currentState;

      if (nextAppState === 'active' && previousState !== 'active') {
        const now = Date.now();
        const backgroundDuration =
          lastBackgroundTimeRef.current > 0 ? now - lastBackgroundTimeRef.current : 0;
        const timeSinceSecurityCheck = now - lastSecurityCheckTimeRef.current;

        if (isFirstLaunchRef.current) {
          isFirstLaunchRef.current = false;
          if (session) updateLastActivityTimestamp();
          return;
        }

        if (backgroundDuration > 0 && timeSinceSecurityCheck > SECURITY_CHECK_GRACE_PERIOD) {
          await checkBusinessAccessSecurity();
        }

        if (backgroundDuration > SESSION_REFRESH_GRACE_PERIOD) {
          if (session) await refreshSessionIfNeeded();
          if (session) checkSessionActivity(session);
        }

        if (session) updateLastActivityTimestamp();
      } else if (nextAppState === 'background' || nextAppState === 'inactive') {
        lastBackgroundTimeRef.current = Date.now();
      }
    });
    return () => sub.remove();
  }, [session, checkBusinessAccessSecurity]);

  // ── Auth actions ─────────────────────────────────────────────────────────────
  const signIn = useCallback(async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error && isNetworkError(error)) return { error: { ...error, isNetworkError: true } };
      return { error };
    } catch (err: any) {
      if (isNetworkError(err)) return { error: { message: 'Network request failed. Please check your connection.', isNetworkError: true } };
      return { error: err };
    }
  }, []);

  const signUp = useCallback(async (email: string, password: string, fullName: string) => {
    try {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) {
        if (isNetworkError(error)) return { error: { ...error, isNetworkError: true } };
        return { error };
      }
      if (data.user) {
        // Upsert profile: the DB trigger already creates a row on auth.users INSERT,
        // but we update full_name here since the trigger only has access to metadata.
        const { error: profileError } = await supabase
          .from('user_profiles')
          .upsert(
            { user_id: data.user.id, email, full_name: fullName },
            { onConflict: 'user_id' }
          );
        if (profileError) return { error: profileError };
      }
      return { error: null };
    } catch (err: any) {
      if (isNetworkError(err)) return { error: { message: 'Network request failed. Please check your connection.', isNetworkError: true } };
      return { error: err };
    }
  }, []);

  const signOut = useCallback(async () => {
    setSignedOutDueToInactivity(false);
    signedOutDueToInactivityRef.current = false;
    setIsExplicitSignOut(true);
    isExplicitSignOutRef.current = true;

    await clearAuthStorage();

    try {
      await clearRememberMeCredentials();
      await AsyncStorage.removeItem('lastActivityTimestamp');
      if (user?.id) await AsyncStorage.removeItem(`currentBusiness_${user.id}`);
    } catch {}

    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch {}

    await clearAuthStorage();

    if (mounted.current) {
      setSession(null);
      setUser(null);
      setUserProfile(null);
      setUserBusinesses([]);
      setCurrentBusiness(null);
      setDataLoadingState('idle');
      setLoading(false);
    }

    const isCleared = await verifySessionCleared();
    if (!isCleared) await clearAuthStorage();
  }, [user]);

  const refreshUserBusinesses = useCallback(async (): Promise<Business[]> => {
    if (!user?.id) return [];
    try {
      const result = await fetchUserBusinesses(user.id);
      if (!result) return [];

      const { businesses, rolesMap } = result;

      if (mounted.current) {
        const removedIds = userBusinesses
          .filter(old => !businesses.some(n => n.id === old.id))
          .map(b => b.id);

        if (!businessArraysEqual(businesses, userBusinesses)) {
          setUserBusinesses(businesses);
          removedIds.forEach(id => {
            notificationCleanupService.cleanup(id);
            dataCleanupRegistry.cleanupForRemovedBusiness(id);
          });
        }

        setUserBusinessRoles(rolesMap);

        if (currentBusiness && !businesses.some(b => b.id === currentBusiness.id)) {
          setCurrentBusiness(null);
        }
      }
      return businesses;
    } catch {
      return [];
    }
  }, [user?.id, userBusinesses, currentBusiness]);

  const createBusiness = useCallback(async (businessName: string) => {
    if (!user) return { error: new Error('No authenticated user') };
    try {
      const { data: businessId, error } = await supabase.rpc('create_business', {
        business_name_param: businessName,
        owner_user_id_param: user.id,
      });
      if (error) return { error };

      const { data: business, error: fetchError } = await supabase
        .from('businesses')
        .select('*')
        .eq('id', businessId)
        .single();
      if (fetchError) return { error: fetchError };

      setUserBusinesses(prev => [...prev, business]);
      if (userBusinesses.length === 0) {
        setCurrentBusiness(business);
        await AsyncStorage.setItem(`currentBusiness_${user.id}`, business.id);
      }
      return { error: null, business };
    } catch (error) {
      return { error };
    }
  }, [user, userBusinesses.length]);

  const updateUserProfile = useCallback(async (updates: Partial<UserProfile>) => {
    if (!user) return { error: new Error('No user') };
    const { error } = await supabase
      .from('user_profiles')
      .update(updates)
      .eq('user_id', user.id);
    if (!error && userProfile) setUserProfile({ ...userProfile, ...updates });
    return { error };
  }, [user, userProfile]);

  const updateBusiness = useCallback(async (businessId: string, updates: Partial<Business>) => {
    if (!user) return { error: new Error('No user') };

    const { data: hasAccess, error: accessError } = await supabase.rpc(
      'user_has_business_access',
      { user_uid: user.id, business_id_param: businessId },
    );
    if (accessError || !hasAccess) {
      return { error: new Error('You do not have permission to update this business') };
    }

    const { error } = await supabase
      .from('businesses')
      .update(updates)
      .eq('id', businessId);

    if (!error) {
      setUserBusinesses(prev => prev.map(b => (b.id === businessId ? { ...b, ...updates } : b)));
      if (currentBusiness?.id === businessId) {
        setCurrentBusiness({ ...currentBusiness, ...updates });
      }
    }
    return { error };
  }, [user, currentBusiness]);

  const resetPassword = useCallback(async (email: string) => {
    const appUrl = process.env.EXPO_PUBLIC_APP_URL || 'http://localhost:8081';
    const appScheme = process.env.EXPO_PUBLIC_APP_SCHEME || 'businessmanager';

    let redirectTo: string;
    if (Platform.OS === 'web') {
      redirectTo = typeof window !== 'undefined' && window.location?.origin
        ? `${window.location.origin}/reset-password`
        : `${appUrl}/reset-password`;
    } else {
      redirectTo = `${appScheme}://reset-password`;
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    return { error };
  }, []);

  const updatePassword = useCallback(async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password });
    return { error };
  }, []);

  const getUserRole = useCallback(
    (businessId: string): 'admin' | 'staff' | null =>
      userBusinessRoles.get(businessId) || null,
    [userBusinessRoles],
  );

  const hasBusinessAccess = useCallback(
    (businessId: string): boolean => userBusinessRoles.has(businessId),
    [userBusinessRoles],
  );

  const currentUserRole = useMemo(() => {
    if (!currentBusiness) return null;
    return getUserRole(currentBusiness.id);
  }, [currentBusiness, getUserRole]);

  const isAdmin = useMemo(() => currentUserRole === 'admin', [currentUserRole]);
  const isStaff = useMemo(() => currentUserRole === 'staff', [currentUserRole]);

  const resetInactivitySignOutFlag = () => setSignedOutDueToInactivity(false);
  const clearPasswordRecovery = useCallback(() => setIsPasswordRecovery(false), []);

  const value = useMemo<AuthContextType>(
    () => ({
      session,
      user,
      userProfile,
      userBusinesses,
      currentBusiness,
      currentUserRole,
      isAdmin,
      isStaff,
      loading,
      initialDataLoaded,
      signIn,
      signUp,
      signOut,
      updateUserProfile,
      updateBusiness,
      switchBusiness,
      createBusiness,
      getUserRole,
      hasBusinessAccess,
      resetPassword,
      updatePassword,
      refreshUserBusinesses,
      signedOutDueToInactivity,
      resetInactivitySignOutFlag,
      isPasswordRecovery,
      clearPasswordRecovery,
    }),
    [
      session,
      user,
      userProfile,
      userBusinesses,
      currentBusiness,
      currentUserRole,
      isAdmin,
      isStaff,
      loading,
      dataLoadingState,
      signIn,
      signUp,
      signOut,
      updateUserProfile,
      updateBusiness,
      switchBusiness,
      createBusiness,
      getUserRole,
      hasBusinessAccess,
      resetPassword,
      updatePassword,
      refreshUserBusinesses,
      signedOutDueToInactivity,
      isPasswordRecovery,
      clearPasswordRecovery,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
