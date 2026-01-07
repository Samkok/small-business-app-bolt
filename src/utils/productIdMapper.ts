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

    const proPlusMatch = lowerProductId.match(/pro[_\s-]?plus/);
    const maxMatch = lowerProductId.match(/\bmax\b/);
    const proMatch = lowerProductId.match(/\bpro\b/);

    if (proPlusMatch) {
      return 'pro_plus';
    } else if (maxMatch) {
      return 'max';
    } else if (proMatch) {
      return 'pro';
    }

    return 'free';
  }
};
