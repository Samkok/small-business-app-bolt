export type TierType = 'pro' | 'pro_plus' | 'max';
export type BillingPeriod = 'monthly' | 'yearly';

export const productIdMapper = {
  toAppStoreFormat(tier: TierType, period: BillingPeriod): string {
    const periodSuffix = period === 'monthly' ? 'month' : 'year';
    return `bizmanage.${tier}.${periodSuffix}`;
  },

  fromAppStoreFormat(productId: string): { tier: TierType | null; period: BillingPeriod | null } {
    const match = productId.match(/bizmanage\.(pro_plus|pro|max)\.(month|year)/);

    if (!match) {
      return { tier: null, period: null };
    }

    const tier = match[1] as TierType;
    const period = match[2] === 'month' ? 'monthly' : 'yearly';

    return { tier, period };
  },

  detectPeriod(productId: string): BillingPeriod {
    if (productId.includes('year')) {
      return 'yearly';
    }
    return 'monthly';
  },

  getTierFromProductId(productId: string): TierType | 'free' {
    const lowerProductId = productId.toLowerCase();

    if (lowerProductId.includes('pro_plus') || lowerProductId.includes('proplus')) {
      return 'pro_plus';
    } else if (lowerProductId.includes('max')) {
      return 'max';
    } else if (lowerProductId.includes('pro')) {
      return 'pro';
    }

    return 'free';
  }
};
