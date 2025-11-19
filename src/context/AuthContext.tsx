import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { useRef } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../config/supabase';
import { Database } from '../types/database';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { AppState, Platform } from 'react-native';
import { clearRememberMeCredentials } from '../lib/secureStorage';

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
        console.log('clearAuthStorage: Cleared native key:', key);
      } catch (error) {
        // Key might not exist, that's fine
        console.log('clearAuthStorage: Key does not exist:', key);
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
  signedOutDueToInactivity: boolean;
  resetInactivitySignOutFlag: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// One week in milliseconds
const INACTIVITY_TIMEOUT = 7 * 24 * 60 * 60 * 1000;

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
  const [isExplicitSignOut, setIsExplicitSignOut] = useState(false);

  // Derived state: initial data is loaded when we're not loading and data has been fetched
  const initialDataLoaded = dataLoadingState === 'loaded';

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

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

  // Check for session activity whenever the app comes to foreground
  useEffect(() => {
    const checkActivity = async () => {
      if (session) {
        checkSessionActivity(session);
      }
    };
    
    // Add app state change listener for foreground/background transitions
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        checkActivity();
        // Update last activity timestamp when app comes to foreground
        if (session) {
          updateLastActivityTimestamp();
        }
      }
    });
    
    return () => {
      subscription.remove();
    };
  }, [session]);

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
            const businesses = businessRoles.map(role => role.businesses) as Business[];

            // Store roles in a map for quick lookup
            const rolesMap = new Map<string, 'admin' | 'staff'>();
            businessRoles.forEach(role => {
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

  const switchBusiness = useCallback(async (businessId: string) => {
    if (!user) return;

    const business = userBusinesses.find(b => b.id === businessId);
    if (!business) {
      console.error('Business not found:', businessId);
      return;
    }

    setCurrentBusiness(business);

    // Save preference to AsyncStorage
    try {
      await AsyncStorage.setItem(`currentBusiness_${user.id}`, businessId);
    } catch (error) {
      console.error('Error saving business preference:', error);
    }
  }, [user, userBusinesses]);

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