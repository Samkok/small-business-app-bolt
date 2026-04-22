import { supabase } from '@/src/config/supabase';

export interface UnitGroup {
  id: string;
  business_id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface Unit {
  id: string;
  unit_group_id: string;
  name: string;
  barcode: string | null;
  conversion_factor_to_base: number;
  sort_order: number;
  is_base_unit: boolean;
  created_at: string;
}

export interface ProductUnitPrice {
  id: string;
  product_id: string;
  unit_id: string;
  price: number;
  cost_per_unit: number | null;
  currency_id: string | null;
  created_at: string;
  updated_at: string;
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

  async getUnitGroup(id: string): Promise<UnitGroup | null> {
    if (!id) return null;
    const { data, error } = await supabase
      .from('unit_groups')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data as UnitGroup | null;
  },

  async getUnits(unitGroupId: string): Promise<Unit[]> {
    if (!unitGroupId) return [];
    const { data, error } = await supabase
      .from('units')
      .select('*')
      .eq('unit_group_id', unitGroupId)
      .order('sort_order', { ascending: true });
    if (error) throw error;
    return (data || []) as Unit[];
  },

  async createUnitGroup(input: { business_id: string; name: string }): Promise<UnitGroup> {
    const { data, error } = await supabase
      .from('unit_groups')
      .insert({ business_id: input.business_id, name: input.name.trim() })
      .select()
      .single();
    if (error) throw error;
    return data as UnitGroup;
  },

  async createUnit(input: {
    unit_group_id: string;
    name: string;
    conversion_factor_to_base: number;
    sort_order: number;
    is_base_unit: boolean;
    barcode?: string | null;
  }): Promise<Unit> {
    const { data, error } = await supabase
      .from('units')
      .insert({
        unit_group_id: input.unit_group_id,
        name: input.name.trim(),
        conversion_factor_to_base: input.conversion_factor_to_base,
        sort_order: input.sort_order,
        is_base_unit: input.is_base_unit,
        barcode: input.barcode?.trim() || null,
      })
      .select()
      .single();
    if (error) {
      if ((error as any).code === '23505') {
        throw new Error('This barcode is already used by another unit in this group');
      }
      throw error;
    }
    return data as Unit;
  },

  async updateUnit(
    id: string,
    updates: Partial<Pick<Unit, 'name' | 'conversion_factor_to_base' | 'sort_order' | 'barcode'>>,
  ): Promise<Unit> {
    const { data, error } = await supabase
      .from('units')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) {
      if ((error as any).code === '23505') {
        throw new Error('This barcode is already used by another unit in this group');
      }
      throw error;
    }
    return data as Unit;
  },

  async deleteUnit(id: string): Promise<void> {
    const { error } = await supabase.from('units').delete().eq('id', id);
    if (error) throw error;
  },

  async deleteUnitGroup(id: string): Promise<void> {
    const { error } = await supabase.from('unit_groups').delete().eq('id', id);
    if (error) throw error;
  },

  /**
   * Create a unit group with an ordered list of units in one call.
   * Units must be passed from largest (top) to smallest (bottom).
   * The last unit is automatically flagged as the base unit.
   */
  async createUnitGroupWithUnits(input: {
    business_id: string;
    name: string;
    units: Array<{ name: string; conversion_factor_to_base: number; barcode?: string | null }>;
  }): Promise<{ group: UnitGroup; units: Unit[] }> {
    if (input.units.length === 0) {
      throw new Error('A unit group needs at least one unit');
    }
    const group = await this.createUnitGroup({
      business_id: input.business_id,
      name: input.name,
    });
    const lastIndex = input.units.length - 1;
    const createdUnits: Unit[] = [];
    try {
      for (let i = 0; i < input.units.length; i++) {
        const u = input.units[i];
        const unit = await this.createUnit({
          unit_group_id: group.id,
          name: u.name,
          conversion_factor_to_base: i === lastIndex ? 1 : u.conversion_factor_to_base,
          sort_order: i + 1,
          is_base_unit: i === lastIndex,
          barcode: u.barcode,
        });
        createdUnits.push(unit);
      }
    } catch (err) {
      await this.deleteUnitGroup(group.id).catch(() => undefined);
      throw err;
    }
    return { group, units: createdUnits };
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

  async setProductUnitPrices(
    productId: string,
    prices: Array<{ unit_id: string; price: number; currency_id?: string | null }>,
  ): Promise<void> {
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
        currency_id: p.currency_id ?? null,
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
    return Number(data?.conversion_factor_to_base ?? 1);
  },

  /**
   * Look up a unit by barcode across all unit groups owned by a business.
   * Returns the unit and the product that references the unit group.
   */
  async findByUnitBarcode(barcode: string, businessId: string): Promise<{
    unit: Unit;
    product: { id: string; name: string; unit_group_id: string | null; current_stock: number | null } | null;
  } | null> {
    if (!barcode || !businessId) return null;
    const { data: units, error: unitError } = await supabase
      .from('units')
      .select('*, unit_groups!inner(business_id)')
      .eq('barcode', barcode)
      .eq('unit_groups.business_id', businessId)
      .limit(1);
    if (unitError) throw unitError;
    if (!units || units.length === 0) return null;
    const unit = units[0] as Unit & { unit_groups: unknown };
    const { data: products } = await supabase
      .from('products')
      .select('id, name, unit_group_id, current_stock')
      .eq('business_id', businessId)
      .eq('unit_group_id', unit.unit_group_id)
      .eq('is_archived', false)
      .limit(1);
    return {
      unit,
      product: products && products.length > 0 ? (products[0] as any) : null,
    };
  },
};
