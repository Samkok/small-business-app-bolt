import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { useRef } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../config/supabase';
import { Database } from '../types/database';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { AppState, Platform } from 'react-native';
import { clearRememberMeCredentials } from '../lib/secureStorage';
import { notificationCleanupService } from '../utils/notificationCleanup';
import { businessAccessHistoryService, BusinessAccessHistory } from '../utils/businessAccessHistory';
import { dataCleanupRegistry } from '../utils/dataCleanupRegistry';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;

// Helper function to get the Supabase storage key format
function getSupabaseStorageKey(): string {
  // Supabase uses this format for storing auth tokens
  // Format: sb-<project-ref>-auth-token
  const url = new URL(supabaseUrl);
  const projectRef = url.hostname.split('.')[0];
  return `sb-${projectRef}-auth-token`;
}

// Helper function to completely clear auth storage
async function clearAuthStorage() {
  console.log('clearAuthStorage: Starting complete storage clear');

  // Get the exact Supabase storage key
  const supabaseStorageKey = getSupabaseStorageKey();
  console.log('clearAuthStorage: Supabase storage key:', supabaseStorageKey);

  if (Platform.OS === 'web') {
    // On web, clear all AsyncStorage/localStorage keys
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      console.log('clearAuthStorage: All AsyncStorage keys:', allKeys);

      // Clear all Supabase auth keys
      const supabaseKeys = allKeys.filter(key =>
        key.includes('supabase') ||
        key.includes('sb-') ||
        key.includes('auth-token') ||
        key.includes('auth.token')
      );

      // Ensure the exact Supabase storage key is included
      if (!supabaseKeys.includes(supabaseStorageKey)) {
        supabaseKeys.push(supabaseStorageKey);
      }

      if (supabaseKeys.length > 0) {
        await AsyncStorage.multiRemove(supabaseKeys);
        console.log('clearAuthStorage: Cleared web keys:', supabaseKeys);
      }

      // Double-check the main key is removed
      await AsyncStorage.removeItem(supabaseStorageKey);
      console.log('clearAuthStorage: Ensured main key removed:', supabaseStorageKey);
    } catch (error) {
      console.error('clearAuthStorage: Error clearing web storage:', error);
    }
  } else {
    // On native, clear all possible SecureStore keys
    const possibleKeys = [
      supabaseStorageKey,
      'supabase.auth.token',
      `${supabaseUrl}-auth-token`,
      `sb-${supabaseUrl}-auth-token`,
      'sb-auth-token',
    ];

    for (const key of possibleKeys) {
      try {
        await SecureStore.deleteItemAsync(key);
      } catch (error) {
        // Key might not exist, that's fine
        console.log('clearAuthStorage: Key does not exist');
      }
    }
  }

  console.log('clearAuthStorage: Complete storage clear finished');
}

// Helper function to verify session is cleared
async function verifySessionCleared(): Promise<boolean> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const isCleared = session === null;
    console.log('verifySessionCleared: Session cleared:', isCleared);
    return isCleared;
  } catch (error) {
    console.error('verifySessionCleared: Error checking session:', error);
    return false;
  }
}

type UserProfile = Database['public']['Tables']['user_profiles']['Row'];
type Business = Database['public']['Tables']['businesses']['Row'];
type UserBusinessRole = Database['public']['Tables']['user_business_roles']['Row'];

