import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { Platform } from 'react-native';

interface NetworkContextType {
  isConnected: boolean;
  wasOffline: boolean;
  clearWasOffline: () => void;
}

const NetworkContext = createContext<NetworkContextType>({
  isConnected: true,
  wasOffline: false,
  clearWasOffline: () => {},
});

export function NetworkProvider({ children }: { children: React.ReactNode }) {
  const [isConnected, setIsConnected] = useState(true);
  const [wasOffline, setWasOffline] = useState(false);
  const wasOfflineTimerRef = useRef<NodeJS.Timeout | null>(null);

  const clearWasOffline = useCallback(() => {
    setWasOffline(false);
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const handleOnline = () => {
        console.log('[Network] Back online');
        setIsConnected(true);
        setWasOffline(true);

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
      };

      setIsConnected(navigator.onLine);

      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);

      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
        if (wasOfflineTimerRef.current) {
          clearTimeout(wasOfflineTimerRef.current);
        }
      };
    }
  }, []);

  return (
    <NetworkContext.Provider value={{ isConnected, wasOffline, clearWasOffline }}>
      {children}
    </NetworkContext.Provider>
  );
}

export function useNetwork() {
  return useContext(NetworkContext);
}
