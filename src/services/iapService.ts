import { Platform } from 'react-native';
import Constants from 'expo-constants';

export interface IAPProduct {
  productId: string;
  title: string;
  description: string;
  price: string;
  localizedPrice: string;
  currency: string;
  type?: 'monthly' | 'yearly';
}

export interface IAPPurchase {
  productId: string;
  transactionReceipt: string;
  transactionDate: number;
}

export interface IAPServiceInterface {
  initConnection(): Promise<boolean>;
  endConnection(): Promise<void>;
  getSubscriptions(params: { skus: string[] }): Promise<IAPProduct[]>;
  requestSubscription(params: { sku: string }): Promise<IAPPurchase>;
  getAvailablePurchases(): Promise<IAPPurchase[]>;
  flushFailedPurchasesCachedAsPendingAndroid(): Promise<void>;
  validateReceipt(receipt: string, platform: 'ios' | 'android'): Promise<{
    isValid: boolean;
    expiresDate: Date | null;
    productId: string | null;
  }>;
  isAvailable(): boolean;
  getDiagnosticInfo(): {
    isAvailable: boolean;
    appOwnership: string | null;
    executionContext: string;
    platform: string;
    isDev: boolean;
    isRealIAPAvailable: boolean;
  };
}

class StubIAPService implements IAPServiceInterface {
  constructor() {
    console.log('[IAPService] Using RevenueCat for IAP - react-native-iap is deprecated');
  }

  isAvailable(): boolean {
    return false;
  }

  getDiagnosticInfo(): {
    isAvailable: boolean;
    appOwnership: string | null;
    executionContext: string;
    platform: string;
    isDev: boolean;
    isRealIAPAvailable: boolean;
  } {
    return {
      isAvailable: false,
      appOwnership: Constants.appOwnership,
      executionContext: Constants.executionContext,
      platform: Platform.OS,
      isDev: __DEV__,
      isRealIAPAvailable: false,
    };
  }

  async initConnection(): Promise<boolean> {
    return false;
  }

  async endConnection(): Promise<void> {
    return;
  }

  async getSubscriptions(params: { skus: string[] }): Promise<IAPProduct[]> {
    return [];
  }

  async requestSubscription(params: { sku: string }): Promise<IAPPurchase> {
    throw new Error('Use RevenueCat for IAP');
  }

  async getAvailablePurchases(): Promise<IAPPurchase[]> {
    return [];
  }

  async flushFailedPurchasesCachedAsPendingAndroid(): Promise<void> {
    return;
  }

  async validateReceipt(receipt: string, platform: 'ios' | 'android'): Promise<{
    isValid: boolean;
    expiresDate: Date | null;
    productId: string | null;
  }> {
    throw new Error('Use RevenueCat for IAP');
  }
}

export const iapService = new StubIAPService();
