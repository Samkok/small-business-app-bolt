import React from 'react';
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
  return (
    <CustomPaywall
      visible={visible}
      onClose={onClose}
      canClose={canClose}
    />
  );
};
