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
}

function shouldUseMockIAP(): boolean {
  if (Platform.OS === 'web') {
    return false;
  }

  if (!isRealIAPAvailable) {
    console.log('[IAPService] Using mock IAP: react-native-iap not available');
    return true;
  }

  const executionContext = Constants.executionContext;
  if (executionContext === 'bareWorkflow' || executionContext === 'standalone') {
    console.log('[IAPService] Using real IAP: running in standalone build');
    return false;
  }

  console.log('[IAPService] Using mock IAP: running in Expo Go or dev environment');
  return true;
}

class UnifiedIAPService implements IAPServiceInterface {
  private useMock: boolean;

  constructor() {
    this.useMock = shouldUseMockIAP();
    console.log(`[IAPService] Initialized with ${this.useMock ? 'mock' : 'real'} IAP`);
  }

  isMockMode(): boolean {
    return this.useMock;
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
