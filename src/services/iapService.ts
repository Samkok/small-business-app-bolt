import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { mockIapService } from './mockIapService';

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
  isMockMode(): boolean;
  getDiagnosticInfo(): {
    useMock: boolean;
    appOwnership: string | null;
    executionContext: string;
    platform: string;
    isDev: boolean;
    isRealIAPAvailable: boolean;
  };
}

function shouldUseMockIAP(): boolean {
  if (Platform.OS === 'web') {
    console.log('[IAPService] Platform is web, IAP not applicable');
    return false;
  }

  if (!isRealIAPAvailable) {
    console.warn('[IAPService] ⚠️ Using mock IAP: react-native-iap package not available');
    return true;
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
    console.log('[IAPService] ✅ Using REAL IAP: Running in standalone/production build (appOwnership=standalone)');
    return false;
  }

  if (appOwnership === 'expo') {
    console.log('[IAPService] 🧪 Using mock IAP: Running in Expo Go (appOwnership=expo)');
    return true;
  }

  if (executionContext === 'bareWorkflow' || executionContext === 'standalone') {
    console.log('[IAPService] ✅ Using REAL IAP: Running in bare workflow build');
    return false;
  }

  console.log('[IAPService] 🧪 Using mock IAP: Running in development environment');
  return true;
}

class UnifiedIAPService implements IAPServiceInterface {
  private useMock: boolean;

  constructor() {
    this.useMock = shouldUseMockIAP();
    if (this.useMock) {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('[IAPService] 🧪 MOCK MODE ACTIVE');
      console.log('[IAPService] This is for testing in Expo Go/Dev builds');
      console.log('[IAPService] Real IAP will work in EAS production builds');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    } else {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('[IAPService] ✅ REAL IAP MODE ACTIVE');
      console.log('[IAPService] Connected to App Store/Play Store');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    }
  }

  isMockMode(): boolean {
    return this.useMock;
  }

  getDiagnosticInfo(): {
    useMock: boolean;
    appOwnership: string | null;
    executionContext: string;
    platform: string;
    isDev: boolean;
    isRealIAPAvailable: boolean;
  } {
    return {
      useMock: this.useMock,
      appOwnership: Constants.appOwnership,
      executionContext: Constants.executionContext,
      platform: Platform.OS,
      isDev: __DEV__,
      isRealIAPAvailable,
    };
  }

  async initConnection(): Promise<boolean> {
    if (this.useMock) {
      return await mockIapService.initConnection();
    }
    return await RealIAP.initConnection();
  }

  async endConnection(): Promise<void> {
    if (this.useMock) {
      return await mockIapService.endConnection();
    }
    return await RealIAP.endConnection();
  }

  async getSubscriptions(params: { skus: string[] }): Promise<IAPProduct[]> {
    if (this.useMock) {
      return await mockIapService.getSubscriptions(params);
    }
    return await RealIAP.getSubscriptions(params);
  }

  async requestSubscription(params: { sku: string }): Promise<IAPPurchase> {
    if (this.useMock) {
      return await mockIapService.requestSubscription(params);
    }
    return await RealIAP.requestSubscription(params);
  }

  async getAvailablePurchases(): Promise<IAPPurchase[]> {
    if (this.useMock) {
      return await mockIapService.getAvailablePurchases();
    }
    return await RealIAP.getAvailablePurchases();
  }

  async flushFailedPurchasesCachedAsPendingAndroid(): Promise<void> {
    if (this.useMock) {
      return await mockIapService.flushFailedPurchasesCachedAsPendingAndroid();
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
    if (this.useMock) {
      return await mockIapService.validateMockReceipt(receipt);
    }

    const { subscriptionService } = require('./subscriptionService');
    return await subscriptionService.validateReceiptWithBackend(receipt, platform);
  }
}

export const iapService = new UnifiedIAPService();
