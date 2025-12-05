import { Platform } from 'react-native';
import { subscriptionService, SubscriptionTier } from './subscriptionService';
import { supabase } from '@/src/config/supabase';

export interface MockProduct {
  productId: string;
  title: string;
  description: string;
  price: string;
  localizedPrice: string;
  currency: string;
  type: 'monthly' | 'yearly';
}

export interface MockPurchase {
  productId: string;
  transactionReceipt: string;
  transactionDate: number;
}

const MOCK_PRODUCTS: MockProduct[] = [
  {
    productId: 'bizmanage.pro.month',
    title: 'Pro Monthly',
    description: 'Unlimited sales for 1 business',
    price: '4.99',
    localizedPrice: '$4.99',
    currency: 'USD',
    type: 'monthly',
  },
  {
    productId: 'bizmanage.pro.year',
    title: 'Pro Yearly',
    description: 'Unlimited sales for 1 business (Save 20%)',
    price: '47.99',
    localizedPrice: '$47.99',
    currency: 'USD',
    type: 'yearly',
  },
  {
    productId: 'bizmanage.pro_plus.month',
    title: 'Pro Plus Monthly',
    description: 'Unlimited sales for up to 3 businesses',
    price: '9.99',
    localizedPrice: '$9.99',
    currency: 'USD',
    type: 'monthly',
  },
  {
    productId: 'bizmanage.pro_plus.year',
    title: 'Pro Plus Yearly',
    description: 'Unlimited sales for up to 3 businesses (Save 20%)',
    price: '95.99',
    localizedPrice: '$95.99',
    currency: 'USD',
    type: 'yearly',
  },
  {
    productId: 'bizmanage.max.month',
    title: 'Max Monthly',
    description: 'Unlimited sales and businesses',
    price: '19.99',
    localizedPrice: '$19.99',
    currency: 'USD',
    type: 'monthly',
  },
  {
    productId: 'bizmanage.max.year',
    title: 'Max Yearly',
    description: 'Unlimited sales and businesses (Save 20%)',
    price: '191.99',
    localizedPrice: '$191.99',
    currency: 'USD',
    type: 'yearly',
  },
];

function generateMockReceipt(productId: string): string {
  const timestamp = Date.now();
  const mockReceipt = {
    productId,
    transactionId: `mock_${timestamp}_${Math.random().toString(36).substring(7)}`,
    purchaseDate: new Date().toISOString(),
    platform: 'mock',
  };
  return JSON.stringify(mockReceipt);
}

function getExpirationDate(productId: string): Date {
  const isYearly = productId.includes('.year');
  const expirationDate = new Date();

  if (isYearly) {
    expirationDate.setFullYear(expirationDate.getFullYear() + 1);
  } else {
    expirationDate.setMonth(expirationDate.getMonth() + 1);
  }

  return expirationDate;
}

export const mockIapService = {
  async initConnection(): Promise<boolean> {
    console.log('[MockIAP] Initializing mock IAP connection');
    await new Promise(resolve => setTimeout(resolve, 500));
    return true;
  },

  async endConnection(): Promise<void> {
    console.log('[MockIAP] Ending mock IAP connection');
  },

  async getSubscriptions({ skus }: { skus: string[] }): Promise<MockProduct[]> {
    console.log('[MockIAP] Getting mock subscriptions:', skus);
    await new Promise(resolve => setTimeout(resolve, 300));
    return MOCK_PRODUCTS.filter(product => skus.includes(product.productId));
  },

  async requestSubscription({ sku }: { sku: string }): Promise<MockPurchase> {
    console.log('[MockIAP] Requesting mock subscription:', sku);

    await new Promise(resolve => setTimeout(resolve, 1000));

    const mockReceipt = generateMockReceipt(sku);

    return {
      productId: sku,
      transactionReceipt: mockReceipt,
      transactionDate: Date.now(),
    };
  },

  async getAvailablePurchases(): Promise<MockPurchase[]> {
    console.log('[MockIAP] Getting available mock purchases');

    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user?.id) {
        return [];
      }

      const { data: subscription } = await supabase
        .from('user_subscriptions')
        .select('subscription_product_id, receipt_data, updated_at')
        .eq('user_id', userData.user.id)
        .eq('subscription_status', 'active')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (subscription?.subscription_product_id && subscription?.receipt_data) {
        return [{
          productId: subscription.subscription_product_id,
          transactionReceipt: subscription.receipt_data,
          transactionDate: new Date(subscription.updated_at).getTime(),
        }];
      }

      return [];
    } catch (error) {
      console.error('[MockIAP] Error getting available purchases:', error);
      return [];
    }
  },

  async flushFailedPurchasesCachedAsPendingAndroid(): Promise<void> {
    console.log('[MockIAP] Flushing failed purchases (no-op for mock)');
  },

  async validateMockReceipt(receipt: string): Promise<{
    isValid: boolean;
    expiresDate: Date | null;
    productId: string | null;
  }> {
    try {
      const receiptData = JSON.parse(receipt);

      if (receiptData.platform !== 'mock') {
        return {
          isValid: false,
          expiresDate: null,
          productId: null,
        };
      }

      const expirationDate = getExpirationDate(receiptData.productId);

      return {
        isValid: true,
        expiresDate: expirationDate,
        productId: receiptData.productId,
      };
    } catch (error) {
      console.error('[MockIAP] Error validating mock receipt:', error);
      return {
        isValid: false,
        expiresDate: null,
        productId: null,
      };
    }
  },
};

export function isMockIapEnabled(): boolean {
  if (Platform.OS === 'web') {
    return false;
  }

  try {
    require('react-native-iap');
    return false;
  } catch (error) {
    console.log('[MockIAP] react-native-iap not available, using mock');
    return true;
  }
}
