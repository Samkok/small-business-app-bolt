import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { Platform, AppState, AppStateStatus } from 'react-native';
import { subscriptionService, SubscriptionStatus, SalesCountData, FREE_TIER_LIMIT } from '@/src/services/subscriptionService';
import { useAuth } from './AuthContext';
import { Paywall } from '@/src/components/subscription/Paywall';

let IAP: any = null;
if (Platform.OS !== 'web') {
  try {
    IAP = require('react-native-iap');
  } catch (error) {
    console.warn('react-native-iap not available:', error);
  }
}

const IOS_PRODUCT_IDS = ['bizmanage.pro.month', 'bizmanage.pro.yearly'];
const ANDROID_PRODUCT_IDS = ['bizmanage.pro.month', 'bizmanage.pro.yearly'];

export interface SubscriptionProduct {
  productId: string;
  title: string;
  description: string;
  price: string;
  localizedPrice: string;
  currency: string;
  type: 'monthly' | 'yearly';
}

interface SubscriptionContextType {
  isSubscribed: boolean;
  subscriptionStatus: SubscriptionStatus;
  salesCountData: SalesCountData;
  products: SubscriptionProduct[];
  isLoading: boolean;
  isInitialized: boolean;
  canAccessFeature: boolean;

  purchaseSubscription: (productId: string) => Promise<boolean>;
  restorePurchases: () => Promise<boolean>;
  refreshSubscriptionStatus: () => Promise<void>;
  refreshSalesCount: () => Promise<void>;
  showPaywall: () => void;
  hidePaywall: () => void;
  isPaywallVisible: boolean;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export const useSubscription = () => {
  const context = useContext(SubscriptionContext);
  if (!context) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
};

interface SubscriptionProviderProps {
  children: ReactNode;
}

export const SubscriptionProvider: React.FC<SubscriptionProviderProps> = ({ children }) => {
  const { user, currentBusiness } = useAuth();
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus>({
    isSubscribed: false,
    subscriptionStatus: 'trial',
  });
  const [salesCountData, setSalesCountData] = useState<SalesCountData>({
    salesCount: 0,
    remainingSales: FREE_TIER_LIMIT,
    isAtLimit: false,
  });
  const [products, setProducts] = useState<SubscriptionProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isPaywallVisible, setIsPaywallVisible] = useState(false);
  const [canAccessFeature, setCanAccessFeature] = useState(true);

  const initializeIAP = useCallback(async () => {
    if (Platform.OS === 'web' || !IAP) {
      setIsInitialized(true);
      setIsLoading(false);
      return;
    }

    try {
      const connectionResult = await IAP.initConnection();
      console.log('IAP connection result:', connectionResult);

      if (Platform.OS === 'android') {
        await IAP.flushFailedPurchasesCachedAsPendingAndroid();
      }

      const productIds = Platform.OS === 'ios' ? IOS_PRODUCT_IDS : ANDROID_PRODUCT_IDS;
      const productsData = await IAP.getSubscriptions({ skus: productIds });

      const formattedProducts: SubscriptionProduct[] = productsData.map(product => ({
        productId: product.productId,
        title: product.title || '',
        description: product.description || '',
        price: product.price || '',
        localizedPrice: product.localizedPrice || '',
        currency: product.currency || 'USD',
        type: product.productId.includes('yearly') ? 'yearly' : 'monthly',
      }));

      setProducts(formattedProducts);
      setIsInitialized(true);
    } catch (error) {
      console.error('Error initializing IAP:', error);
      setIsInitialized(true);
    }
  }, []);

  const refreshSubscriptionStatus = useCallback(async () => {
    if (!user?.id) return;

    try {
      const status = await subscriptionService.getSubscriptionStatus(user.id);
      setSubscriptionStatus(status);
      setIsSubscribed(status.isSubscribed);
    } catch (error) {
      console.error('Error refreshing subscription status:', error);
    }
  }, [user?.id]);

  const refreshSalesCount = useCallback(async () => {
    if (!user?.id || !currentBusiness?.id) return;

    try {
      const countData = await subscriptionService.getSalesCountData(user.id, currentBusiness.id);
      setSalesCountData(countData);
    } catch (error) {
      console.error('Error refreshing sales count:', error);
    }
  }, [user?.id, currentBusiness?.id]);

