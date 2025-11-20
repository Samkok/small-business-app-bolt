import React, { createContext, useContext, useState, useCallback } from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from './AuthContext';
import { handleBusinessSwitch } from '../utils/notificationBusinessSwitch';
import { Database } from '../types/database';

type Notification = Database['public']['Tables']['notifications']['Row'];

interface BusinessSwitchContextData {
  loading: boolean;
  businessName?: string;
  error: { type: string; message: string } | null;
  handleNotificationNavigation: (notification: Notification, targetRoute: string) => Promise<void>;
  dismissError: () => void;
}

const BusinessSwitchContext = createContext<BusinessSwitchContextData>({} as BusinessSwitchContextData);

export const useBusinessSwitch = () => {
  const context = useContext(BusinessSwitchContext);
  if (!context) {
    throw new Error('useBusinessSwitch must be used within BusinessSwitchProvider');
  }
  return context;
};

export const BusinessSwitchProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const router = useRouter();
  const { switchBusiness, refreshUserBusinesses, userBusinesses, currentBusiness } = useAuth();
  const [loading, setLoading] = useState(false);
  const [businessName, setBusinessName] = useState<string | undefined>();
  const [error, setError] = useState<{ type: string; message: string } | null>(null);

  const handleNotificationNavigation = useCallback(async (
    notification: Notification,
    targetRoute: string
  ) => {
    const data = notification.data as any;
    const notificationBusinessName = data?.business_name;

    setLoading(true);
    setBusinessName(notificationBusinessName);
    setError(null);

    try {
      const switchResult = await handleBusinessSwitch(
        notification,
        currentBusiness,
        userBusinesses,
        switchBusiness,
        refreshUserBusinesses
      );

      setLoading(false);

      if (!switchResult.success) {
        setError({
          type: switchResult.error?.type || 'unknown',
          message: switchResult.error?.message || 'Failed to switch business',
        });
        return;
      }

      router.push(targetRoute as any);
    } catch (err: any) {
      setLoading(false);
      setError({
        type: 'unknown',
        message: err?.message || 'An unexpected error occurred',
      });
    }
  }, [currentBusiness, userBusinesses, switchBusiness, refreshUserBusinesses, router]);

  const dismissError = useCallback(() => {
    setError(null);
    setBusinessName(undefined);
  }, []);

  return (
    <BusinessSwitchContext.Provider
      value={{
        loading,
        businessName,
        error,
        handleNotificationNavigation,
        dismissError,
      }}
    >
      {children}
    </BusinessSwitchContext.Provider>
  );
};
