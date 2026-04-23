import { supabase } from '../config/supabase';
import { Database } from '../types/database';
import { productService } from './products';

type InventoryBatchUpdate = Database['public']['Tables']['inventory_batches']['Update'];

export interface BatchImportItem {
  product_id: string;
  quantity: number;
  base_unit_cost_per_item: number;
  // Multi-unit fields (undefined for single-unit products)
  unit_id?: string;
  unit_label?: string;           // display name, e.g. "Box"
  conversion_factor?: number;   // conversion_factor_to_base, defaults to 1
}

export interface BatchImportCost {
  cost_type: string;
  amount: number;
  calculation_type: 'per_unit' | 'per_total';
  description?: string;
}

export interface BatchImportData {
  business_id: string;
  imported_by: string;
  purchase_date?: string;
  notes?: string;
  items: BatchImportItem[];
  costs: BatchImportCost[];
}

// Returns effective base-unit quantity for cost distribution and stock maths.
function baseQty(item: BatchImportItem): number {
  return item.quantity * (item.conversion_factor ?? 1);
}

export const batchImportService = {
  calculateItemCosts(items: BatchImportItem[], costs: BatchImportCost[]) {
    // Distribute additional costs proportionally to base-unit quantities so that
    // larger units (e.g. a Box of 24) absorb more overhead than a single Bottle.
    const totalBaseQty = items.reduce((sum, item) => sum + baseQty(item), 0);

    let totalAdditionalCosts = 0;
    costs.forEach(cost => {
      if (cost.calculation_type === 'per_unit') {
        totalAdditionalCosts += cost.amount * totalBaseQty;
      } else {
        totalAdditionalCosts += cost.amount;
      }
    });

    const perBaseUnitAdditionalCost = totalBaseQty > 0 ? totalAdditionalCosts / totalBaseQty : 0;

    return items.map(item => {
      const factor = item.conversion_factor ?? 1;
      // Additional cost per imported unit = per-base-unit overhead × factor
      const additionalCostPerUnit = perBaseUnitAdditionalCost * factor;
      const itemAdditionalCosts = additionalCostPerUnit * item.quantity;

      const final_unit_cost_per_item = item.base_unit_cost_per_item + additionalCostPerUnit;
      const total_cost_for_item = final_unit_cost_per_item * item.quantity;

      return {
        ...item,
        final_unit_cost_per_item,
        total_cost_for_item,
        allocated_additional_costs: itemAdditionalCosts,
      };
    });
  },

  async createBatchImport(batchData: BatchImportData) {
    if (!batchData.items.length) {
      throw new Error('At least one product must be selected for import');
    }

    const itemsWithFinalCosts = this.calculateItemCosts(batchData.items, batchData.costs);
    const total_batch_cost = itemsWithFinalCosts.reduce(
      (sum, item) => sum + item.total_cost_for_item,
      0,
    );

    const { data: batch, error: batchError } = await supabase
      .from('inventory_batches')
      .insert({
        business_id: batchData.business_id,
        imported_by: batchData.imported_by,
        purchase_date: batchData.purchase_date || new Date().toISOString(),
        notes: batchData.notes,
        status: 'pending',
        total_batch_cost,
      })
      .select()
      .single();

    if (batchError) throw batchError;

    const importRecords = itemsWithFinalCosts.map(item => ({
      product_id: item.product_id,
      quantity: item.quantity,
      business_id: batchData.business_id,
      imported_by: batchData.imported_by,
      base_unit_cost_per_item: item.base_unit_cost_per_item,
      final_unit_cost_per_item: item.final_unit_cost_per_item,
      total_cost_for_item: item.total_cost_for_item,
      batch_id: batch.id,
      unit_id: item.unit_id ?? null,
    }));

    const { data: imports, error: importsError } = await supabase
      .from('inventory_imports')
      .insert(importRecords)
      .select();

    if (importsError) throw importsError;

    if (batchData.costs.length > 0) {
      const costRecords = batchData.costs.map(cost => ({
        batch_id: batch.id,
        cost_type: cost.cost_type,
        amount: cost.amount,
        calculation_type: cost.calculation_type,
        description: cost.description,
      }));

      const { error: costsError } = await supabase.from('import_costs').insert(costRecords);
      if (costsError) throw costsError;
    }

    return { batch, imports };
  },

  async getBatchImports(businessId: string) {
    const { data, error } = await supabase
      .from('inventory_batches')
      .select(`
        *,
        inventory_imports(
          *,
          products(name, barcode)
        ),
        import_costs(*)
      `)
      .eq('business_id', businessId)
      .order('arrival_date', { ascending: false });

    if (error) throw error;
    return data;
  },

  async getBatchImport(batchId: string) {
    const { data, error } = await supabase
      .from('inventory_batches')
      .select(`
        *,
        inventory_imports(
          *,
          products(name, barcode)
        ),
        import_costs(*)
      `)
      .eq('id', batchId)
      .single();

    if (error) throw error;
    return data;
  },

  async markBatchAsArrived(batchId: string, arrivalDate?: string) {
    const { data: batch, error: getBatchError } = await supabase
      .from('inventory_batches')
      .select(`
        *,
        inventory_imports(
          product_id,
          quantity,
          base_unit_cost_per_item,
          unit_id
        ),
        import_costs(*)
      `)
      .eq('id', batchId)
      .single();

    if (getBatchError) throw getBatchError;
    if (batch.status === 'completed') return batch;

    // Rebuild items list with conversion factors fetched once per unique unit
    const uniqueUnitIds = [
      ...new Set(
        (batch.inventory_imports as any[])
          .map((i: any) => i.unit_id)
          .filter(Boolean),
      ),
    ];

    const conversionMap = new Map<string, number>();
    if (uniqueUnitIds.length > 0) {
      const { data: units, error: unitsError } = await supabase
        .from('units')
        .select('id, conversion_factor_to_base')
        .in('id', uniqueUnitIds as string[]);
      if (unitsError) throw unitsError;
      (units || []).forEach((u: any) => conversionMap.set(u.id, Number(u.conversion_factor_to_base)));
    }

    const batchItems: BatchImportItem[] = (batch.inventory_imports as any[]).map((item: any) => ({
      product_id: item.product_id,
      quantity: item.quantity,
      base_unit_cost_per_item: item.base_unit_cost_per_item,
      unit_id: item.unit_id ?? undefined,
      conversion_factor: item.unit_id ? (conversionMap.get(item.unit_id) ?? 1) : 1,
    }));

    const batchCosts: BatchImportCost[] = (batch.import_costs as any[]).map((cost: any) => ({
      cost_type: cost.cost_type,
      amount: cost.amount,
      calculation_type: cost.calculation_type,
      description: cost.description,
    }));

    const itemsWithRecalculatedCosts = this.calculateItemCosts(batchItems, batchCosts);

    const { data: updatedBatch, error: updateError } = await supabase
      .from('inventory_batches')
      .update({
        status: 'completed',
        arrival_date: arrivalDate || new Date().toISOString(),
      })
      .eq('id', batchId)
      .select()
      .single();

    if (updateError) throw updateError;

    for (const importItem of batchItems) {
      const recalculated = itemsWithRecalculatedCosts.find(
        i => i.product_id === importItem.product_id && i.unit_id === importItem.unit_id,
      );
      if (!recalculated) {
        console.error(
          `Could not find recalculated costs for product ${importItem.product_id} unit ${importItem.unit_id}`,
        );
        continue;
      }

      const { error: updateImportError } = await supabase
        .from('inventory_imports')
        .update({
          final_unit_cost_per_item: recalculated.final_unit_cost_per_item,
          total_cost_for_item: recalculated.total_cost_for_item,
          status: 'completed',
          arrival_date: arrivalDate || new Date().toISOString(),
        })
        .eq('product_id', importItem.product_id)
        .eq('batch_id', batchId);

      if (updateImportError) throw updateImportError;

      try {
        const factor = importItem.conversion_factor ?? 1;
        const addedBaseQty = importItem.quantity * factor;

        const { data: product, error: productError } = await supabase
          .from('products')
          .select('current_stock, cost_per_unit')
          .eq('id', importItem.product_id)
          .single();

        if (productError) throw productError;

        const newStock = (product.current_stock || 0) + addedBaseQty;

        // Weighted average cost per base unit
        const currentTotalValue = (product.current_stock || 0) * (product.cost_per_unit || 0);
        // final_unit_cost_per_item is per imported unit; cost per base unit = per imported unit / factor
        const costPerBaseUnit = recalculated.final_unit_cost_per_item / factor;
        const importTotalValue = addedBaseQty * costPerBaseUnit;
        const newTotalQuantity = newStock;
        const newCostPerUnit = newTotalQuantity > 0
          ? (currentTotalValue + importTotalValue) / newTotalQuantity
          : 0;

        const { error: updateProductError } = await supabase
          .from('products')
          .update({
            current_stock: newStock,
            cost_per_unit: newCostPerUnit,
            updated_at: new Date().toISOString(),
          })
          .eq('id', importItem.product_id);

        if (updateProductError) throw updateProductError;

        // Also update cost_per_unit on product_unit_prices for this specific variant
        if (importItem.unit_id) {
          await supabase
            .from('product_unit_prices')
            .update({ cost_per_unit: recalculated.final_unit_cost_per_item })
            .eq('product_id', importItem.product_id)
            .eq('unit_id', importItem.unit_id);
        }
      } catch (error) {
        console.error(`Error updating product ${importItem.product_id}:`, error);
        throw error;
      }
    }

    return updatedBatch;
  },

  async updateBatchImport(
    batchId: string,
    updates: InventoryBatchUpdate,
    newItems: BatchImportItem[],
    newCosts: BatchImportCost[],
  ) {
    const { data: currentBatch, error: fetchError } = await supabase
      .from('inventory_batches')
      .select('status')
      .eq('id', batchId)
      .single();

    if (fetchError) throw fetchError;

    if (currentBatch.status === 'completed') {
      throw new Error(
        'Completed batches cannot be edited. Please delete and re-import if changes are necessary.',
      );
    }

    const itemsWithFinalCosts = this.calculateItemCosts(newItems, newCosts);
    const newTotalBatchCost = itemsWithFinalCosts.reduce(
      (sum, item) => sum + item.total_cost_for_item,
      0,
    );

    const { data, error } = await supabase
      .from('inventory_batches')
      .update({ ...updates, total_batch_cost: newTotalBatchCost, updated_at: new Date().toISOString() })
      .eq('id', batchId)
      .select()
      .single();

    if (error) throw error;

    const { error: deleteImportsError } = await supabase
      .from('inventory_imports')
      .delete()
      .eq('batch_id', batchId);
    if (deleteImportsError) throw deleteImportsError;

    const { error: deleteCostsError } = await supabase
      .from('import_costs')
      .delete()
      .eq('batch_id', batchId);
    if (deleteCostsError) throw deleteCostsError;

    const importRecords = itemsWithFinalCosts.map(item => ({
      product_id: item.product_id,
      quantity: item.quantity,
      business_id: updates.business_id,
      imported_by: updates.imported_by,
      base_unit_cost_per_item: item.base_unit_cost_per_item,
      final_unit_cost_per_item: item.final_unit_cost_per_item,
      total_cost_for_item: item.total_cost_for_item,
      batch_id: batchId,
      unit_id: item.unit_id ?? null,
    }));

    if (importRecords.length > 0) {
      const { error: insertImportsError } = await supabase
        .from('inventory_imports')
        .insert(importRecords);
      if (insertImportsError) throw insertImportsError;
    }

    if (newCosts.length > 0) {
      const costRecords = newCosts.map(cost => ({
        batch_id: batchId,
        cost_type: cost.cost_type,
        amount: parseFloat(cost.amount as any) || 0,
        calculation_type: cost.calculation_type,
        description: cost.description || null,
      }));

      const { error: insertCostsError } = await supabase
        .from('import_costs')
        .insert(costRecords);
      if (insertCostsError) throw insertCostsError;
    }

    return data;
  },

  async deleteBatchImport(batchId: string) {
    const { data: batch, error: getBatchError } = await supabase
      .from('inventory_batches')
      .select(`
        status,
        inventory_imports(
          product_id,
          quantity,
          unit_id
        )
      `)
      .eq('id', batchId)
      .single();

    if (getBatchError) throw getBatchError;

    if (batch.status === 'completed') {
      // Fetch conversion factors for any multi-unit items
      const unitIds = [
        ...new Set(
          (batch.inventory_imports as any[])
            .map((i: any) => i.unit_id)
            .filter(Boolean),
        ),
      ];

      const conversionMap = new Map<string, number>();
      if (unitIds.length > 0) {
        const { data: units } = await supabase
          .from('units')
          .select('id, conversion_factor_to_base')
          .in('id', unitIds as string[]);
        (units || []).forEach((u: any) => conversionMap.set(u.id, Number(u.conversion_factor_to_base)));
      }

      for (const importItem of batch.inventory_imports as any[]) {
        try {
          const factor = importItem.unit_id ? (conversionMap.get(importItem.unit_id) ?? 1) : 1;
          const removedBaseQty = importItem.quantity * factor;

          const { data: product, error: productError } = await supabase
            .from('products')
            .select('current_stock')
            .eq('id', importItem.product_id)
            .single();

          if (productError) throw productError;

          const newStock = Math.max(0, (product.current_stock || 0) - removedBaseQty);

          const { error: updateError } = await supabase
            .from('products')
            .update({ current_stock: newStock, updated_at: new Date().toISOString() })
            .eq('id', importItem.product_id);

          if (updateError) throw updateError;

          await productService.recalculateProductCost(importItem.product_id);
        } catch (error) {
          console.error(`Error reversing stock for product ${importItem.product_id}:`, error);
        }
      }
    }

    const { error: deleteCostsError } = await supabase
      .from('import_costs')
      .delete()
      .eq('batch_id', batchId);
    if (deleteCostsError) throw deleteCostsError;

    const { error: deleteImportsError } = await supabase
      .from('inventory_imports')
      .delete()
      .eq('batch_id', batchId);
    if (deleteImportsError) throw deleteImportsError;

    const { error: deleteError } = await supabase
      .from('inventory_batches')
      .delete()
      .eq('id', batchId);
    if (deleteError) throw deleteError;

    return true;
  },
};