  const checkFeatureAccess = useCallback(async () => {
    if (!user?.id || !currentBusiness?.id) {
      setCanAccessFeature(false);
      return;
    }

    try {
      const hasAccess = await subscriptionService.canAccessFeature(user.id, currentBusiness.id);
      setCanAccessFeature(hasAccess);
    } catch (error) {
      console.error('Error checking feature access:', error);
      setCanAccessFeature(false);
    }
  }, [user?.id, currentBusiness?.id]);

  const purchaseSubscription = useCallback(async (productId: string): Promise<boolean> => {
    if (Platform.OS === 'web' || !IAP) {
      console.log('IAP not supported on this platform');
      return false;
    }

    try {
      setIsLoading(true);

      const purchase = await IAP.requestSubscription({ sku: productId });

      if (purchase && purchase.transactionReceipt) {
        const validation = await subscriptionService.validateReceiptWithBackend(
          purchase.transactionReceipt,
          Platform.OS as 'ios' | 'android'
        );

        if (validation.isValid) {
          const success = await subscriptionService.updateSubscription(
            user!.id,
            'active',
            productId,
            validation.expiresDate || undefined,
            purchase.transactionReceipt
          );

          if (success) {
            await refreshSubscriptionStatus();
            await checkFeatureAccess();
            return true;
          }
        }
      }

      return false;
    } catch (error: any) {
      console.error('Error purchasing subscription:', error);
      if (error.code === 'E_USER_CANCELLED') {
        console.log('User cancelled purchase');
      }
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [user, refreshSubscriptionStatus, checkFeatureAccess]);

  const restorePurchases = useCallback(async (): Promise<boolean> => {
    if (Platform.OS === 'web' || !IAP) {
      console.log('IAP not supported on this platform');
      return false;
    }

    try {
      setIsLoading(true);

      const purchases = await IAP.getAvailablePurchases();

      if (purchases && purchases.length > 0) {
        const latestPurchase = purchases.sort((a, b) =>
          (b.transactionDate || 0) - (a.transactionDate || 0)
        )[0];

        if (latestPurchase.transactionReceipt) {
          const validation = await subscriptionService.validateReceiptWithBackend(
            latestPurchase.transactionReceipt,
            Platform.OS as 'ios' | 'android'
          );

          if (validation.isValid) {
            const success = await subscriptionService.updateSubscription(
              user!.id,
              'active',
              latestPurchase.productId,
              validation.expiresDate || undefined,
              latestPurchase.transactionReceipt
            );

            if (success) {
              await refreshSubscriptionStatus();
              await checkFeatureAccess();
              return true;
            }
          }
        }
      }

      return false;
    } catch (error) {
      console.error('Error restoring purchases:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [user, refreshSubscriptionStatus, checkFeatureAccess]);

  const showPaywall = useCallback(() => {
    setIsPaywallVisible(true);
  }, []);

  const hidePaywall = useCallback(() => {
    setIsPaywallVisible(false);
  }, []);

  useEffect(() => {
    initializeIAP();

    return () => {
      if (Platform.OS !== 'web' && IAP) {
        try {
          IAP.endConnection();
        } catch (error) {
          console.warn('Error ending IAP connection:', error);
        }
      }
    };
  }, [initializeIAP]);

  useEffect(() => {
    if (user?.id) {
      refreshSubscriptionStatus();
    }
  }, [user?.id, refreshSubscriptionStatus]);

  useEffect(() => {
    if (user?.id && currentBusiness?.id) {
      refreshSalesCount();
      checkFeatureAccess();
    }
  }, [user?.id, currentBusiness?.id, refreshSalesCount, checkFeatureAccess]);

  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active' && user?.id) {
        refreshSubscriptionStatus();
        if (currentBusiness?.id) {
          refreshSalesCount();
          checkFeatureAccess();
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
    };
  }, [user?.id, currentBusiness?.id, refreshSubscriptionStatus, refreshSalesCount, checkFeatureAccess]);

  useEffect(() => {
    if (isInitialized) {
      setIsLoading(false);
    }
  }, [isInitialized]);

  const value: SubscriptionContextType = {
    isSubscribed,
    subscriptionStatus,
    salesCountData,
    products,
    isLoading,
    isInitialized,
    canAccessFeature,
    purchaseSubscription,
    restorePurchases,
    refreshSubscriptionStatus,
    refreshSalesCount,
    showPaywall,
    hidePaywall,
    isPaywallVisible,
  };

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
      <Paywall
        visible={isPaywallVisible}
        onClose={hidePaywall}
        canClose={true}
      />
    </SubscriptionContext.Provider>
  );
};
