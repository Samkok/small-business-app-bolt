import React, { useEffect, useState } from 'react';
import { Platform, Alert } from 'react-native';
import {
  presentPaywall,
  presentPaywallIfNeeded,
  PaywallResult,
} from 'react-native-purchases-ui';
import { useTranslation } from 'react-i18next';
import { revenueCatService } from '@/src/services/revenueCatService';
import { Paywall as CustomPaywall } from './Paywall';

interface RevenueCatPaywallProps {
  visible: boolean;
  onClose: () => void;
  canClose?: boolean;
  requiredEntitlementIdentifier?: string;
  onPurchaseSuccess?: () => void;
  onPurchaseError?: (error: Error) => void;
}

export const RevenueCatPaywall: React.FC<RevenueCatPaywallProps> = ({
  visible,
  onClose,
  canClose = true,
  requiredEntitlementIdentifier,
  onPurchaseSuccess,
  onPurchaseError,
}) => {
  const { t } = useTranslation();
  const [showingNativePaywall, setShowingNativePaywall] = useState(false);

  useEffect(() => {
    if (visible && !showingNativePaywall && Platform.OS !== 'web') {
      handleShowPaywall();
    }
  }, [visible]);

  const handleShowPaywall = async () => {
    if (Platform.OS === 'web') {
      return;
    }

    try {
      setShowingNativePaywall(true);

      const result: PaywallResult = await presentPaywall({
        requiredEntitlementIdentifier,
      });

      console.log('[RevenueCatPaywall] Paywall result:', result);

      switch (result) {
        case PaywallResult.PURCHASED:
        case PaywallResult.RESTORED:
          Alert.alert(
            t('subscription.alerts.purchaseSuccessTitle'),
            t('subscription.alerts.purchaseSuccessMessage'),
            [
              {
                text: t('common.done'),
                onPress: () => {
                  onPurchaseSuccess?.();
                  onClose();
                },
              },
            ]
          );
          break;

        case PaywallResult.CANCELLED:
          console.log('[RevenueCatPaywall] User cancelled paywall');
          onClose();
          break;

        case PaywallResult.ERROR:
          console.error('[RevenueCatPaywall] Paywall error');
          Alert.alert(
            t('subscription.alerts.purchaseErrorTitle'),
            t('subscription.alerts.purchaseErrorMessage'),
            [{ text: t('common.ok') }]
          );
          onClose();
          break;

        case PaywallResult.NOT_PRESENTED:
          console.log('[RevenueCatPaywall] Paywall not presented');
          onClose();
          break;
      }
    } catch (error) {
      console.error('[RevenueCatPaywall] Error showing paywall:', error);
      onPurchaseError?.(error as Error);
      onClose();
    } finally {
      setShowingNativePaywall(false);
    }
  };

  if (Platform.OS === 'web') {
    return (
      <CustomPaywall
        visible={visible}
        onClose={onClose}
        canClose={canClose}
      />
    );
  }

  return null;
};
