import { subscriptionService, FREE_TIER_LIMIT } from '@/src/services/subscriptionService';

export type Feature =
  | 'create_sale'
  | 'edit_sale'
  | 'create_expense'
  | 'edit_expense'
  | 'create_customer'
  | 'edit_customer'
  | 'create_product'
  | 'edit_product'
  | 'create_inventory'
  | 'edit_inventory';

export interface AccessCheckResult {
  hasAccess: boolean;
  reason?: 'subscribed' | 'under_limit' | 'at_limit';
  message?: string;
}

export const accessControl = {
  async canCreateSale(userId: string, businessId: string): Promise<AccessCheckResult> {
    try {
      const [subscription, salesCount] = await Promise.all([
        subscriptionService.getSubscriptionStatus(userId),
        subscriptionService.getSalesCount(userId, businessId)
      ]);

      if (subscription.isSubscribed) {
        return {
          hasAccess: true,
          reason: 'subscribed'
        };
      }

      if (salesCount < FREE_TIER_LIMIT) {
        return {
          hasAccess: true,
          reason: 'under_limit'
        };
      }

      return {
        hasAccess: false,
        reason: 'at_limit',
        message: `You've reached the free limit of ${FREE_TIER_LIMIT} sales. Upgrade to BizManage Pro to unlock unlimited sales.`
      };
    } catch (error) {
      console.error('Error checking sales access:', error);
      return {
        hasAccess: false,
        message: 'Unable to verify access. Please try again.'
      };
    }
  },

  async canEditSale(userId: string, businessId: string): Promise<AccessCheckResult> {
    return await this.canCreateSale(userId, businessId);
  },

  async canAccessFeature(
    feature: Feature,
    userId: string,
    businessId: string
  ): Promise<AccessCheckResult> {
    try {
      const [subscription, salesCount] = await Promise.all([
        subscriptionService.getSubscriptionStatus(userId),
        subscriptionService.getSalesCount(userId, businessId)
      ]);

      if (subscription.isSubscribed) {
        return {
          hasAccess: true,
          reason: 'subscribed'
        };
      }

      if (feature === 'create_sale' || feature === 'edit_sale') {
        if (salesCount >= FREE_TIER_LIMIT) {
          return {
            hasAccess: false,
            reason: 'at_limit',
            message: `You've reached the free limit of ${FREE_TIER_LIMIT} sales. Upgrade to BizManage Pro for unlimited access.`
          };
        }
      } else {
        if (salesCount >= FREE_TIER_LIMIT) {
          return {
            hasAccess: false,
            reason: 'at_limit',
            message: 'You\'ve reached the free limit. Upgrade to BizManage Pro to unlock all features.'
          };
        }
      }

      return {
        hasAccess: true,
        reason: 'under_limit'
      };
    } catch (error) {
      console.error('Error checking feature access:', error);
      return {
        hasAccess: false,
        message: 'Unable to verify access. Please try again.'
      };
    }
  },

  getAccessMessage(feature: Feature, salesCount: number, remainingSales: number): string {
    if (salesCount >= FREE_TIER_LIMIT) {
      return `You've reached the free limit. Upgrade to BizManage Pro to unlock unlimited ${this.getFeatureDisplayName(feature)}.`;
    }

    if (remainingSales <= 10 && (feature === 'create_sale' || feature === 'edit_sale')) {
      return `You have ${remainingSales} sales remaining on the free plan.`;
    }

    return '';
  },

  getFeatureDisplayName(feature: Feature): string {
    const names: Record<Feature, string> = {
      create_sale: 'sales',
      edit_sale: 'sales',
      create_expense: 'expenses',
      edit_expense: 'expenses',
      create_customer: 'customers',
      edit_customer: 'customers',
      create_product: 'products',
      edit_product: 'products',
      create_inventory: 'inventory adjustments',
      edit_inventory: 'inventory adjustments'
    };

    return names[feature] || 'features';
  },

  getReadOnlyMessage(): string {
    return `You've reached the free limit of ${FREE_TIER_LIMIT} sales. Upgrade to BizManage Pro to continue creating sales and accessing all features.`;
  },

  getUpgradePromptMessage(salesCount: number): string {
    return `You've used ${salesCount} of ${FREE_TIER_LIMIT} free sales. Upgrade to BizManage Pro for unlimited sales and full access to all features.`;
  },

  shouldShowWarning(salesCount: number): boolean {
    return salesCount >= 40 && salesCount < FREE_TIER_LIMIT;
  },

  getWarningMessage(salesCount: number): string {
    const remaining = FREE_TIER_LIMIT - salesCount;
    return `${remaining} sales remaining on your free plan. Upgrade to Pro for unlimited sales.`;
  }
};
