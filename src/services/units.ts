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
  conversion_factor_to_base: number;
  sort_order: number;
  is_base_unit: boolean;
  created_at: string;
}

// One row per (product, unit). Carries the product-specific variant label and
// barcode for that unit (e.g. product "Coca-Cola 500ml" + unit "Box" has its
// own barcode, distinct from any other product that uses the same unit group).
export interface ProductUnit {
  id: string;
  product_id: string;
  unit_id: string;
  business_id: string;
  name: string | null;
  barcode: string | null;
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
  }): Promise<Unit> {
    const { data, error } = await supabase
      .from('units')
      .insert({
        unit_group_id: input.unit_group_id,
        name: input.name.trim(),
        conversion_factor_to_base: input.conversion_factor_to_base,
        sort_order: input.sort_order,
        is_base_unit: input.is_base_unit,
      })
      .select()
      .single();
    if (error) throw error;
    return data as Unit;
  },

  async updateUnit(
    id: string,
    updates: Partial<Pick<Unit, 'name' | 'conversion_factor_to_base' | 'sort_order'>>,
  ): Promise<Unit> {
    const { data, error } = await supabase
      .from('units')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as Unit;
  },

  async updateUnitGroup(id: string, updates: { name: string }): Promise<UnitGroup> {
    const { data, error } = await supabase
      .from('unit_groups')
      .update({ name: updates.name.trim() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as UnitGroup;
  },

  async deleteUnit(id: string): Promise<void> {
    const { error } = await supabase.from('units').delete().eq('id', id);
    if (error) throw error;
  },

  async deleteUnitGroup(id: string): Promise<void> {
    const { error } = await supabase.from('unit_groups').delete().eq('id', id);
    if (error) throw error;
  },

  async getUnitUsage(unitId: string): Promise<{ productPriceCount: number; cartItemCount: number }> {
    const [priceRes, cartRes] = await Promise.all([
      supabase
        .from('product_unit_prices')
        .select('id', { count: 'exact', head: true })
        .eq('unit_id', unitId),
      supabase
        .from('cart_items')
        .select('id', { count: 'exact', head: true })
        .eq('unit_id', unitId),
    ]);
    return {
      productPriceCount: priceRes.count ?? 0,
      cartItemCount: cartRes.count ?? 0,
    };
  },

  async createUnitGroupWithUnits(input: {
    business_id: string;
    name: string;
    units: Array<{ name: string; conversion_factor_to_base: number }>;
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
        });
        createdUnits.push(unit);
      }
    } catch (err) {
      await this.deleteUnitGroup(group.id).catch(() => undefined);
      throw err;
    }
    return { group, units: createdUnits };
  },

  async getProductUnits(productId: string): Promise<ProductUnit[]> {
    if (!productId) return [];
    const { data, error } = await supabase
      .from('product_unit_prices')
      .select('*')
      .eq('product_id', productId);
    if (error) throw error;
    return (data || []) as ProductUnit[];
  },

  async setProductUnits(
    productId: string,
    businessId: string,
    rows: Array<{
      unit_id: string;
      name: string;
      barcode: string;
      price: number;
      currency_id?: string | null;
    }>,
  ): Promise<void> {
    const { error: deleteError } = await supabase
      .from('product_unit_prices')
      .delete()
      .eq('product_id', productId);
    if (deleteError) throw deleteError;

    if (rows.length === 0) return;

    const payload = rows.map(r => ({
      product_id: productId,
      unit_id: r.unit_id,
      business_id: businessId,
      name: r.name.trim(),
      barcode: r.barcode.trim() || null,
      price: r.price,
      currency_id: r.currency_id ?? null,
    }));

    const { error: insertError } = await supabase
      .from('product_unit_prices')
      .insert(payload);
    if (insertError) {
      if ((insertError as any).code === '23505') {
        throw new Error('A barcode is already in use in this business');
      }
      throw insertError;
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
   * Look up a product-unit variant by its barcode, scoped to a business.
   * Returns the product_unit row plus the unit and product rows it links to.
   */
  async findProductUnitByBarcode(barcode: string, businessId: string): Promise<{
    productUnit: ProductUnit;
    unit: Unit;
    product: { id: string; name: string; unit_group_id: string | null; current_stock: number | null } | null;
  } | null> {
    if (!barcode || !businessId) return null;
    const { data, error } = await supabase
      .from('product_unit_prices')
      .select('*, units(*), products(id, name, unit_group_id, current_stock, is_archived)')
      .eq('business_id', businessId)
      .eq('barcode', barcode)
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const row = data as any;
    const product = row.products && !row.products.is_archived
      ? { id: row.products.id, name: row.products.name, unit_group_id: row.products.unit_group_id, current_stock: row.products.current_stock }
      : null;
    return {
      productUnit: {
        id: row.id,
        product_id: row.product_id,
        unit_id: row.unit_id,
        business_id: row.business_id,
        name: row.name,
        barcode: row.barcode,
        price: row.price,
        cost_per_unit: row.cost_per_unit,
        currency_id: row.currency_id,
        created_at: row.created_at,
        updated_at: row.updated_at,
      },
      unit: row.units as Unit,
      product,
    };
  },
};
