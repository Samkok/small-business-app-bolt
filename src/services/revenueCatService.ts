import { Platform } from 'react-native';
import Purchases, {
  CustomerInfo,
  PurchasesOfferings,
  PurchasesPackage,
  LOG_LEVEL,
  PurchasesStoreProduct,
  PURCHASES_ERROR_CODE,
} from 'react-native-purchases';

const REVENUECAT_API_KEY = 'test_fkrdKDZMZCmmDvjIvjAjVnSaROY';

export type RevenueCatTier = 'free' | 'pro' | 'pro_plus' | 'max';

export const ENTITLEMENT_IDS = {
  PRO: 'bizmanage_pro',
  PRO_PLUS: 'bizmanage_pro_plus',
  MAX: 'bizmanage_max',
} as const;

export interface RevenueCatProduct {
  identifier: string;
  title: string;
  description: string;
  price: number;
  priceString: string;
  currencyCode: string;
  subscriptionPeriod?: string;
}

export interface RevenueCatEntitlement {
  identifier: string;
  isActive: boolean;
  productIdentifier: string;
  expirationDate: string | null;
}

export interface RevenueCatServiceInterface {
  configure(userId?: string): Promise<void>;
  setUserId(userId: string): Promise<void>;
  getOfferings(): Promise<PurchasesOfferings | null>;
  getCustomerInfo(): Promise<CustomerInfo>;
  purchasePackage(pkg: PurchasesPackage): Promise<{ customerInfo: CustomerInfo; cancelled: boolean }>;
  restorePurchases(): Promise<CustomerInfo>;
  getActiveEntitlements(): Promise<RevenueCatEntitlement[]>;
  hasEntitlement(entitlementId: string): Promise<boolean>;
  getCurrentTier(): Promise<RevenueCatTier>;
  getMaxBusinesses(): Promise<number | null>;
  isConfigured(): boolean;
  logOut(): Promise<void>;
  setAttributes(attributes: Record<string, string | null>): Promise<void>;
}

class RevenueCatService implements RevenueCatServiceInterface {
  private configured: boolean = false;
  private initializing: boolean = false;

  constructor() {
    if (Platform.OS !== 'web') {
      this.setupLogger();
    }
  }

  private setupLogger(): void {
    if (__DEV__) {
      Purchases.setLogLevel(LOG_LEVEL.DEBUG);
    } else {
      Purchases.setLogLevel(LOG_LEVEL.INFO);
    }
  }

  async configure(userId?: string): Promise<void> {
    if (Platform.OS === 'web') {
      console.log('[RevenueCat] Skipping configuration on web platform');
      return;
    }

    if (this.configured) {
      console.log('[RevenueCat] Already configured');
      if (userId) {
        await this.setUserId(userId);
      }
      return;
    }

    if (this.initializing) {
      console.log('[RevenueCat] Already initializing, waiting...');
      await this.waitForInitialization();
      return;
    }

    try {
      this.initializing = true;
      console.log('[RevenueCat] Configuring SDK...');

      Purchases.configure({
        apiKey: REVENUECAT_API_KEY,
        appUserID: userId,
      });

      this.configured = true;
      console.log('[RevenueCat] SDK configured successfully');

      try {
        const customerInfo = await Purchases.getCustomerInfo();
        console.log('[RevenueCat] Customer info:', {
          activeEntitlements: Object.keys(customerInfo.entitlements.active),
          activeSubscriptions: customerInfo.activeSubscriptions,
        });
      } catch (infoError) {
        console.log('[RevenueCat] Could not fetch initial customer info - this is normal for new users or unconfigured products');
      }
    } catch (error) {
      console.error('[RevenueCat] Configuration error:', error);
      this.configured = true;
      console.log('[RevenueCat] SDK marked as configured despite error - continuing with degraded functionality');
    } finally {
      this.initializing = false;
    }
  }

  private async waitForInitialization(): Promise<void> {
    let attempts = 0;
    const maxAttempts = 50;

    while (this.initializing && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }

    if (this.initializing) {
      throw new Error('RevenueCat initialization timeout');
    }
  }

  async setUserId(userId: string): Promise<void> {
    if (Platform.OS === 'web') return;

    try {
      console.log('[RevenueCat] Setting user ID:', userId);
      const { customerInfo } = await Purchases.logIn(userId);
      console.log('[RevenueCat] User logged in successfully');
      return;
    } catch (error) {
      console.error('[RevenueCat] Error setting user ID:', error);
      throw error;
    }
  }

  async logOut(): Promise<void> {
    if (Platform.OS === 'web') return;

    try {
      console.log('[RevenueCat] Logging out user');
      const customerInfo = await Purchases.logOut();
      console.log('[RevenueCat] User logged out successfully');
      return;
    } catch (error) {
      console.error('[RevenueCat] Error logging out:', error);
      throw error;
    }
  }

  async getOfferings(): Promise<PurchasesOfferings | null> {
    if (Platform.OS === 'web') {
      console.log('[RevenueCat] Offerings not available on web');
      return null;
    }

    try {
      console.log('[RevenueCat] Fetching offerings...');
      const offerings = await Purchases.getOfferings();

      if (offerings.current) {
        console.log('[RevenueCat] Current offering:', offerings.current.identifier);
        console.log('[RevenueCat] Available packages:', offerings.current.availablePackages.length);

        if (offerings.current.availablePackages.length === 0) {
          console.log('[RevenueCat] No packages available in current offering - products may not be configured for this platform');
        }
      } else {
        console.log('[RevenueCat] No current offering available - this is normal if products are not yet configured in RevenueCat');
      }

      return offerings;
    } catch (error: any) {
      if (error?.code === 'PRODUCT_ALREADY_PURCHASED' || error?.code === 'PRODUCT_NOT_AVAILABLE_FOR_PURCHASE') {
        console.log('[RevenueCat] Product availability error - products may not be configured for this platform');
        return null;
      }
      console.error('[RevenueCat] Error fetching offerings:', error);
      return null;
    }
  }

