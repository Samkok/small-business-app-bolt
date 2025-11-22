import React, { createContext, useContext, useState, useCallback } from 'react';
import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useAuth } from './AuthContext';
import { handleBusinessSwitch } from '../utils/notificationBusinessSwitch';
import { Database } from '../types/database';
import SaleDetailsModal from '../components/sales/SaleDetailsModal';
import BusinessSwitchLoadingModal from '../components/notifications/BusinessSwitchLoadingModal';

type Notification = Database['public']['Tables']['notifications']['Row'];

interface SaleDetailsModalContextData {
  visible: boolean;
  saleId: string | null;
  openSaleDetails: (saleId: string, notification?: Notification) => Promise<void>;
  closeSaleDetails: () => void;
}

const SaleDetailsModalContext = createContext<SaleDetailsModalContextData>(
  {} as SaleDetailsModalContextData
);

export const useSaleDetailsModal = () => {
  const context = useContext(SaleDetailsModalContext);
  if (!context) {
    throw new Error('useSaleDetailsModal must be used within SaleDetailsModalProvider');
  }
  return context;
};

export const SaleDetailsModalProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [visible, setVisible] = useState(false);
  const [saleId, setSaleId] = useState<string | null>(null);
  const [switchLoading, setSwitchLoading] = useState(false);
  const [switchBusinessName, setSwitchBusinessName] = useState<string | undefined>();
  const [switchError, setSwitchError] = useState<{ type: string; message: string } | null>(null);

  const { switchBusiness, refreshUserBusinesses, userBusinesses, currentBusiness } = useAuth();

  const openSaleDetails = useCallback(
    async (newSaleId: string, notification?: Notification) => {
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }

      // If notification is provided, handle business switching first
      if (notification) {
        const data = notification.data as any;
        const notificationBusinessName = data?.business_name;

        setSwitchLoading(true);
        setSwitchBusinessName(notificationBusinessName);
        setSwitchError(null);

        try {
          const switchResult = await handleBusinessSwitch(
            notification,
            currentBusiness,
            userBusinesses,
            switchBusiness,
            refreshUserBusinesses
          );

          setSwitchLoading(false);

          if (!switchResult.success) {
            setSwitchError({
              type: switchResult.error?.type || 'unknown',
              message: switchResult.error?.message || 'Failed to switch business',
            });
            return;
          }

          // Business switched successfully or already on correct business
          // Add a small delay to ensure business context is updated
          setTimeout(() => {
            setSaleId(newSaleId);
            setVisible(true);
          }, 100);
        } catch (err: any) {
          setSwitchLoading(false);
          setSwitchError({
            type: 'unknown',
            message: err?.message || 'An unexpected error occurred',
          });
        }
      } else {
        // No notification, just open the modal directly
        setSaleId(newSaleId);
        setVisible(true);
      }
    },
    [currentBusiness, userBusinesses, switchBusiness, refreshUserBusinesses]
  );

  const closeSaleDetails = useCallback(() => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setVisible(false);
    // Clear saleId after animation completes
    setTimeout(() => {
      setSaleId(null);
    }, 300);
  }, []);

  const dismissSwitchError = useCallback(() => {
    setSwitchError(null);
    setSwitchBusinessName(undefined);
  }, []);

  return (
    <SaleDetailsModalContext.Provider
      value={{
        visible,
        saleId,
        openSaleDetails,
        closeSaleDetails,
      }}
    >
      {children}

      {/* Sale Details Modal */}
      <SaleDetailsModal
        visible={visible}
        saleId={saleId}
        onClose={closeSaleDetails}
      />

      {/* Business Switch Loading Modal */}
      <BusinessSwitchLoadingModal
        visible={switchLoading || switchError !== null}
        businessName={switchBusinessName}
        loading={switchLoading}
        error={switchError}
        onDismiss={dismissSwitchError}
      />
    </SaleDetailsModalContext.Provider>
  );
};
