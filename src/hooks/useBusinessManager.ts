import { useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../config/supabase';
import { dataCleanupRegistry } from '../utils/dataCleanupRegistry';
import { notificationCleanupService } from '../utils/notificationCleanup';
import {
  businessAccessHistoryService,
  BusinessAccessHistory,
} from '../utils/businessAccessHistory';
import type { Business } from '../context/authTypes';

export function selectBestAvailableBusiness(
  removedBusinessId: string,
  availableBusinesses: Business[],
  accessHistory: BusinessAccessHistory,
): Business | null {
  const candidates = availableBusinesses.filter(b => b.id !== removedBusinessId);
  if (candidates.length === 0) return null;
  return candidates
    .map(business => ({ business, lastAccess: accessHistory[business.id] || 0 }))
    .sort((a, b) => b.lastAccess - a.lastAccess)[0].business;
}

export function businessArraysEqual(arr1: Business[], arr2: Business[]): boolean {
  if (arr1.length !== arr2.length) return false;
  const sorted1 = [...arr1].sort((a, b) => a.id.localeCompare(b.id));
  const sorted2 = [...arr2].sort((a, b) => a.id.localeCompare(b.id));
  return sorted1.every(
    (b1, i) =>
      b1.id === sorted2[i].id && (b1 as any).access_state === (sorted2[i] as any).access_state,
  );
}

interface UseBusinessManagerOptions {
  userId: string | undefined;
  userBusinessesRef: React.MutableRefObject<Business[]>;
  businessAccessHistoryRef: React.MutableRefObject<BusinessAccessHistory>;
  setCurrentBusiness: (b: Business | null) => void;
  setBusinessAccessHistory: (h: BusinessAccessHistory) => void;
}

export function useBusinessManager({
  userId,
  userBusinessesRef,
  businessAccessHistoryRef,
  setCurrentBusiness,
  setBusinessAccessHistory,
}: UseBusinessManagerOptions) {
  const switchBusiness = useCallback(
    async (businessId: string) => {
      if (!userId) return;

      const business = userBusinessesRef.current.find(b => b.id === businessId);
      if (!business) {
        console.error('Business not found:', businessId);
        return;
      }

      await dataCleanupRegistry.cleanupAll();
      setCurrentBusiness(business);

      try {
        await AsyncStorage.setItem(`currentBusiness_${userId}`, businessId);
      } catch (error) {
        console.error('Error saving business preference:', error);
      }

      try {
        await businessAccessHistoryService.updateAccess(businessId);
        const updatedHistory = await businessAccessHistoryService.getHistory();
        setBusinessAccessHistory(updatedHistory);
        businessAccessHistoryRef.current = updatedHistory;
      } catch (error) {
        console.error('Error updating business access history:', error);
      }
    },
    [userId, userBusinessesRef, businessAccessHistoryRef, setCurrentBusiness, setBusinessAccessHistory],
  );

  const determineCurrentBusiness = async (
    uid: string,
    businesses: Business[],
    existingCurrentBusiness: Business | null,
  ): Promise<Business | null> => {
    try {
      if (existingCurrentBusiness) {
        if (businesses.find(b => b.id === existingCurrentBusiness.id)) {
          return existingCurrentBusiness;
        }
      }

      const savedBusinessId = await AsyncStorage.getItem(`currentBusiness_${uid}`);
      if (savedBusinessId && businesses.length > 0) {
        const business = businesses.find(b => b.id === savedBusinessId);
        if (business) return business;
      }

      return businesses.length > 0 ? businesses[0] : null;
    } catch (error) {
      console.error('Error in determineCurrentBusiness:', error);
      if (existingCurrentBusiness && businesses.some(b => b.id === existingCurrentBusiness.id)) {
        return existingCurrentBusiness;
      }
      return businesses.length > 0 ? businesses[0] : null;
    }
  };

  const shouldAutoRedirectOnAssignment = useCallback(
    (routeSegments: string[], hasCurrentBusiness: boolean): boolean => {
      const currentRoute = routeSegments[routeSegments.length - 1];
      const isInTabs = routeSegments.includes('(tabs)');

      if (currentRoute === 'business-onboarding') return true;
      if (currentRoute === 'business-selection' && !hasCurrentBusiness) return true;
      if (isInTabs && !hasCurrentBusiness) return true;
      return false;
    },
    [],
  );

  const cleanupRemovedBusiness = useCallback((businessId: string) => {
    notificationCleanupService.cleanup(businessId);
    dataCleanupRegistry.cleanupForRemovedBusiness(businessId);
    businessAccessHistoryService.removeBusinessFromHistory(businessId);
  }, []);

  return {
    switchBusiness,
    determineCurrentBusiness,
    shouldAutoRedirectOnAssignment,
    cleanupRemovedBusiness,
  };
}

export async function fetchUserBusinesses(userId: string): Promise<{
  businesses: Business[];
  rolesMap: Map<string, 'admin' | 'staff'>;
} | null> {
  const { data: businessRoles, error } = await supabase
    .from('user_business_roles')
    .select(
      `
      business_id,
      role,
      businesses:business_id(*)
    `,
    )
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  if (!businessRoles) return null;

  const businesses = businessRoles.map((role: any) => role.businesses) as Business[];
  const rolesMap = new Map<string, 'admin' | 'staff'>();
  businessRoles.forEach((role: any) => {
    rolesMap.set(role.business_id, role.role as 'admin' | 'staff');
  });

  return { businesses, rolesMap };
}
