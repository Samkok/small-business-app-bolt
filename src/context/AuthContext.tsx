import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../config/supabase';
import { Database } from '../types/database';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';

type UserProfile = Database['public']['Tables']['user_profiles']['Row'];
type Business = Database['public']['Tables']['businesses']['Row'];
type UserBusinessRole = Database['public']['Tables']['user_business_roles']['Row'];

interface AuthContextType {
  session: Session | null;
  user: User | null;
  userProfile: UserProfile | null;
  userBusinesses: Business[];
  currentBusiness: Business | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, businessName: string, fullName: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  updateUserProfile: (updates: Partial<UserProfile>) => Promise<{ error: any }>;
  updateBusiness: (businessId: string, updates: Partial<Business>) => Promise<{ error: any }>;
  switchBusiness: (businessId: string) => Promise<void>;
  createBusiness: (businessName: string) => Promise<{ error: any, business?: Business }>;
  resetPassword: (email: string) => Promise<{ error: any }>;
  updatePassword: (password: string) => Promise<{ error: any }>;
  signedOutDueToInactivity: boolean;
  resetInactivitySignOutFlag: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// One week in milliseconds
const INACTIVITY_TIMEOUT = 7 * 24 * 60 * 60 * 1000;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [userBusinesses, setUserBusinesses] = useState<Business[]>([]);
  const [currentBusiness, setCurrentBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);
  const [signedOutDueToInactivity, setSignedOutDueToInactivity] = useState(false);
  const [isExplicitSignOut, setIsExplicitSignOut] = useState(false);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      // Check if session exists and if it's expired due to inactivity
      console.log('Initial getSession result:', session ? 'Session exists' : 'No session');
      if (session) {
        console.log('Initial session user ID:', session.user.id);
        checkSessionActivity(session);
      }
      
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        console.log('Initial session: Loading auth data for user:', session.user.id);
        loadAuthData(session.user.id);
      } else {
        console.log('Initial session: No user, setting loading to false');
        setLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state change:', event);
        console.log('AuthContext: Session object on auth state change:', session);
        
        if (event === 'SIGNED_OUT' && !isExplicitSignOut) {
          // If signed out but not explicitly by the user, it was due to inactivity
          setSignedOutDueToInactivity(true);
        }
        
        if (event === 'SIGNED_IN') {
          // Reset the inactivity flag when user signs in
          setSignedOutDueToInactivity(false);
          
          // Update last activity timestamp
          await updateLastActivityTimestamp();
        }
        
        // Reset the explicit sign out flag
        setIsExplicitSignOut(false);
        
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          loadAuthData(session.user.id);
        } else {
          console.log("AuthContext: NO SESSION");
          setUserProfile(null);
          setUserBusinesses([]);
          setCurrentBusiness(null);
          setLoading(false);
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
      console.log('Setting safety timeout for auth loading state:', MAX_LOADING_TIME, 'ms');
      const safetyTimeout = setTimeout(() => {
        console.log('Auth loading safety timeout reached after', MAX_LOADING_TIME, 'ms');
        setLoading(false);
      }, MAX_LOADING_TIME);

      return () => {
        clearTimeout(safetyTimeout);
        console.log('Auth loading safety timeout cleared');
      };
    }
  }, [loading]);

  // Load saved current business ID from AsyncStorage
  const determineCurrentBusiness = async (userId: string, businesses: Business[]): Promise<Business | null> => {
    try {
      const savedBusinessId = await AsyncStorage.getItem(`currentBusiness_${userId}`);
      if (savedBusinessId && businesses.length > 0) {
        const business = businesses.find(b => b.id === savedBusinessId);
        if (business) {
          return business;
        }
      }
      
      // If no saved business or saved business not found, use the first one
      if (businesses.length > 0) {
        return businesses[0];
      }
      
      return null;
    } catch (error) {
      console.error('Error loading saved business ID:', error);
      // Default to first business if there's an error
      if (businesses.length > 0) {
        return businesses[0];
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

  const loadAuthData = async (userId: string) => {
    console.log('loadAuthData started for user:', userId);
    try {
      // Retry configuration
      const MAX_RETRIES = 3;
      const INITIAL_DELAY_MS = 500;
      console.log(`Auth data loading config: ${MAX_RETRIES} retries with initial delay of ${INITIAL_DELAY_MS}ms`);
      let lastError = null;
      
      // Try to load user profile with retries
      for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
          // Attempt to fetch the user profile
          console.log(`User profile loading attempt ${attempt + 1}/${MAX_RETRIES} for user ${userId}`);
          const { data, error } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('user_id', userId)
            .single();

          console.log("Data return: ", data);
            
          if (error) {
            // Store the error but don't throw yet (unless it's the last attempt)
            lastError = error;
            console.warn(`User profile loading attempt ${attempt + 1}/${MAX_RETRIES} failed:`, error);
            
            // If it's not the last attempt, wait with exponential backoff before retrying
            if (attempt < MAX_RETRIES - 1) {
              const delayMs = INITIAL_DELAY_MS * Math.pow(2, attempt);
              console.log(`Retrying in ${delayMs}ms...`);
              await new Promise(resolve => setTimeout(resolve, delayMs));
              continue;
            }
            
            // On the last attempt, if there's an error, we'll handle it below
            throw error;
          }
          
          // If we got here, the user profile request succeeded
          if (data) {
            console.log('User profile loaded successfully:', data.user_id);
            setUserProfile(data);
            
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
            console.log(`Loaded ${businesses.length} businesses for user:`, userId);
            setUserBusinesses(businesses);
            
            // Determine and set current business (either from saved preference or first in list)
            const determinedBusiness = await determineCurrentBusiness(userId, businesses);
            setCurrentBusiness(determinedBusiness);
            
            setLoading(false);
            return; // Exit the function early on success
          } else {
            console.log('No user profile found for user:', userId);
            setUserProfile(null);
            setUserBusinesses([]);
            setCurrentBusiness(null);
            setLoading(false);
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
        setUserProfile(null);
        setUserBusinesses([]);
        setCurrentBusiness(null);
        setLoading(false);
        return;
      }
    } catch (error: any) {
      console.error('Error in loadAuthData:', error);
      setUserProfile(null);
      setUserBusinesses([]);
      setCurrentBusiness(null);
      setLoading(false);
      return;
    }
    
    // Always set loading to false when done
    console.log('loadAuthData completed, setting loading to false');
    setLoading(false);
  };

  // Original loadProfile function (commented out)

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signUp = async (email: string, password: string, businessName: string, fullName: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) return { error };

    if (data.user) {
      try {
        // Create user profile
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

        // Create business
        const { data: businessData, error: businessError } = await supabase
          .rpc('create_business', {
            business_name_param: businessName,
            owner_user_id_param: data.user.id
          });

        if (businessError) {
          console.error('Error creating business:', businessError);
          return { error: businessError };
        }

        return { error: null };
      } catch (createError) {
        console.error('Error in signup process:', createError);
        return { error: createError };
      }
    }

    return { error: null };
  };

  const createBusiness = async (businessName: string) => {
    if (!user) {
      return { error: new Error('No authenticated user') };
    }

    try {
      // Call the RPC function to create a new business
      const { data: businessId, error } = await supabase
        .rpc('create_business', {
          business_name_param: businessName
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
  };

  const switchBusiness = async (businessId: string) => {
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
  };

  const signOut = async () => {
    // Set flag to indicate this is an explicit sign out
    setIsExplicitSignOut(true);
    
    // Clear any saved credentials
    try {
      await AsyncStorage.removeItem('rememberMe');
      // Don't remove savedEmail here to allow it to persist if user wants to sign in again
    } catch (error) {
      console.error('Error clearing saved credentials:', error);
    }
    
    // Sign out from Supabase
    await supabase.auth.signOut();
  };

  const updateUserProfile = async (updates: Partial<UserProfile>) => {
    if (!user) return { error: new Error('No user') };

    const { error } = await supabase
      .from('user_profiles')
      .update(updates)
      .eq('user_id', user.id);

    if (!error && userProfile) {
      setUserProfile({ ...userProfile, ...updates });
    }

    return { error };
  };

  const updateBusiness = async (businessId: string, updates: Partial<Business>) => {
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
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + '/reset-password',
    });
    return { error };
  };

  const updatePassword = async (password: string) => {
    const { error } = await supabase.auth.updateUser({
      password,
    });
    return { error };
  };

  const value = {
    session,
    user,
    userProfile,
    userBusinesses,
    currentBusiness,
    loading,
    signIn,
    signUp,
    signOut,
    updateUserProfile,
    updateBusiness,
    switchBusiness,
    createBusiness,
    resetPassword,
    updatePassword,
    signedOutDueToInactivity,
    resetInactivitySignOutFlag,
  };

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