interface AuthContextType {
  session: Session | null;
  user: User | null;
  userProfile: UserProfile | null;
  userBusinesses: Business[];
  currentBusiness: Business | null;
  currentUserRole: 'admin' | 'staff' | null;
  isAdmin: boolean;
  isStaff: boolean;
  loading: boolean;
  initialDataLoaded: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  updateUserProfile: (updates: Partial<UserProfile>) => Promise<{ error: any }>;
  updateBusiness: (businessId: string, updates: Partial<Business>) => Promise<{ error: any }>;
  switchBusiness: (businessId: string) => Promise<void>;
  createBusiness: (businessName: string) => Promise<{ error: any, business?: Business }>;
  getUserRole: (businessId: string) => 'admin' | 'staff' | null;
  hasBusinessAccess: (businessId: string) => boolean;
  resetPassword: (email: string) => Promise<{ error: any }>;
  updatePassword: (password: string) => Promise<{ error: any }>;
  refreshUserBusinesses: () => Promise<Business[]>;
  signedOutDueToInactivity: boolean;
  resetInactivitySignOutFlag: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// One week in milliseconds
const INACTIVITY_TIMEOUT = 7 * 24 * 60 * 60 * 1000;

// Grace periods for app foreground transitions
const SESSION_REFRESH_GRACE_PERIOD = 60 * 1000; // 1 minute for session refresh (performance)
const SECURITY_CHECK_GRACE_PERIOD = 5 * 1000; // 5 seconds for business access check (security)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const mounted = useRef(true);
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [userBusinesses, setUserBusinesses] = useState<Business[]>([]);
  const [currentBusiness, setCurrentBusiness] = useState<Business | null>(null);
  const [userBusinessRoles, setUserBusinessRoles] = useState<Map<string, 'admin' | 'staff'>>(new Map());
  const [loading, setLoading] = useState(true);
  const [dataLoadingState, setDataLoadingState] = useState<'idle' | 'loading' | 'loaded'>('idle');
  const [signedOutDueToInactivity, setSignedOutDueToInactivity] = useState(false);
  const [businessAccessHistory, setBusinessAccessHistory] = useState<BusinessAccessHistory>({});
  const [isExplicitSignOut, setIsExplicitSignOut] = useState(false);
  const realtimeChannelRef = useRef<any>(null);
  const businessAccessHistoryRef = useRef<BusinessAccessHistory>({});
  const userBusinessesRef = useRef<Business[]>([]);
  const currentBusinessRef = useRef<Business | null>(null);
  const userRef = useRef<User | null>(null);
  const realtimeStatusRef = useRef<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
  const [realtimeStatus, setRealtimeStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
  const lastForegroundTimeRef = useRef<number>(0);
  const lastSecurityCheckTimeRef = useRef<number>(0);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const subscriptionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const appStateRef = useRef<string>('active');
  const isRefreshingSessionRef = useRef<boolean>(false);

  // Derived state: initial data is loaded when we're not loading and data has been fetched
  const initialDataLoaded = dataLoadingState === 'loaded';

  // Keep refs in sync with state
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    realtimeStatusRef.current = realtimeStatus;
  }, [realtimeStatus]);

  // Helper function for selecting the best available business
  const selectBestAvailableBusiness = useCallback((
    removedBusinessId: string,
    availableBusinesses: Business[],
    accessHistory: BusinessAccessHistory
  ): Business | null => {
    if (availableBusinesses.length === 0) {
      return null;
    }

    const candidates = availableBusinesses.filter(b => b.id !== removedBusinessId);

    if (candidates.length === 0) {
      return null;
    }

    const sorted = candidates
      .map(business => ({
        business,
        lastAccess: accessHistory[business.id] || 0,
      }))
      .sort((a, b) => b.lastAccess - a.lastAccess);

    return sorted[0].business;
  }, []);

  // Helper function for switching business
  const switchBusiness = useCallback(async (businessId: string) => {
    if (!user) return;

    const business = userBusinessesRef.current.find(b => b.id === businessId);
    if (!business) {
      console.error('Business not found:', businessId);
      return;
    }

    console.log('[AuthContext] Switching business, triggering data cleanup');

    // Trigger data cleanup for all registered components
    await dataCleanupRegistry.cleanupAll();

    setCurrentBusiness(business);

    // Save preference to AsyncStorage
    try {
      await AsyncStorage.setItem(`currentBusiness_${user.id}`, businessId);
    } catch (error) {
      console.error('Error saving business preference:', error);
    }

    // Track business access for smart switching
    try {
      await businessAccessHistoryService.updateAccess(businessId);
      const updatedHistory = await businessAccessHistoryService.getHistory();
      setBusinessAccessHistory(updatedHistory);
      businessAccessHistoryRef.current = updatedHistory;
    } catch (error) {
      console.error('Error updating business access history:', error);
    }
  }, [user]);

  // Helper function to refresh session when it might be stale
  const refreshSessionIfNeeded = useCallback(async (): Promise<boolean> => {
    // Prevent multiple simultaneous refresh attempts
    if (isRefreshingSessionRef.current) {
      console.log('Session refresh already in progress, skipping');
      return false;
    }

    isRefreshingSessionRef.current = true;

    try {
      console.log('Attempting to refresh session...');

      const { data, error } = await supabase.auth.refreshSession();

      if (error) {
        console.error('Session refresh failed:', error.message);
        isRefreshingSessionRef.current = false;
        return false;
      }

      if (data.session) {
        console.log('Session refreshed successfully');
        setSession(data.session);
        setUser(data.session.user);
        userRef.current = data.session.user;
        isRefreshingSessionRef.current = false;
        return true;
      } else {
        console.warn('Session refresh returned no session');
        isRefreshingSessionRef.current = false;
        return false;
      }
    } catch (error) {
      console.error('Unexpected error during session refresh:', error);
      isRefreshingSessionRef.current = false;
      return false;
    }
  }, []);

  // Polling fallback function when realtime fails
  const startPollingFallback = useCallback(() => {
    // Clear any existing polling first
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }

    if (!userRef.current?.id) {
      console.warn('Cannot start polling: No valid user');
      return;
    }

    console.log('Starting polling fallback for business role changes', { userId: userRef.current.id });

    // Store current business IDs for comparison
    let lastBusinessIds = new Set(userBusinessesRef.current.map(b => b.id));
    let consecutiveFailures = 0;
    const MAX_FAILURES = 5;

    pollingIntervalRef.current = setInterval(async () => {
      try {
        // Guard: Check if user is still valid
        if (!userRef.current?.id) {
          console.warn('Polling stopped: User is no longer valid');
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
          return;
        }

        // Guard: Check if real-time has connected (stop polling if so)
        if (realtimeStatusRef.current === 'connected') {
          console.log('Polling stopped: Real-time is now connected');
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
          return;
        }

        console.log('Polling for business role changes...', { userId: userRef.current.id });

        const { data: roles, error } = await supabase
          .from('user_business_roles')
          .select('business_id')
          .eq('user_id', userRef.current.id);

        if (error) {
          consecutiveFailures++;

          // Use context-aware logging based on app state
          const isInBackground = appStateRef.current !== 'active';
          const logLevel = isInBackground ? 'warn' : 'error';

          console[logLevel]('Polling error (attempt', consecutiveFailures, '/', MAX_FAILURES, '):', {
            error: error,
            errorCode: error.code,
            errorMessage: error.message,
            appState: appStateRef.current,
            userId: userRef.current?.id,
            timestamp: new Date().toISOString()
          });

          // Check if it's an auth error
          const isAuthError =
            error.message?.includes('JWT') ||
            error.message?.includes('expired') ||
            error.message?.includes('Invalid API key') ||
            error.code === 'PGRST301';

          if (isAuthError) {
            console.log('Auth error detected, attempting session refresh...');

            // Attempt to refresh the session
            const refreshSuccess = await refreshSessionIfNeeded();

            if (refreshSuccess) {
              console.log('Session refreshed successfully, resetting error counter');
              consecutiveFailures = 0;
              return; // Continue polling with refreshed session
            } else {
              console.error('Session refresh failed, stopping polling');
              if (pollingIntervalRef.current) {
                clearInterval(pollingIntervalRef.current);
                pollingIntervalRef.current = null;
              }
              return;
            }
          }

          // Stop polling after max consecutive failures
          if (consecutiveFailures >= MAX_FAILURES) {
            console.error('Polling stopped: Too many consecutive failures');
            if (pollingIntervalRef.current) {
              clearInterval(pollingIntervalRef.current);
              pollingIntervalRef.current = null;
            }
          }
          return;
        }

        // Success - reset failure counter
        consecutiveFailures = 0;

        const currentBusinessIds = new Set((roles || []).map((r: any) => r.business_id));

        // Check for removed businesses
        for (const oldId of lastBusinessIds) {
          if (!currentBusinessIds.has(oldId)) {
            console.log('Polling detected business removal:', oldId);

            // Check if it was the current business
            if (currentBusinessRef.current?.id === oldId) {
              // Trigger the same logic as realtime DELETE
              const removedBusinessName = userBusinessesRef.current.find(b => b.id === oldId)?.business_name || 'this business';
              const remainingBusinesses = userBusinessesRef.current.filter(b => b.id !== oldId);

              // Update state
              setUserBusinesses(remainingBusinesses);
              setUserBusinessRoles(prev => {
                const newMap = new Map(prev);
                newMap.delete(oldId);
                return newMap;
              });

              // Cleanup data for removed business
              console.log('[Polling] Cleaning up data for removed business:', oldId);
              dataCleanupRegistry.cleanupForRemovedBusiness(oldId);

              if (remainingBusinesses.length > 0) {
                const nextBusiness = selectBestAvailableBusiness(
                  oldId,
                  remainingBusinesses,
                  businessAccessHistoryRef.current
                );

                if (nextBusiness) {
                  await switchBusiness(nextBusiness.id);

                  setTimeout(async () => {
                    try {
                      const { router } = await import('expo-router');
                      router.replace('/(app)/(tabs)');

                      setTimeout(() => {
                        if (Platform.OS === 'web') {
                          alert(`Business Access Removed\n\nYou were removed from "${removedBusinessName}". Switched to "${nextBusiness.business_name}".`);
                        } else {
                          const { Alert } = require('react-native');
                          Alert.alert(
                            'Business Access Removed',
                            `You were removed from "${removedBusinessName}". Switched to "${nextBusiness.business_name}".`,
                            [{ text: 'OK' }]
                          );
                        }
                      }, 500);
                    } catch (navError) {
                      console.error('Navigation error:', navError);
                    }
                  }, 200);
                }
              } else {
                setCurrentBusiness(null);

                setTimeout(async () => {
                  try {
                    const { router } = await import('expo-router');
                    router.replace('/(app)/business-onboarding');

                    setTimeout(() => {
                      if (Platform.OS === 'web') {
                        alert(`Business Access Removed\n\nYou were removed from "${removedBusinessName}" and have no other businesses.`);
                      } else {
                        const { Alert } = require('react-native');
                        Alert.alert(
                          'Business Access Removed',
                          `You were removed from "${removedBusinessName}" and have no other businesses.`,
                          [{ text: 'OK' }]
                        );
                      }
                    }, 500);
                  } catch (navError) {
                    console.error('Navigation error:', navError);
                  }
                }, 200);
              }
            } else {
              // Just update the lists
              setUserBusinesses(prev => prev.filter(b => b.id !== oldId));
              setUserBusinessRoles(prev => {
                const newMap = new Map(prev);
                newMap.delete(oldId);
                return newMap;
              });
            }
          }
        }

        // Update for next iteration
        lastBusinessIds = currentBusinessIds;
      } catch (error) {
        console.error('Polling fallback error:', error);
      }
    }, 30000); // Poll every 30 seconds
  }, [user, selectBestAvailableBusiness, switchBusiness]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    async function loadBusinessAccessHistory() {
      const history = await businessAccessHistoryService.getHistory();
      if (mounted.current) {
        setBusinessAccessHistory(history);
        businessAccessHistoryRef.current = history;
      }
    }
    loadBusinessAccessHistory();
  }, []);

  useEffect(() => {
    businessAccessHistoryRef.current = businessAccessHistory;
  }, [businessAccessHistory]);

  useEffect(() => {
    userBusinessesRef.current = userBusinesses;
  }, [userBusinesses]);

  useEffect(() => {
    currentBusinessRef.current = currentBusiness;
  }, [currentBusiness]);

  // Debug logging for data loading state
  useEffect(() => {
    console.log('AuthContext: dataLoadingState changed to:', dataLoadingState,
                'initialDataLoaded:', initialDataLoaded,
                'userBusinesses:', userBusinesses.length,
                'currentBusiness:', currentBusiness?.id || 'none');
  }, [dataLoadingState, initialDataLoaded, userBusinesses.length, currentBusiness]);

  useEffect(() => {
    // Debug: Log all storage keys on app start
    (async () => {
      try {
        if (Platform.OS === 'web') {
          const allKeys = await AsyncStorage.getAllKeys();
          console.log('=== DEBUG: All AsyncStorage keys on app start ===');
          console.log(allKeys);

          const authKeys = allKeys.filter(key =>
            key.includes('supabase') ||
            key.includes('auth') ||
            key.includes('sb-')
          );
          if (authKeys.length > 0) {
            console.log('=== DEBUG: Auth-related keys ===');
            console.log(authKeys);

            // Log the actual values
            for (const key of authKeys) {
              const value = await AsyncStorage.getItem(key);
              console.log(`${key}:`, value ? value.substring(0, 100) + '...' : null);
            }
          }
        }
      } catch (error) {
        console.error('Debug logging error:', error);
      }
    })();

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      // Check if session exists and if it's expired due to inactivity
      console.log('Initial getSession result:', session ? 'Session exists' : 'No session');
      if (session) {
        console.log('Initial session user ID:', session.user.id);
        checkSessionActivity(session);
      }

      if (mounted.current) {
        setSession(session);
        setUser(session?.user ?? null);
      }
      if (session?.user) {
        console.log('Initial session: Loading auth data for user:', session.user.id);
        loadAuthData(session.user.id);
      } else {
        console.log('Initial session: No user, setting loading to false');
        if (mounted.current) {
          setLoading(false);
          setDataLoadingState('loaded');
        }
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state change:', event);
        console.log('AuthContext: Session object on auth state change:', session);

        // Handle sign out events
        if (event === 'SIGNED_OUT') {
          console.log('AuthContext: SIGNED_OUT event received, explicit:', isExplicitSignOut);

          if (!isExplicitSignOut) {
            // If signed out but not explicitly by the user, it was due to inactivity
            setSignedOutDueToInactivity(true);
          }

          // Clear everything on sign out
          if (mounted.current) {
            setSession(null);
            setUser(null);
            setUserProfile(null);
            setUserBusinesses([]);
            setCurrentBusiness(null);
            setLoading(false);
            setDataLoadingState('loaded');
          }

          // Reset the explicit sign out flag
          setIsExplicitSignOut(false);
          return; // Don't process further
        }

        if (event === 'SIGNED_IN') {
          // Reset the inactivity flag when user signs in
          setSignedOutDueToInactivity(false);

          // Update last activity timestamp
          await updateLastActivityTimestamp();
        }

        // Reset the explicit sign out flag for other events
        if (isExplicitSignOut) {
          setIsExplicitSignOut(false);
        }

       if (mounted.current) {
         setSession(session);
         setUser(session?.user ?? null);
       }

        if (session?.user) {
          loadAuthData(session.user.id);
        } else {
          console.log("AuthContext: NO SESSION - user signed out");
          if (mounted.current) {
            setUserProfile(null);
            setUserBusinesses([]);
            setCurrentBusiness(null);
            setLoading(false);
            setDataLoadingState('loaded');
          }
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  // Set up real-time subscription for user business roles
  useEffect(() => {
    if (!user?.id || !session) {
      // Clean up any existing subscription
      if (realtimeChannelRef.current) {
        supabase.removeChannel(realtimeChannelRef.current);
        realtimeChannelRef.current = null;
      }
      return;
    }

    console.log('Setting up real-time subscription for user business roles', { userId: user.id });

    // Clear any existing polling fallback
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }

    // Clear any existing subscription timeout
    if (subscriptionTimeoutRef.current) {
      clearTimeout(subscriptionTimeoutRef.current);
      subscriptionTimeoutRef.current = null;
    }

    setRealtimeStatus('connecting');

    // Create a channel for user business roles changes
    const channel = supabase
      .channel(`user_business_roles:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_business_roles',
          filter: `user_id=eq.${user.id}`
        },
        async (payload) => {
          console.log('Real-time update received:', payload);

          if (payload.eventType === 'INSERT') {
            // New business assigned to user
            const newBusinessId = (payload.new as any).business_id;
            console.log('User assigned to new business:', newBusinessId);

            // Fetch the new business details
            const { data: newBusiness, error } = await supabase
              .from('businesses')
              .select('*')
              .eq('id', newBusinessId)
              .single();

            if (!error && newBusiness && mounted.current) {
              // Add to businesses list if not already there
              setUserBusinesses(prev => {
                if (prev.some(b => b.id === newBusiness.id)) {
                  return prev;
                }
                return [...prev, newBusiness];
              });

              // Update roles map
              setUserBusinessRoles(prev => {
                const newMap = new Map(prev);
                newMap.set(newBusinessId, (payload.new as any).role as 'admin' | 'staff');
                return newMap;
              });

              console.log('New business added to user list:', newBusiness.business_name);
            }
          } else if (payload.eventType === 'UPDATE') {
            // User role changed in a business
            const businessId = (payload.new as any).business_id;
            const newRole = (payload.new as any).role as 'admin' | 'staff';
            console.log('User role updated in business:', businessId, 'new role:', newRole);

            if (mounted.current) {
              setUserBusinessRoles(prev => {
                const newMap = new Map(prev);
                newMap.set(businessId, newRole);
                return newMap;
              });
            }
          } else if (payload.eventType === 'DELETE') {
            // User removed from a business
            const removedBusinessId = (payload.old as any).business_id;
            const removedBusinessName = userBusinessesRef.current.find(b => b.id === removedBusinessId)?.business_name || 'this business';
            const wasCurrentBusiness = currentBusinessRef.current?.id === removedBusinessId;

            console.log('Real-time: User removed from business', {
              removedBusinessId,
              removedBusinessName,
              wasCurrentBusiness,
              currentBusinessesCount: userBusinessesRef.current.length,
            });

            if (mounted.current) {
              let updatedBusinessList: Business[] = [];

              // Remove from businesses list
              setUserBusinesses(prev => {
                const filtered = prev.filter(b => b.id !== removedBusinessId);
                updatedBusinessList = filtered;
                console.log('Updated userBusinesses after removal:', {
                  removedBusinessId,
                  newCount: filtered.length,
                  remainingIds: filtered.map(b => b.id),
                });
                return filtered;
              });

              // Remove from roles map
              setUserBusinessRoles(prev => {
                const newMap = new Map(prev);
                newMap.delete(removedBusinessId);
                console.log('Updated userBusinessRoles after removal:', {
                  removedBusinessId,
                  remainingRolesCount: newMap.size,
                });
                return newMap;
              });

              // Cleanup notifications for the removed business
              notificationCleanupService.cleanup(removedBusinessId);

              // Cleanup all data for the removed business
              console.log('[AuthContext] User removed from business, triggering data cleanup');
              dataCleanupRegistry.cleanupForRemovedBusiness(removedBusinessId);

              // Remove business from access history
              businessAccessHistoryService.removeBusinessFromHistory(removedBusinessId);

              // If removed from current business, handle automatic switching
              if (wasCurrentBusiness) {
                console.log('User removed from their current business - triggering automatic switch');

                // Wait a bit for state updates to propagate
                setTimeout(async () => {
                  // Get the latest business list from the captured value
                  const remainingBusinesses = updatedBusinessList;

                  console.log('Remaining businesses after removal:', {
                    count: remainingBusinesses.length,
                    ids: remainingBusinesses.map(b => b.id),
                  });

                  if (remainingBusinesses.length > 0) {
                    // Get current access history
                    const currentHistory = businessAccessHistoryRef.current;

                    // Select the best available business
                    const nextBusiness = selectBestAvailableBusiness(
                      removedBusinessId,
                      remainingBusinesses,
                      currentHistory
                    );

                    if (nextBusiness) {
                      console.log('Automatically switching to:', {
                        businessId: nextBusiness.id,
                        businessName: nextBusiness.business_name,
                      });

                      try {
                        await switchBusiness(nextBusiness.id);

                        console.log('Business switch successful, triggering navigation');

                        // Force navigation to dashboard after business switch
                        setTimeout(async () => {
                          try {
                            // Dynamically import router to avoid circular dependencies
                            const { router } = await import('expo-router');
                            console.log('Navigating to dashboard after business switch');
                            router.replace('/(app)/(tabs)');

                            // Show notification after navigation
                            setTimeout(() => {
                              if (Platform.OS === 'web') {
                                alert(`Business Access Removed\n\nYou were removed from "${removedBusinessName}". Switched to "${nextBusiness.business_name}".`);
                              } else {
                                const { Alert } = require('react-native');
                                Alert.alert(
                                  'Business Access Removed',
                                  `You were removed from "${removedBusinessName}". Switched to "${nextBusiness.business_name}".`,
                                  [{ text: 'OK' }]
                                );
                              }
                            }, 500);
                          } catch (navError) {
                            console.error('Navigation error after business switch:', navError);
                          }
                        }, 200);
                      } catch (error) {
                        console.error('Failed to automatically switch business:', error);
                        setCurrentBusiness(null);
                      }
                    } else {
                      console.warn('Could not select a business to switch to');
                      setCurrentBusiness(null);
                    }
                  } else {
                    console.log('No remaining businesses, clearing current business and navigating to onboarding');
                    setCurrentBusiness(null);

                    // Navigate to business onboarding
                    setTimeout(async () => {
                      try {
                        const { router } = await import('expo-router');
                        console.log('Navigating to business onboarding after removal');
                        router.replace('/(app)/business-onboarding');

                        // Show notification after navigation
                        setTimeout(() => {
                          if (Platform.OS === 'web') {
                            alert(`Business Access Removed\n\nYou were removed from "${removedBusinessName}" and have no other businesses. You can create a new business to continue.`);
                          } else {
                            const { Alert } = require('react-native');
                            Alert.alert(
                              'Business Access Removed',
                              `You were removed from "${removedBusinessName}" and have no other businesses. You can create a new business to continue.`,
                              [{ text: 'OK' }]
                            );
                          }
                        }, 500);
                      } catch (navError) {
                        console.error('Navigation error after business removal:', navError);
                      }
                    }, 200);
                  }
                }, 100);
              }
            }
          }
        }
      )
      .on('system', {}, (payload: any) => {
        console.log('Realtime system event:', payload);

        if (payload.status === 'SUBSCRIBED') {
          console.log('✅ Realtime subscription connected successfully');
          setRealtimeStatus('connected');

          // Clear subscription timeout on successful connection
          if (subscriptionTimeoutRef.current) {
            clearTimeout(subscriptionTimeoutRef.current);
            subscriptionTimeoutRef.current = null;
          }

          // Stop polling fallback immediately
          if (pollingIntervalRef.current) {
            console.log('Stopping polling fallback: Real-time connected');
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
        } else if (payload.status === 'CHANNEL_ERROR') {
          console.error('❌ Realtime subscription error:', payload);
          setRealtimeStatus('error');
        } else if (payload.status === 'TIMED_OUT') {
          console.error('❌ Realtime subscription timed out');
          setRealtimeStatus('error');
        } else if (payload.status === 'CLOSED') {
          console.warn('⚠️  Realtime subscription closed');
          setRealtimeStatus('disconnected');
        }
      })
      .subscribe((status, err) => {
        if (err) {
          console.error('Realtime subscription error:', err);
          setRealtimeStatus('error');
        }
        console.log('Realtime subscription status:', status);
      });

    realtimeChannelRef.current = channel;

    // Set timeout for subscription connection (10 seconds)
    subscriptionTimeoutRef.current = setTimeout(() => {
      // Use ref to get current status (avoids stale closure)
      if (realtimeStatusRef.current !== 'connected') {
        console.warn('⚠️  Realtime subscription did not connect within 10 seconds, starting polling fallback');
        startPollingFallback();
      } else {
        console.log('Real-time already connected, skipping polling fallback');
      }
    }, 10000);

    // Cleanup function
    return () => {
      if (realtimeChannelRef.current) {
        supabase.removeChannel(realtimeChannelRef.current);
        realtimeChannelRef.current = null;
      }

      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }

      if (subscriptionTimeoutRef.current) {
        clearTimeout(subscriptionTimeoutRef.current);
        subscriptionTimeoutRef.current = null;
      }

      setRealtimeStatus('disconnected');
    };
  }, [user?.id, session, selectBestAvailableBusiness, switchBusiness]);

    // Add a safety timeout to prevent the app from being stuck in loading state
  useEffect(() => {
    if (loading) {
      // Set a maximum loading time of 10 seconds
      const MAX_LOADING_TIME = 15000; // 10 seconds
      const safetyTimeout = setTimeout(() => {
        if (mounted.current) {
          setLoading(false);
        }
      }, MAX_LOADING_TIME);

      return () => {
        clearTimeout(safetyTimeout);
        console.log('Auth loading safety timeout cleared');
      };
    }
  }, [loading]);

  // Load saved current business ID from AsyncStorage
  const determineCurrentBusiness = async (userId: string, businesses: Business[], existingCurrentBusiness: Business | null): Promise<Business | null> => {
    try {
      const savedBusinessId = await AsyncStorage.getItem(`currentBusiness_${userId}`);
      if (savedBusinessId && businesses.length > 0) {
        const business = businesses.find(b => b.id === savedBusinessId);
        if (business) {
          // If the business ID matches the existing one, return the existing reference to prevent unnecessary re-renders
          if (existingCurrentBusiness && existingCurrentBusiness.id === business.id) {
            return existingCurrentBusiness;
          }
          return business;
        }
      }
      
      // If no saved business or saved business not found, use the first one
      if (businesses.length > 0) {
        const firstBusiness = businesses[0];
        // If the first business ID matches the existing one, return the existing reference
        if (existingCurrentBusiness && existingCurrentBusiness.id === firstBusiness.id) {
          return existingCurrentBusiness;
        }
        return firstBusiness;
      }
      
      return null;
    } catch (error) {
      console.error('Error loading saved business ID:', error);
      // Default to first business if there's an error
      if (businesses.length > 0) {
        const firstBusiness = businesses[0];
        // If the first business ID matches the existing one, return the existing reference
        if (existingCurrentBusiness && existingCurrentBusiness.id === firstBusiness.id) {
          return existingCurrentBusiness;
        }
        return firstBusiness;
      }
      return null;
    }
  };

  // Lightweight check to verify user still has access to their businesses
  const checkBusinessAccessSecurity = useCallback(async () => {
    if (!userRef.current?.id) {
      console.log('checkBusinessAccessSecurity: No user, skipping');
      return;
    }

    try {
      console.log('checkBusinessAccessSecurity: Performing lightweight business access check');

      const { data: roles, error } = await supabase
        .from('user_business_roles')
        .select('business_id')
        .eq('user_id', userRef.current.id);

      if (error) {
        console.warn('checkBusinessAccessSecurity: Error checking business access:', error.message);
        return;
      }

      const currentBusinessIds = new Set((roles || []).map((r: any) => r.business_id));
      const previousBusinessIds = new Set(userBusinessesRef.current.map(b => b.id));

      // Check if user was removed from any business
      const removedBusinessIds = Array.from(previousBusinessIds).filter(
        id => !currentBusinessIds.has(id)
      );

      if (removedBusinessIds.length > 0) {
        console.warn('checkBusinessAccessSecurity: User removed from businesses:', removedBusinessIds);

        // Trigger refresh to handle the removal properly
        await refreshUserBusinesses();
      } else {
        console.log('checkBusinessAccessSecurity: All business access verified');
      }

      lastSecurityCheckTimeRef.current = Date.now();
    } catch (error) {
      console.error('checkBusinessAccessSecurity: Unexpected error:', error);
    }
  }, []);

  // Check for session activity whenever the app comes to foreground
  useEffect(() => {
    const checkActivity = async () => {
      if (session) {
        checkSessionActivity(session);
      }
    };
    
    // Add app state change listener for foreground/background transitions
    const subscription = AppState.addEventListener('change', async (nextAppState) => {
      const previousState = appStateRef.current;
      appStateRef.current = nextAppState;

      console.log('App state changed:', previousState, '->', nextAppState);

      if (nextAppState === 'active' && previousState !== 'active') {
        // App is returning to foreground
        const now = Date.now();
        const timeSinceLastForeground = now - lastForegroundTimeRef.current;
        const timeSinceSecurityCheck = now - lastSecurityCheckTimeRef.current;

        console.log('App returning to foreground', {
          timeSinceLastForeground: `${(timeSinceLastForeground / 1000).toFixed(1)}s`,
          timeSinceSecurityCheck: `${(timeSinceSecurityCheck / 1000).toFixed(1)}s`,
          sessionRefreshGracePeriod: `${(SESSION_REFRESH_GRACE_PERIOD / 1000).toFixed(0)}s`,
          securityCheckGracePeriod: `${(SECURITY_CHECK_GRACE_PERIOD / 1000).toFixed(0)}s`
        });

        // SECURITY CHECK: Always verify business access frequently (5 second grace period)
        if (timeSinceSecurityCheck > SECURITY_CHECK_GRACE_PERIOD) {
          console.log('Security check grace period exceeded, performing business access check');
          await checkBusinessAccessSecurity();
        } else {
          console.log('Security check grace period active, skipping business access check');
        }

        // PERFORMANCE OPTIMIZATION: Only refresh session if grace period exceeded (60 second grace period)
        if (timeSinceLastForeground > SESSION_REFRESH_GRACE_PERIOD) {
          console.log('Session refresh grace period exceeded, refreshing session...');

          if (session) {
            const refreshSuccess = await refreshSessionIfNeeded();

            if (refreshSuccess) {
              console.log('Session refreshed on foreground transition');
            } else {
              console.warn('Session refresh failed on foreground transition');
            }
          }

          // Then proceed with activity checks
          checkActivity();
        } else {
          console.log('Session refresh grace period active, skipping session refresh');
        }

        // Always update timestamps and last activity
        lastForegroundTimeRef.current = now;
        if (session) {
          updateLastActivityTimestamp();
        }
      } else if (nextAppState === 'background' || nextAppState === 'inactive') {
        // App is going to background
        console.log('App going to background');
      }
    });
    
    return () => {
      subscription.remove();
    };
  }, [session, checkBusinessAccessSecurity]);

  const checkSessionActivity = async (currentSession: Session) => {
    try {
      console.log('Checking session activity');
      const lastActivity = await AsyncStorage.getItem('lastActivityTimestamp');
      
      if (lastActivity) {
        const lastActivityTime = parseInt(lastActivity, 10);
        const currentTime = Date.now();
        
        // If inactive for more than one week, sign out
        if (currentTime - lastActivityTime > INACTIVITY_TIMEOUT) {
          console.log('Session expired due to inactivity');
          setSignedOutDueToInactivity(true);
          await supabase.auth.signOut();
        } else {
          console.log('Session is still active, last activity:', new Date(lastActivityTime).toISOString());
        }
      } else {
        // If no last activity timestamp exists, create one
        console.log('No last activity timestamp, creating one');
        await updateLastActivityTimestamp();
      }
    } catch (error) {
      console.error('Error checking session activity:', error);
    }
  };

  const updateLastActivityTimestamp = async () => {
    try {
      await AsyncStorage.setItem('lastActivityTimestamp', Date.now().toString());
    } catch (error) {
      console.error('Error updating last activity timestamp:', error);
    }
  };

  const resetInactivitySignOutFlag = () => {
    setSignedOutDueToInactivity(false);
  };

  // Helper function to compare business arrays by IDs to prevent unnecessary re-renders
  const businessArraysEqual = (arr1: Business[], arr2: Business[]): boolean => {
    if (arr1.length !== arr2.length) return false;
    
    // Sort both arrays by ID and compare
    const ids1 = arr1.map(b => b.id).sort();
    const ids2 = arr2.map(b => b.id).sort();
    
    return ids1.every((id, index) => id === ids2[index]);
  };

  const loadAuthData = async (userId: string) => {
    console.log('loadAuthData started for user:', userId);
    setDataLoadingState('loading');
    try {
      // Retry configuration
      const MAX_RETRIES = 3;
      const INITIAL_DELAY_MS = 500;
      let lastError = null;
      
      // Try to load user profile with retries
      for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
          // Attempt to fetch the user profile
          const { data, error } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('user_id', userId)
            .single();

          console.log("Data return: ", data);
            
          if (error) {
            // Store the error but don't throw yet (unless it's the last attempt)
            lastError = error;
            
            // If it's not the last attempt, wait with exponential backoff before retrying
            if (attempt < MAX_RETRIES - 1) {
              const delayMs = INITIAL_DELAY_MS * Math.pow(2, attempt);
              await new Promise(resolve => setTimeout(resolve, delayMs));
              continue;
            }
            
            // On the last attempt, if there's an error, we'll handle it below
            throw error;
          }
          
          // If we got here, the user profile request succeeded
          if (data) {
            if (mounted.current) {
              setUserProfile(data);
            }
            
            // Now fetch the user's businesses
            const { data: businessRoles, error: businessRolesError } = await supabase
              .from('user_business_roles')
              .select(`
                business_id,
                role,
                businesses:business_id(*)
              `)
              .eq('user_id', userId);
              
            if (businessRolesError) {
              console.error('Error loading business roles:', businessRolesError);
              throw businessRolesError;
            }
            
            // Extract businesses from the nested structure
            const businesses = businessRoles.map((role: any) => role.businesses) as Business[];

            // Store roles in a map for quick lookup
            const rolesMap = new Map<string, 'admin' | 'staff'>();
            businessRoles.forEach((role: any) => {
              rolesMap.set(role.business_id, role.role as 'admin' | 'staff');
            });
            if (mounted.current) {
              setUserBusinessRoles(rolesMap);
            }

            // Determine and set current business (either from saved preference or first in list)
            const determinedBusiness = await determineCurrentBusiness(userId, businesses, currentBusiness);

            // Batch all state updates together before setting loading to false
            if (mounted.current) {
              // Update businesses if changed
              const shouldUpdateBusinesses = !businessArraysEqual(businesses, userBusinesses);
              const shouldUpdateCurrentBusiness = !currentBusiness || !determinedBusiness || currentBusiness.id !== determinedBusiness.id;

              if (shouldUpdateBusinesses) {
                setUserBusinesses(businesses);
              }

              if (shouldUpdateCurrentBusiness) {
                setCurrentBusiness(determinedBusiness);

                // Track initial business access
                if (determinedBusiness) {
                  businessAccessHistoryService.updateAccess(determinedBusiness.id).catch(error => {
                    console.error('Error tracking initial business access:', error);
                  });
                }
              }

              // Always set loading to false last, regardless of whether state changed
              setLoading(false);
              setDataLoadingState('loaded');
            }
            return; // Exit the function early on success
          } else {
            console.log('No user profile found for user:', userId);
            if (mounted.current) {
              setUserProfile(null);
              setUserBusinesses([]);
              setCurrentBusiness(null);
              setLoading(false);
              setDataLoadingState('loaded');
            }
            return; // Exit the function early
          }
        } catch (retryError) {
          // Store the error for the final attempt
          console.log("Retry Error: ", retryError);
          lastError = retryError;
          
          // If this is the last attempt, we'll let it fall through to the error handling below
          if (attempt === MAX_RETRIES - 1) {
            break;
          }
          
          // Otherwise, we'll continue to the next iteration (after the delay)
          const delayMs = INITIAL_DELAY_MS * Math.pow(2, attempt);
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      }
      
      // If we got here, all retries failed
      if (lastError) {
        console.error('All auth data loading attempts failed:', lastError);
        if (mounted.current) {
          setUserProfile(null);
          setUserBusinesses([]);
          setCurrentBusiness(null);
          setLoading(false);
          setDataLoadingState('loaded');
        }
      }
      return;
    } catch (error: any) {
      console.error('Error in loadAuthData:', error);
      if (mounted.current) {
        setUserBusinesses([]);
        setCurrentBusiness(null);
        setLoading(false);
        setDataLoadingState('loaded');
      }
      return;
    }

    // Always set loading to false when done
    console.log('loadAuthData completed, setting loading to false');
    if (mounted.current) {
      setLoading(false);
      setDataLoadingState('loaded');
    }
  };

  // Original loadProfile function (commented out)

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  }, []);

  const signUp = useCallback(async (email: string, password: string, fullName: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) return { error };

    if (data.user) {
      try {
        // Create user profile only
        const { error: profileError } = await supabase
          .from('user_profiles')
          .insert({
            user_id: data.user.id,
            full_name: fullName,
            email: email,
          });

        if (profileError) {
          console.error('Error creating user profile:', profileError);
          return { error: profileError };
        }

        return { error: null };
      } catch (createError) {
        console.error('Error in signup process:', createError);
        return { error: createError };
      }
    }

    return { error: null };
  }, []);

  const refreshUserBusinesses = useCallback(async (): Promise<Business[]> => {
    if (!user?.id) {
      console.log('refreshUserBusinesses: No user ID available');
      return [];
    }

    try {
      console.log('refreshUserBusinesses: Starting refresh for user:', user.id);

      // Fetch the user's businesses
      const { data: businessRoles, error: businessRolesError } = await supabase
        .from('user_business_roles')
        .select(`
          business_id,
          role,
          businesses:business_id(*)
        `)
        .eq('user_id', user.id);

      if (businessRolesError) {
        console.error('refreshUserBusinesses: Error fetching business roles:', businessRolesError);
        throw businessRolesError;
      }

      if (!businessRoles) {
        console.log('refreshUserBusinesses: No business roles found, returning empty array');
        return [];
      }

      // Extract businesses from the nested structure
      const businesses = businessRoles.map((role: any) => role.businesses) as Business[];

      console.log('refreshUserBusinesses: Fetched businesses:', {
        count: businesses.length,
        businessIds: businesses.map(b => b.id),
        businessNames: businesses.map(b => b.business_name),
      });

      // Store roles in a map for quick lookup
      const rolesMap = new Map<string, 'admin' | 'staff'>();
      businessRoles.forEach((role: any) => {
        rolesMap.set(role.business_id, role.role as 'admin' | 'staff');
      });

      if (mounted.current) {
        // Detect removed businesses for notification cleanup
        const removedBusinessIds = userBusinesses
          .filter(oldBiz => !businesses.some(newBiz => newBiz.id === oldBiz.id))
          .map(biz => biz.id);

        // Update businesses if changed
        const shouldUpdateBusinesses = !businessArraysEqual(businesses, userBusinesses);
        if (shouldUpdateBusinesses) {
          setUserBusinesses(businesses);
          console.log('refreshUserBusinesses: Updated state with new businesses');

          // Proactively cleanup notifications and data for removed businesses
          if (removedBusinessIds.length > 0) {
            console.log('refreshUserBusinesses: Cleaning up data for removed businesses:', removedBusinessIds);
            removedBusinessIds.forEach(businessId => {
              notificationCleanupService.cleanup(businessId);
              dataCleanupRegistry.cleanupForRemovedBusiness(businessId);
            });
          }
        } else {
          console.log('refreshUserBusinesses: Businesses unchanged, skipping state update');
        }

        setUserBusinessRoles(rolesMap);

        // If current business was removed, clear it
        if (currentBusiness && !businesses.some(b => b.id === currentBusiness.id)) {
          console.log('refreshUserBusinesses: Current business no longer accessible, clearing it');
          setCurrentBusiness(null);
        }
      }

      console.log('refreshUserBusinesses: Returning businesses array with', businesses.length, 'items');
      return businesses;
    } catch (error) {
      console.error('refreshUserBusinesses: Exception occurred:', error);
      return [];
    }
  }, [user?.id, userBusinesses, currentBusiness]);

  const createBusiness = useCallback(async (businessName: string) => {
    if (!user) {
      return { error: new Error('No authenticated user') };
    }

    try {
      // Call the RPC function to create a new business
      const { data: businessId, error } = await supabase
        .rpc('create_business', {
          business_name_param: businessName,
          owner_user_id_param: user.id
        });

      if (error) {
        console.error('Error creating business:', error);
        return { error };
      }

      // Fetch the newly created business
      const { data: business, error: fetchError } = await supabase
        .from('businesses')
        .select('*')
        .eq('id', businessId)
        .single();

      if (fetchError) {
        console.error('Error fetching new business:', fetchError);
        return { error: fetchError };
      }

      // Update the userBusinesses state
      setUserBusinesses(prev => [...prev, business]);

      // Set as current business if it's the first one
      if (userBusinesses.length === 0) {
        setCurrentBusiness(business);
        await AsyncStorage.setItem(`currentBusiness_${user.id}`, business.id);
      }

      return { error: null, business };
    } catch (error) {
      console.error('Error in createBusiness:', error);
      return { error };
    }
  }, [user, userBusinesses.length]);

  // Get the current user's role in a specific business
  const getUserRole = useCallback((businessId: string): 'admin' | 'staff' | null => {
    return userBusinessRoles.get(businessId) || null;
  }, [userBusinessRoles]);

  // Check if user has access to a specific business
  const hasBusinessAccess = useCallback((businessId: string): boolean => {
    return userBusinessRoles.has(businessId);
  }, [userBusinessRoles]);

  // Get current user's role in the active business
  const currentUserRole = useMemo(() => {
    if (!currentBusiness) return null;
    return getUserRole(currentBusiness.id);
  }, [currentBusiness, getUserRole]);

  // Computed properties for role checks
  const isAdmin = useMemo(() => currentUserRole === 'admin', [currentUserRole]);
  const isStaff = useMemo(() => currentUserRole === 'staff', [currentUserRole]);

  const signOut = useCallback(async () => {
    console.log('SignOut: Starting sign out process');

    // Set flag to indicate this is an explicit sign out
    setIsExplicitSignOut(true);

    // STEP 1: Clear storage BEFORE calling Supabase signOut API
    // This ensures the session is removed from persistent storage first
    console.log('SignOut: Pre-clearing storage before API call');
    await clearAuthStorage();

    // STEP 2: Clear any saved credentials and app data
    try {
      await clearRememberMeCredentials();
      await AsyncStorage.removeItem('lastActivityTimestamp');

      // Also clear business selection
      if (user?.id) {
        await AsyncStorage.removeItem(`currentBusiness_${user.id}`);
      }
    } catch (error) {
      console.error('SignOut: Error clearing saved credentials:', error);
    }

    // STEP 3: Call Supabase signOut API
    console.log('SignOut: Calling supabase.auth.signOut() with scope: local');
    try {
      const { error } = await supabase.auth.signOut({ scope: 'local' });

      if (error) {
        console.error('SignOut: Error during sign out:', error);
      } else {
        console.log('SignOut: API sign out complete');
      }
    } catch (error: any) {
      console.error('SignOut: Exception during sign out:', error);
    }

    // STEP 4: Clear storage again to ensure everything is removed
    console.log('SignOut: Post-clearing storage after API call');
    await clearAuthStorage();

    // STEP 5: Clear React state
    if (mounted.current) {
      console.log('SignOut: Clearing all auth state');
      setSession(null);
      setUser(null);
      setUserProfile(null);
      setUserBusinesses([]);
      setCurrentBusiness(null);
      setDataLoadingState('idle');
      setLoading(false);
      console.log('SignOut: Auth state cleared');
    }

    // STEP 6: Verify session is cleared
    const isCleared = await verifySessionCleared();
    if (!isCleared) {
      console.warn('SignOut: WARNING - Session may not be fully cleared!');
      // Force one more clear attempt
      await clearAuthStorage();
    }

    console.log('SignOut: Complete');
  }, [user]);

  const updateUserProfile = useCallback(async (updates: Partial<UserProfile>) => {
    if (!user) return { error: new Error('No user') };

    const { error } = await supabase
      .from('user_profiles')
      .update(updates)
      .eq('user_id', user.id);

    if (!error && userProfile) {
      setUserProfile({ ...userProfile, ...updates });
    }

    return { error };
  }, [user, userProfile]);

  const updateBusiness = useCallback(async (businessId: string, updates: Partial<Business>) => {
    if (!user) return { error: new Error('No user') };

    // Check if user has admin access to this business
    const { data: hasAccess, error: accessError } = await supabase
      .rpc('user_has_business_access', {
        user_uid: user.id,
        business_id_param: businessId
      });

    if (accessError || !hasAccess) {
      return { error: new Error('You do not have permission to update this business') };
    }

    const { error } = await supabase
      .from('businesses')
      .update(updates)
      .eq('id', businessId);

    if (!error) {
      // Update userBusinesses state
      setUserBusinesses(prev => 
        prev.map(b => b.id === businessId ? { ...b, ...updates } : b)
      );
      
      // Update currentBusiness if it's the one being modified
      if (currentBusiness && currentBusiness.id === businessId) {
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
      if (typeof window !== 'undefined' && window.location?.origin) {
        redirectTo = `${window.location.origin}/reset-password`;
      } else {
        redirectTo = `${appUrl}/reset-password`;
      }
    } else {
      redirectTo = `${appScheme}://reset-password`;
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });
    return { error };
  }, []);

  const updatePassword = useCallback(async (password: string) => {
    const { error } = await supabase.auth.updateUser({
      password,
    });
    return { error };
  }, []);

  const value = useMemo(() => ({
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
  }), [
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
    resetInactivitySignOutFlag,
  ]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}