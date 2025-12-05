import { Platform } from 'react-native';
import Constants from 'expo-constants';

let RealIAP: any = null;
let isRealIAPAvailable = false;

if (Platform.OS !== 'web') {
  try {
    RealIAP = require('react-native-iap');
    isRealIAPAvailable = true;
    console.log('[IAPService] react-native-iap is available');
  } catch (error) {
    console.log('[IAPService] react-native-iap not available');
  }
}

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

function isIAPAvailable(): boolean {
  if (Platform.OS === 'web') {
    return false;
  }

  if (!isRealIAPAvailable) {
    return false;
  }

  const appOwnership = Constants.appOwnership;
  const executionContext = Constants.executionContext;

  console.log('[IAPService] 🔍 Detection info:', {
    appOwnership,
    executionContext,
    isRealIAPAvailable,
    platform: Platform.OS,
    __DEV__,
  });

  if (appOwnership === 'standalone') {
    console.log('[IAPService] ✅ IAP AVAILABLE: Running in standalone/production build');
    return true;
  }

  if (appOwnership === 'expo') {
    console.log('[IAPService] ❌ IAP NOT AVAILABLE: Running in Expo Go');
    return false;
  }

  if (executionContext === 'bareWorkflow' || executionContext === 'standalone') {
    console.log('[IAPService] ✅ IAP AVAILABLE: Running in bare workflow build');
    return true;
  }

  console.log('[IAPService] ❌ IAP NOT AVAILABLE: Running in development environment');
  return false;
}

class RealIAPService implements IAPServiceInterface {
  private available: boolean;

  constructor() {
    this.available = isIAPAvailable();
    if (this.available) {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('[IAPService] ✅ REAL IAP MODE ACTIVE');
      console.log('[IAPService] Connected to App Store/Play Store');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    } else {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('[IAPService] ❌ IAP NOT AVAILABLE');
      console.log('[IAPService] Subscription features disabled');
      console.log('[IAPService] Build with EAS to enable IAP');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    }
  }

  isAvailable(): boolean {
    return this.available;
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
      isAvailable: this.available,
      appOwnership: Constants.appOwnership,
      executionContext: Constants.executionContext,
      platform: Platform.OS,
      isDev: __DEV__,
      isRealIAPAvailable,
    };
  }

  async initConnection(): Promise<boolean> {
    if (!this.available) {
      console.log('[IAPService] IAP not available, skipping initialization');
      return false;
    }
    return await RealIAP.initConnection();
  }

  async endConnection(): Promise<void> {
    if (!this.available) {
      return;
    }
    return await RealIAP.endConnection();
  }

  async getSubscriptions(params: { skus: string[] }): Promise<IAPProduct[]> {
    if (!this.available) {
      console.log('[IAPService] IAP not available, returning empty products');
      return [];
    }
    return await RealIAP.getSubscriptions(params);
  }

  async requestSubscription(params: { sku: string }): Promise<IAPPurchase> {
    if (!this.available) {
      throw new Error('IAP not available. Build with EAS to enable in-app purchases.');
    }
    return await RealIAP.requestSubscription(params);
  }

  async getAvailablePurchases(): Promise<IAPPurchase[]> {
    if (!this.available) {
      console.log('[IAPService] IAP not available, returning empty purchases');
      return [];
    }
    return await RealIAP.getAvailablePurchases();
  }

  async flushFailedPurchasesCachedAsPendingAndroid(): Promise<void> {
    if (!this.available) {
      return;
    }
    if (Platform.OS === 'android') {
      return await RealIAP.flushFailedPurchasesCachedAsPendingAndroid();
    }
  }

  async validateReceipt(receipt: string, platform: 'ios' | 'android'): Promise<{
    isValid: boolean;
    expiresDate: Date | null;
    productId: string | null;
  }> {
    if (!this.available) {
      throw new Error('IAP not available for receipt validation');
    }

    const { subscriptionService } = require('./subscriptionService');
    return await subscriptionService.validateReceiptWithBackend(receipt, platform);
  }
}

export const iapService = new RealIAPService();
