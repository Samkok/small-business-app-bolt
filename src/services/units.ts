import { supabase } from '@/src/config/supabase';

export interface UnitGroup {
  id: string;
  business_id: string;
  name: string;
  base_unit_name: string;
  created_at: string;
}

export interface Unit {
  id: string;
  unit_group_id: string;
  name: string;
  abbreviation: string;
  conversion_factor_to_base: number;
  is_base_unit: boolean;
  created_at: string;
}

export interface ProductUnitPrice {
  id: string;
  product_id: string;
  unit_id: string;
  price: number;
  created_at: string;
}

export const unitService = {
  async getUnitGroups(businessId: string): Promise<UnitGroup[]> {
    if (!businessId) return [];
    const { data, error } = await supabase
      .from('unit_groups')
      .select('*')
      .eq('business_id', businessId)
      .order('name');
    if (error) throw error;
    return (data || []) as UnitGroup[];
  },

  async getUnits(unitGroupId: string): Promise<Unit[]> {
    if (!unitGroupId) return [];
    const { data, error } = await supabase
      .from('units')
      .select('*')
      .eq('unit_group_id', unitGroupId)
      .order('conversion_factor_to_base');
    if (error) throw error;
    return (data || []) as Unit[];
  },

  async createUnitGroup(group: Omit<UnitGroup, 'id' | 'created_at'>): Promise<UnitGroup> {
    const { data, error } = await supabase
      .from('unit_groups')
      .insert(group)
      .select()
      .single();
    if (error) throw error;
    return data as UnitGroup;
  },

  async createUnit(unit: Omit<Unit, 'id' | 'created_at'>): Promise<Unit> {
    const { data, error } = await supabase
      .from('units')
      .insert(unit)
      .select()
      .single();
    if (error) throw error;
    return data as Unit;
  },

  async getProductUnitPrices(productId: string): Promise<ProductUnitPrice[]> {
    if (!productId) return [];
    const { data, error } = await supabase
      .from('product_unit_prices')
      .select('*')
      .eq('product_id', productId);
    if (error) throw error;
    return (data || []) as ProductUnitPrice[];
  },

  async setProductUnitPrices(productId: string, prices: Array<{ unit_id: string; price: number }>): Promise<void> {
    const { error: deleteError } = await supabase
      .from('product_unit_prices')
      .delete()
      .eq('product_id', productId);
    if (deleteError) throw deleteError;

    if (prices.length > 0) {
      const rows = prices.map(p => ({
        product_id: productId,
        unit_id: p.unit_id,
        price: p.price,
      }));
      const { error: insertError } = await supabase
        .from('product_unit_prices')
        .insert(rows);
      if (insertError) throw insertError;
    }
  },

  async getConversionFactor(unitId: string): Promise<number> {
    if (!unitId) return 1;
    const { data, error } = await supabase
      .from('units')
      .select('conversion_factor_to_base')
      .eq('id', unitId)
      .maybeSingle();
    if (error) throw error;
    return data?.conversion_factor_to_base ?? 1;
  },
};
