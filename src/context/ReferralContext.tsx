import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { referralService, ReferralDashboardData, CreditBalance, ReferralStats } from '@/src/services/referralService';
import { useAuth } from './AuthContext';

interface ReferralContextType {
  isLoading: boolean;
  dashboardData: ReferralDashboardData | null;
  referralCode: string | null;
  creditBalance: number;
  stats: ReferralStats | null;
  refreshDashboard: () => Promise<void>;
  shareReferralLink: () => Promise<boolean>;
  claimReferralCode: (code: string) => Promise<{ success: boolean; referrer_name?: string }>;
}

const ReferralContext = createContext<ReferralContextType>({
  isLoading: false,
  dashboardData: null,
  referralCode: null,
  creditBalance: 0,
  stats: null,
  refreshDashboard: async () => {},
  shareReferralLink: async () => false,
  claimReferralCode: async () => ({ success: false }),
});

export function useReferral() {
  return useContext(ReferralContext);
}

export function ReferralProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [dashboardData, setDashboardData] = useState<ReferralDashboardData | null>(null);

  const refreshDashboard = useCallback(async () => {
    if (!user) {
      setDashboardData(null);
      return;
    }

    setIsLoading(true);
    try {
      const data = await referralService.getDashboardData();
      setDashboardData(data);
    } catch (error) {
      console.error('[ReferralContext] Failed to refresh:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  const shareReferralLink = useCallback(async (): Promise<boolean> => {
    const code = dashboardData?.code;
    if (!code) {
      const newCode = await referralService.getReferralCode();
      if (newCode) {
        await refreshDashboard();
        return await referralService.shareReferralLink(newCode);
      }
      return false;
    }
    return await referralService.shareReferralLink(code);
  }, [dashboardData, refreshDashboard]);

  const claimReferralCode = useCallback(async (code: string) => {
    const result = await referralService.claimReferral(code);
    if (result.success) {
      await refreshDashboard();
    }
    return result;
  }, [refreshDashboard]);

  useEffect(() => {
    if (user) {
      refreshDashboard();
    } else {
      setDashboardData(null);
    }
  }, [user, refreshDashboard]);

  const value: ReferralContextType = {
    isLoading,
    dashboardData,
    referralCode: dashboardData?.code || null,
    creditBalance: dashboardData?.balance?.current || 0,
    stats: dashboardData?.stats || null,
    refreshDashboard,
    shareReferralLink,
    claimReferralCode,
  };

  return (
    <ReferralContext.Provider value={value}>
      {children}
    </ReferralContext.Provider>
  );
}
