import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { Platform } from 'react-native';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';

interface NetworkContextType {
  isConnected: boolean;
  wasOffline: boolean;
  pendingSalesCount: number;
  setPendingSalesCount: (count: number) => void;
  clearWasOffline: () => void;
  checkConnection: () => Promise<boolean>;
}

const NetworkContext = createContext<NetworkContextType>({
  isConnected: true,
  wasOffline: false,
  pendingSalesCount: 0,
  setPendingSalesCount: () => {},
  clearWasOffline: () => {},
  checkConnection: async () => true,
});

export function NetworkProvider({ children }: { children: React.ReactNode }) {
  const [isConnected, setIsConnected] = useState(true);
  const [wasOffline, setWasOffline] = useState(false);
  const [pendingSalesCount, setPendingSalesCount] = useState(0);
  const wasOfflineTimerRef = useRef<NodeJS.Timeout | null>(null);
  const prevConnectedRef = useRef(true);

  const clearWasOffline = useCallback(() => {
    setWasOffline(false);
  }, []);

  const checkConnection = useCallback(async (): Promise<boolean> => {
    if (Platform.OS === 'web') {
      return typeof navigator !== 'undefined' ? navigator.onLine : true;
    }
    const state = await NetInfo.fetch();
    return state.isConnected ?? true;
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const handleOnline = () => {
        console.log('[Network] Back online');
        setIsConnected(true);
        setWasOffline(true);
        prevConnectedRef.current = true;

        if (wasOfflineTimerRef.current) {
          clearTimeout(wasOfflineTimerRef.current);
        }
        wasOfflineTimerRef.current = setTimeout(() => {
          setWasOffline(false);
        }, 4000);
      };

      const handleOffline = () => {
        console.log('[Network] Gone offline');
        setIsConnected(false);
        prevConnectedRef.current = false;
      };

      setIsConnected(navigator.onLine);
      prevConnectedRef.current = navigator.onLine;

      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);

      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
        if (wasOfflineTimerRef.current) {
          clearTimeout(wasOfflineTimerRef.current);
        }
      };
    } else {
      // Mobile: use NetInfo
      const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
        const connected = state.isConnected ?? true;

        if (connected && !prevConnectedRef.current) {
          console.log('[Network] Back online (mobile)');
          setWasOffline(true);
          if (wasOfflineTimerRef.current) {
            clearTimeout(wasOfflineTimerRef.current);
          }
          wasOfflineTimerRef.current = setTimeout(() => {
            setWasOffline(false);
          }, 4000);
        } else if (!connected && prevConnectedRef.current) {
          console.log('[Network] Gone offline (mobile)');
        }

        prevConnectedRef.current = connected;
        setIsConnected(connected);
      });

      // Fetch initial state
      NetInfo.fetch().then((state: NetInfoState) => {
        const connected = state.isConnected ?? true;
        setIsConnected(connected);
        prevConnectedRef.current = connected;
      });

      return () => {
        unsubscribe();
        if (wasOfflineTimerRef.current) {
          clearTimeout(wasOfflineTimerRef.current);
        }
      };
    }
  }, []);

  return (
    <NetworkContext.Provider value={{
      isConnected,
      wasOffline,
      pendingSalesCount,
      setPendingSalesCount,
      clearWasOffline,
      checkConnection,
    }}>
      {children}
    </NetworkContext.Provider>
  );
}

export function useNetwork() {
  return useContext(NetworkContext);
}
