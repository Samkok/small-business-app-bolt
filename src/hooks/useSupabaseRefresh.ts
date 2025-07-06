import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { supabase } from '../config/supabase';

/**
 * Hook to refresh Supabase connection when app comes to foreground
 * This helps prevent stale connections when the app has been in the background for a while
 */
export function useSupabaseRefresh() {
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    
    return () => {
      subscription.remove();
    };
  }, []);

  const handleAppStateChange = async (nextAppState: AppStateStatus) => {
    // App has come to the foreground
    if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
      console.log('App has come to the foreground, refreshing Supabase connection');
      
      try {
        // Refresh the session
        const { data, error } = await supabase.auth.refreshSession();
        
        if (error) {
          console.error('Error refreshing session:', error);
        } else {
          console.log('Session refreshed successfully');
        }
      } catch (error) {
        console.error('Error in session refresh:', error);
      }
    }
    
    appState.current = nextAppState;
  };
}