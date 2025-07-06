import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../config/supabase';
import { Database } from '../types/database';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';

type Profile = Database['public']['Tables']['profiles']['Row'];

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, businessName: string, fullName: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<{ error: any }>;
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
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [signedOutDueToInactivity, setSignedOutDueToInactivity] = useState(false);
  const [isExplicitSignOut, setIsExplicitSignOut] = useState(false);
  
  // Add a safety timeout to prevent the app from being stuck in loading state
  useEffect(() => {
    if (loading) {
      // Set a maximum loading time of 10 seconds
      const MAX_LOADING_TIME = 10000; // 10 seconds
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
        console.log('Initial session: Loading profile for user:', session.user.id);
        loadProfile(session.user.id);
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
          await loadProfile(session.user.id);
        } else {
          console.log("AuthContext: NO SESSION");
          setProfile(null);
          setLoading(false);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

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

  const loadProfile = async (userId: string) => {
    console.log('loadProfile started for user:', userId);
    try {
      // Retry configuration
      const MAX_RETRIES = 3;
      const INITIAL_DELAY_MS = 500;
      console.log(`Profile loading config: ${MAX_RETRIES} retries with initial delay of ${INITIAL_DELAY_MS}ms`);
      let lastError = null;
      
      // Try to load profile with retries
      for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
          // Attempt to fetch the profile
          console.log(`Profile loading attempt ${attempt + 1}/${MAX_RETRIES} for user ${userId}`);
          const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('user_id', userId)
            .single();

          console.log(`Attempt ${attempt + 1}: Supabase profile query result - Data:`, data);
          console.log(`Attempt ${attempt + 1}: Supabase profile query result - Error:`, error);
            
          if (error) {
            // Store the error but don't throw yet (unless it's the last attempt)
            lastError = error;
            console.warn(`Profile loading attempt ${attempt + 1}/${MAX_RETRIES} failed:`, error);
            
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
          
          // If we got here, the request succeeded
          if (data) {
            console.log('Profile loaded successfully:', data.id);
            setProfile(data);
            setLoading(false);
            return; // Exit the function early on success
          } else {
            console.log('No profile found for user:', userId);
            setProfile(null);
            setLoading(false);
            return; // Exit the function early
          }
        } catch (retryError) {
          // Store the error for the final attempt
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
        console.error('All profile loading attempts failed:', lastError);
        setProfile(null);
        setLoading(false);
        return;
      }
    } catch (error: any) {
      console.error('Error in loadProfile:', error);
      setProfile(null);
      setLoading(false);
      return;
    }
    
    // Always set loading to false when done
    console.log('loadProfile completed, setting loading to false');
    setLoading(false);
  };

  // Original loadProfile function (commented out)
  /*
  const loadProfile = async (userId: string) => {
    console.log('loadProfile started for user:', userId);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading profile:', error);
      } else if (data) {
        console.log('Profile loaded successfully:', data.id);
        setProfile(data);
      } else {
        console.log('No profile found for user:', userId);
        setProfile(null);
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      console.log('loadProfile completed, setting loading to false');
      setLoading(false);
    }
  };
  */

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
      // Create profile
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          user_id: data.user.id,
          business_name: businessName,
          full_name: fullName,
          role: 'admin',
        });

      if (profileError) {
        console.error('Error creating profile:', profileError);
        return { error: profileError };
      }
    }

    return { error: null };
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

  const updateProfile = async (updates: Partial<Profile>) => {
    if (!user) return { error: new Error('No user') };

    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('user_id', user.id);

    if (!error && profile) {
      setProfile({ ...profile, ...updates });
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
    profile,
    loading,
    signIn,
    signUp,
    signOut,
    updateProfile,
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