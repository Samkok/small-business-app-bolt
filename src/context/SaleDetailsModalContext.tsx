import React, { createContext, useContext, useState, useCallback, startTransition } from 'react';
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
  openSaleDetails: (saleId: string, notification?: Notification, markAsReadFn?: (id: string) => Promise<void>) => Promise<void>;
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
  const [switchState, setSwitchState] = useState<{
    loading: boolean;
    businessName?: string;
    error: { type: string; message: string } | null;
  }>({ loading: false, businessName: undefined, error: null });

  const { switchBusiness, refreshUserBusinesses, userBusinesses, currentBusiness } = useAuth();

  const openSaleDetails = useCallback(
    async (newSaleId: string, notification?: Notification, markAsReadFn?: (id: string) => Promise<void>) => {
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }

      // If notification is provided, handle business switching first
      if (notification) {
        const data = notification.data as any;
        const notificationBusinessName = data?.business_name;

        // Batch state update
        setSwitchState({
          loading: true,
          businessName: notificationBusinessName,
          error: null,
        });

        try {
          const switchResult = await handleBusinessSwitch(
            notification,
            currentBusiness,
            userBusinesses,
            switchBusiness,
            refreshUserBusinesses
          );

          if (!switchResult.success) {
            setSwitchState({
              loading: false,
              businessName: notificationBusinessName,
              error: {
                type: switchResult.error?.type || 'unknown',
                message: switchResult.error?.message || 'Failed to switch business',
              },
            });
            return;
          }

          // Business switched successfully
          setSwitchState({
            loading: false,
            businessName: undefined,
            error: null,
          });

          // Mark as read if function provided
          if (markAsReadFn && !notification.is_read) {
            markAsReadFn(notification.id).catch(err =>
              console.error('Failed to mark notification as read:', err)
            );
          }

          // Use startTransition for non-urgent modal opening
          startTransition(() => {
            setSaleId(newSaleId);
            setVisible(true);
          });
        } catch (err: any) {
          setSwitchState({
            loading: false,
            businessName: notificationBusinessName,
            error: {
              type: 'unknown',
              message: err?.message || 'An unexpected error occurred',
            },
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
    setSwitchState({
      loading: false,
      businessName: undefined,
      error: null,
    });
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
        visible={switchState.loading || switchState.error !== null}
        businessName={switchState.businessName}
        loading={switchState.loading}
        error={switchState.error}
        onDismiss={dismissSwitchError}
      />
    </SaleDetailsModalContext.Provider>
  );
};
