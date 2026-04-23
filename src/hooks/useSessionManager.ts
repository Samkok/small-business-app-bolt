import { useRef, useCallback } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../config/supabase';
import {
  clearAuthStorage,
  updateLastActivityTimestamp,
  getLastActivityTimestamp,
} from '../lib/authStorage';

// One week in milliseconds
const INACTIVITY_TIMEOUT = 7 * 24 * 60 * 60 * 1000;

interface UseSessionManagerOptions {
  setSession: (s: Session | null) => void;
  setUser: (u: Session['user'] | null) => void;
  userRef: React.MutableRefObject<Session['user'] | null>;
  onInvalidToken: () => Promise<void>;
  onInactivitySignOut: () => void;
}

export function isInvalidTokenError(error: any): boolean {
  if (!error) return false;
  const msg = (error.message ?? '').toLowerCase();
  const name = (error.name ?? '').toLowerCase();
  const indicators = [
    'invalid refresh token',
    'refresh token not found',
    'refresh token expired',
    'jwt expired',
    'invalid jwt',
    'token has expired',
    'authapieerror',
  ];
  return indicators.some(i => msg.includes(i) || name.includes(i));
}

export function useSessionManager({
  setSession,
  setUser,
  userRef,
  onInvalidToken,
  onInactivitySignOut,
}: UseSessionManagerOptions) {
  const isRefreshingRef = useRef(false);
  const recentlyAuthenticatedRef = useRef(false);
  const lastAuthTimeRef = useRef(0);

  const markRecentlyAuthenticated = useCallback(() => {
    recentlyAuthenticatedRef.current = true;
    lastAuthTimeRef.current = Date.now();
    setTimeout(() => {
      recentlyAuthenticatedRef.current = false;
    }, 60000);
  }, []);

  const refreshSessionIfNeeded = useCallback(async (): Promise<boolean> => {
    if (isRefreshingRef.current) return false;
    isRefreshingRef.current = true;

    try {
      const { data, error } = await supabase.auth.refreshSession();

      if (error) {
        console.error('Session refresh failed:', error.message);
        if (isInvalidTokenError(error)) {
          isRefreshingRef.current = false;
          await onInvalidToken();
          return false;
        }
        isRefreshingRef.current = false;
        return false;
      }

      if (data.session) {
        setSession(data.session);
        setUser(data.session.user);
        userRef.current = data.session.user;
        isRefreshingRef.current = false;
        return true;
      }

      isRefreshingRef.current = false;
      return false;
    } catch (error) {
      if (isInvalidTokenError(error)) {
        isRefreshingRef.current = false;
        await onInvalidToken();
        return false;
      }
      isRefreshingRef.current = false;
      return false;
    }
  }, [setSession, setUser, userRef, onInvalidToken]);

  const checkSessionActivity = useCallback(
    async (currentSession: Session) => {
      const timeSinceAuth = Date.now() - lastAuthTimeRef.current;
      if (recentlyAuthenticatedRef.current || timeSinceAuth < 60000) {
        const lastActivity = await getLastActivityTimestamp();
        if (!lastActivity) await updateLastActivityTimestamp();
        return;
      }

      const lastActivity = await getLastActivityTimestamp();

      if (lastActivity) {
        const elapsed = Date.now() - lastActivity;
        if (elapsed < 5000) return;

        if (elapsed > INACTIVITY_TIMEOUT) {
          onInactivitySignOut();
          await supabase.auth.signOut();
        }
      } else {
        await updateLastActivityTimestamp();
      }
    },
    [onInactivitySignOut],
  );

  return {
    refreshSessionIfNeeded,
    checkSessionActivity,
    markRecentlyAuthenticated,
    recentlyAuthenticatedRef,
    lastAuthTimeRef,
  };
}
