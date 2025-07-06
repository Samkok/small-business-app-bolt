import { useEffect, useState } from 'react';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { Platform } from 'react-native';

/**
 * Hook to monitor network connectivity status
 * @returns Object containing network status information
 */
export function useNetworkStatus() {
  const [isConnected, setIsConnected] = useState<boolean | null>(true);
  const [connectionType, setConnectionType] = useState<string | null>(null);
  const [isInternetReachable, setIsInternetReachable] = useState<boolean | null>(true);
  const [details, setDetails] = useState<any>(null);

  useEffect(() => {
    // Skip for web platform as NetInfo might not be fully compatible
    if (Platform.OS === 'web') {
      return;
    }

    // Subscribe to network info updates
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsConnected(state.isConnected);
      setConnectionType(state.type);
      setIsInternetReachable(state.isInternetReachable);
      setDetails(state.details);
    });

    // Initial fetch
    NetInfo.fetch().then(state => {
      setIsConnected(state.isConnected);
      setConnectionType(state.type);
      setIsInternetReachable(state.isInternetReachable);
      setDetails(state.details);
    });

    // Unsubscribe when component unmounts
    return () => {
      unsubscribe();
    };
  }, []);

  return {
    isConnected,
    connectionType,
    isInternetReachable,
    details
  };
}

/**
 * Checks if the device is currently connected to the internet
 * @returns Promise resolving to a boolean indicating connectivity
 */
export async function checkNetworkConnectivity(): Promise<boolean> {
  // For web platform, use navigator.onLine
  if (Platform.OS === 'web') {
    return navigator.onLine;
  }
  
  // For native platforms, use NetInfo
  try {
    const state = await NetInfo.fetch();
    return !!state.isConnected && !!state.isInternetReachable;
  } catch (error) {
    console.error('Error checking network connectivity:', error);
    return false;
  }
}

/**
 * Utility to handle network-dependent operations with retry logic
 * @param operation Function to execute
 * @param options Configuration options
 * @returns Promise resolving to the operation result
 */
export async function withNetworkRetry<T>(
  operation: () => Promise<T>,
  options: {
    maxRetries?: number;
    retryDelay?: number;
    onRetry?: (attempt: number, error: any) => void;
    onSuccess?: (result: T) => void;
    onError?: (error: any) => void;
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    retryDelay = 1000,
    onRetry,
    onSuccess,
    onError
  } = options;
  
  let attempts = 0;
  
  while (attempts <= maxRetries) {
    try {
      // Check network connectivity before attempting operation
      const isConnected = await checkNetworkConnectivity();
      
      if (!isConnected && attempts < maxRetries) {
        console.warn(`No network connection. Retry attempt ${attempts + 1}/${maxRetries}`);
        attempts++;
        
        if (onRetry) {
          onRetry(attempts, new Error('No network connection'));
        }
        
        // Wait before retrying with exponential backoff
        await new Promise(resolve => 
          setTimeout(resolve, retryDelay * Math.pow(2, attempts - 1))
        );
        continue;
      }
      
      // Execute the operation
      const result = await operation();
      
      if (onSuccess) {
        onSuccess(result);
      }
      
      return result;
    } catch (error) {
      console.error(`Operation failed (attempt ${attempts + 1}/${maxRetries + 1}):`, error);
      
      if (attempts >= maxRetries) {
        if (onError) {
          onError(error);
        }
        throw error;
      }
      
      attempts++;
      
      if (onRetry) {
        onRetry(attempts, error);
      }
      
      // Wait before retrying with exponential backoff
      await new Promise(resolve => 
        setTimeout(resolve, retryDelay * Math.pow(2, attempts - 1))
      );
    }
  }
  
  // This should never be reached due to the throw in the catch block
  throw new Error('Maximum retry attempts exceeded');
}