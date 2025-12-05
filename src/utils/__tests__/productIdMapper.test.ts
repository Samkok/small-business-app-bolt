import { productIdMapper } from '../productIdMapper';

describe('productIdMapper', () => {
  describe('toAppStoreFormat', () => {
    it('should convert pro monthly to correct format', () => {
      expect(productIdMapper.toAppStoreFormat('pro', 'monthly')).toBe('bizmanage.pro.month');
    });

    it('should convert pro yearly to correct format', () => {
      expect(productIdMapper.toAppStoreFormat('pro', 'yearly')).toBe('bizmanage.pro.year');
    });

    it('should convert pro_plus monthly to correct format', () => {
      expect(productIdMapper.toAppStoreFormat('pro_plus', 'monthly')).toBe('bizmanage.pro_plus.month');
    });

    it('should convert pro_plus yearly to correct format', () => {
      expect(productIdMapper.toAppStoreFormat('pro_plus', 'yearly')).toBe('bizmanage.pro_plus.year');
    });

    it('should convert max monthly to correct format', () => {
      expect(productIdMapper.toAppStoreFormat('max', 'monthly')).toBe('bizmanage.max.month');
    });

    it('should convert max yearly to correct format', () => {
      expect(productIdMapper.toAppStoreFormat('max', 'yearly')).toBe('bizmanage.max.year');
    });
  });

  describe('fromAppStoreFormat', () => {
    it('should parse pro monthly correctly', () => {
      const result = productIdMapper.fromAppStoreFormat('bizmanage.pro.month');
      expect(result).toEqual({ tier: 'pro', period: 'monthly' });
    });

    it('should parse pro yearly correctly', () => {
      const result = productIdMapper.fromAppStoreFormat('bizmanage.pro.year');
      expect(result).toEqual({ tier: 'pro', period: 'yearly' });
    });

    it('should parse pro_plus monthly correctly', () => {
      const result = productIdMapper.fromAppStoreFormat('bizmanage.pro_plus.month');
      expect(result).toEqual({ tier: 'pro_plus', period: 'monthly' });
    });

    it('should return null for invalid format', () => {
      const result = productIdMapper.fromAppStoreFormat('invalid.product.id');
      expect(result).toEqual({ tier: null, period: null });
    });
  });

  describe('detectPeriod', () => {
    it('should detect yearly period', () => {
      expect(productIdMapper.detectPeriod('bizmanage.pro.year')).toBe('yearly');
    });

    it('should detect monthly period', () => {
      expect(productIdMapper.detectPeriod('bizmanage.pro.month')).toBe('monthly');
    });
  });

  describe('getTierFromProductId', () => {
    it('should detect pro tier', () => {
      expect(productIdMapper.getTierFromProductId('bizmanage.pro.month')).toBe('pro');
    });

    it('should detect pro_plus tier', () => {
      expect(productIdMapper.getTierFromProductId('bizmanage.pro_plus.month')).toBe('pro_plus');
    });

    it('should detect max tier', () => {
      expect(productIdMapper.getTierFromProductId('bizmanage.max.month')).toBe('max');
    });

    it('should return free for unknown product', () => {
      expect(productIdMapper.getTierFromProductId('unknown.product')).toBe('free');
    });
  });
});
