import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../config/supabase';
import { Session, User } from '@supabase/supabase-js';
import { Database } from '../types/database';

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
const INACTIVITY_TIMEOUT = 7 * 24 * 60 * 60 * 1000;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [signedOutDueToInactivity, setSignedOutDueToInactivity] = useState(false);
  const [isExplicitSignOut, setIsExplicitSignOut] = useState(false);

  const handleSessionChange = useCallback(
    async (session: Session | null) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        await updateLastActivityTimestamp();
        await loadProfile(session.user.id);
      } else {
        setProfile(null);
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    const initSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        await checkSessionActivity(data.session);
      }
      await handleSessionChange(data.session);
    };
    initSession();
  }, [handleSessionChange]);

  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT' && !isExplicitSignOut) {
        setSignedOutDueToInactivity(true);
      }

      if (event === 'SIGNED_IN') {
        setSignedOutDueToInactivity(false);
        await updateLastActivityTimestamp();
      }

      setIsExplicitSignOut(false);
      await handleSessionChange(session);
    });

    return () => {
      authListener?.subscription?.unsubscribe();
    };
  }, [handleSessionChange, isExplicitSignOut]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (state) => {
      if (state === 'active' && session) {
        await checkSessionActivity(session);
        await updateLastActivityTimestamp();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [session]);

  useEffect(() => {
    if (loading) {
      const timeout = setTimeout(() => {
        setLoading(false);
      }, 10000);
      return () => clearTimeout(timeout);
    }
  }, [loading]);

  const checkSessionActivity = async (currentSession: Session) => {
    try {
      const lastActivity = await AsyncStorage.getItem('lastActivityTimestamp');
      if (!lastActivity) return await updateLastActivityTimestamp();

      const lastTime = parseInt(lastActivity, 10);
      const now = Date.now();
      if (now - lastTime > INACTIVITY_TIMEOUT) {
        setSignedOutDueToInactivity(true);
        await supabase.auth.signOut();
      }
    } catch (err) {
      console.error('Failed to check session activity:', err);
    }
  };

  const updateLastActivityTimestamp = async () => {
    try {
      await AsyncStorage.setItem('lastActivityTimestamp', Date.now().toString());
    } catch (err) {
      console.error('Failed to update activity timestamp:', err);
    }
  };

  const loadProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      console.log("AuthContext: Profile Data: ", data);

      if (error && error.code !== 'PGRST116') {
        console.error('Profile load error:', error);
      }

      setProfile(data ?? null);
    } catch (err) {
      console.error('Unexpected error loading profile:', err);
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signUp = async (email: string, password: string, businessName: string, fullName: string) => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error || !data.user) return { error };

    const { error: profileError } = await supabase.from('profiles').insert({
      user_id: data.user.id,
      business_name: businessName,
      full_name: fullName,
      role: 'admin',
    });

    return { error: profileError };
  };

  const signOut = async () => {
    setIsExplicitSignOut(true);
    await AsyncStorage.removeItem('rememberMe');
    await supabase.auth.signOut();
  };

  const updateProfile = async (updates: Partial<Profile>) => {
    if (!user) return { error: new Error('No user') };
    const { error } = await supabase.from('profiles').update(updates).eq('user_id', user.id);
    if (!error && profile) setProfile({ ...profile, ...updates });
    return { error };
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window?.location?.origin}/reset-password`,
    });
    return { error };
  };

  const updatePassword = async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password });
    return { error };
  };

  const resetInactivitySignOutFlag = () => setSignedOutDueToInactivity(false);

  const value: AuthContextType = {
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

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