  async getCustomerInfo(): Promise<CustomerInfo> {
    const emptyCustomerInfo = {
      entitlements: { active: {}, all: {}, verification: 'NOT_REQUESTED' },
      activeSubscriptions: [],
      allPurchasedProductIdentifiers: [],
      nonSubscriptionTransactions: [],
      latestExpirationDate: null,
      firstSeen: new Date().toISOString(),
      originalAppUserId: '',
      requestDate: new Date().toISOString(),
      managementURL: null,
      originalPurchaseDate: null,
      originalApplicationVersion: null,
    } as unknown as CustomerInfo;

    if (Platform.OS === 'web') {
      return emptyCustomerInfo;
    }

    try {
      const customerInfo = await Purchases.getCustomerInfo();
      return customerInfo;
    } catch (error) {
      console.error('[RevenueCat] Error fetching customer info:', error);
      return emptyCustomerInfo;
    }
  }

  async purchasePackage(pkg: PurchasesPackage): Promise<{ customerInfo: CustomerInfo; cancelled: boolean }> {
    if (Platform.OS === 'web') {
      throw new Error('Purchases not available on web');
    }

    try {
      console.log('[RevenueCat] Purchasing package:', pkg.identifier);
      const { customerInfo, productIdentifier } = await Purchases.purchasePackage(pkg);
      console.log('[RevenueCat] Purchase successful:', productIdentifier);

      return { customerInfo, cancelled: false };
    } catch (error: any) {
      if (error.code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR) {
        console.log('[RevenueCat] Purchase cancelled by user');
        const customerInfo = await this.getCustomerInfo();
        return { customerInfo, cancelled: true };
      }

      console.error('[RevenueCat] Purchase error:', error);
      throw error;
    }
  }

  async restorePurchases(): Promise<CustomerInfo> {
    if (Platform.OS === 'web') {
      throw new Error('Restore not available on web');
    }

    try {
      console.log('[RevenueCat] Restoring purchases...');
      const customerInfo = await Purchases.restorePurchases();
      console.log('[RevenueCat] Purchases restored successfully');
      return customerInfo;
    } catch (error) {
      console.error('[RevenueCat] Error restoring purchases:', error);
      throw error;
    }
  }

  async getActiveEntitlements(): Promise<RevenueCatEntitlement[]> {
    if (Platform.OS === 'web') return [];

    try {
      const customerInfo = await this.getCustomerInfo();
      const entitlements: RevenueCatEntitlement[] = [];

      Object.entries(customerInfo.entitlements.active).forEach(([id, entitlement]) => {
        entitlements.push({
          identifier: id,
          isActive: entitlement.isActive,
          productIdentifier: entitlement.productIdentifier,
          expirationDate: entitlement.expirationDate,
        });
      });

      return entitlements;
    } catch (error) {
      console.error('[RevenueCat] Error getting active entitlements:', error);
      return [];
    }
  }

  async hasEntitlement(entitlementId: string): Promise<boolean> {
    if (Platform.OS === 'web') return false;

    try {
      const customerInfo = await this.getCustomerInfo();
      const hasEntitlement = customerInfo.entitlements.active[entitlementId]?.isActive === true;
      console.log(`[RevenueCat] Entitlement ${entitlementId}:`, hasEntitlement);
      return hasEntitlement;
    } catch (error) {
      console.error('[RevenueCat] Error checking entitlement:', error);
      return false;
    }
  }

  async getCurrentTier(): Promise<RevenueCatTier> {
    if (Platform.OS === 'web') return 'free';

    try {
      const customerInfo = await this.getCustomerInfo();
      const activeEntitlements = customerInfo.entitlements.active;

      if (activeEntitlements[ENTITLEMENT_IDS.MAX]?.isActive) {
        return 'max';
      }
      if (activeEntitlements[ENTITLEMENT_IDS.PRO_PLUS]?.isActive) {
        return 'pro_plus';
      }
      if (activeEntitlements[ENTITLEMENT_IDS.PRO]?.isActive) {
        return 'pro';
      }

      return 'free';
    } catch (error) {
      console.error('[RevenueCat] Error getting current tier:', error);
      return 'free';
    }
  }

  async getMaxBusinesses(): Promise<number | null> {
    const tier = await this.getCurrentTier();

    switch (tier) {
      case 'pro':
        return 1;
      case 'pro_plus':
        return 3;
      case 'max':
        return 999999;
      case 'free':
      default:
        return null;
    }
  }

  async setAttributes(attributes: Record<string, string | null>): Promise<void> {
    if (Platform.OS === 'web') return;

    try {
      console.log('[RevenueCat] Setting attributes:', attributes);
      await Purchases.setAttributes(attributes);
    } catch (error) {
      console.error('[RevenueCat] Error setting attributes:', error);
    }
  }

  isConfigured(): boolean {
    return this.configured;
  }
}

export const revenueCatService = new RevenueCatService();
