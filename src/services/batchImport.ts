import { supabase } from '../config/supabase';
import { Database } from '../types/database';
import { productService } from './products';

type InventoryBatch = Database['public']['Tables']['inventory_batches']['Row'];
type InventoryBatchInsert = Database['public']['Tables']['inventory_batches']['Insert'];
type InventoryBatchUpdate = Database['public']['Tables']['inventory_batches']['Update'];
type InventoryImport = Database['public']['Tables']['inventory_imports']['Row'];
type InventoryImportInsert = Database['public']['Tables']['inventory_imports']['Insert'];
type ImportCost = Database['public']['Tables']['import_costs']['Row'];
type ImportCostInsert = Database['public']['Tables']['import_costs']['Insert'];

export interface BatchImportItem {
  product_id: string;
  quantity: number;
  base_unit_cost_per_item: number;
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

export const batchImportService = {
  async createBatchImport(batchData: BatchImportData) {
    if (!batchData.items.length) {
      throw new Error('At least one product must be selected for import');
    }

    // Calculate total quantities for cost distribution
    const totalQuantity = batchData.items.reduce((sum, item) => sum + item.quantity, 0);
    const totalBaseValue = batchData.items.reduce((sum, item) => sum + (item.quantity * item.base_unit_cost_per_item), 0);

    // Calculate total additional costs
    let totalAdditionalCosts = 0;
    batchData.costs.forEach(cost => {
      if (cost.calculation_type === 'per_unit') {
        totalAdditionalCosts += cost.amount * totalQuantity;
      } else {
        totalAdditionalCosts += cost.amount;
      }
    });

    // Calculate final costs for each item
    const itemsWithFinalCosts = batchData.items.map(item => {
      // Distribute additional costs proportionally based on item value
      const itemValue = item.quantity * item.base_unit_cost_per_item;
      const itemProportion = totalBaseValue > 0 ? itemValue / totalBaseValue : 1 / batchData.items.length;
      const itemAdditionalCosts = totalAdditionalCosts * itemProportion;
      
      const final_unit_cost_per_item = item.base_unit_cost_per_item + (itemAdditionalCosts / item.quantity);
      const total_cost_for_item = final_unit_cost_per_item * item.quantity;

      return {
        ...item,
        final_unit_cost_per_item,
        total_cost_for_item
      };
    });

    const total_batch_cost = itemsWithFinalCosts.reduce((sum, item) => sum + item.total_cost_for_item, 0);

    // Start transaction by creating the batch
    const { data: batch, error: batchError } = await supabase
      .from('inventory_batches')
      .insert({
        business_id: batchData.business_id,
        imported_by: batchData.imported_by,
        purchase_date: batchData.purchase_date || new Date().toISOString(),
        notes: batchData.notes,
        status: 'pending',
        total_batch_cost
      })
      .select()
      .single();

    if (batchError) throw batchError;

    // Create import records for each item
    const importRecords = itemsWithFinalCosts.map(item => ({
      product_id: item.product_id,
      quantity: item.quantity,
      business_id: batchData.business_id,
      imported_by: batchData.business_id,
      base_unit_cost_per_item: item.base_unit_cost_per_item,
      final_unit_cost_per_item: item.final_unit_cost_per_item,
      total_cost_for_item: item.total_cost_for_item,
      batch_id: batch.id
    }));

    console.log(importRecords);

    const { data: imports, error: importsError } = await supabase
      .from('inventory_imports')
      .insert(importRecords)
      .select();

    if (importsError) throw importsError;

    // Create cost records
    if (batchData.costs.length > 0) {
      const costRecords = batchData.costs.map(cost => ({
        batch_id: batch.id,
        cost_type: cost.cost_type,
        amount: cost.amount,
        calculation_type: cost.calculation_type,
        description: cost.description
      }));

      const { error: costsError } = await supabase
        .from('import_costs')
        .insert(costRecords);

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
      .order('created_at', { ascending: false });

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
    // Get the batch and its imports
    const { data: batch, error: getBatchError } = await supabase
      .from('inventory_batches')
      .select(`
        *,
        inventory_imports(
          product_id,
          quantity,
          final_unit_cost_per_item
        )
      `)
      .eq('id', batchId)
      .single();

    if (getBatchError) throw getBatchError;

    if (batch.status === 'completed') {
      return batch;
    }

    // Update batch status
    const { data: updatedBatch, error: updateError } = await supabase
      .from('inventory_batches')
      .update({
        status: 'completed',
        arrival_date: arrivalDate || new Date().toISOString()
      })
      .eq('id', batchId)
      .select()
      .single();

    if (updateError) throw updateError;

    // Update product stocks and costs
    for (const importItem of batch.inventory_imports) {
      try {
        // Get current product data
        const { data: product, error: productError } = await supabase
          .from('products')
          .select('current_stock, cost_per_unit')
          .eq('id', importItem.product_id)
          .single();

        if (productError) throw productError;

        // Calculate new stock level
        const newStock = (product.current_stock || 0) + importItem.quantity;
        
        // Calculate new weighted average cost
        const currentTotalValue = (product.current_stock || 0) * (product.cost_per_unit || 0);
        const importTotalValue = importItem.quantity * importItem.final_unit_cost_per_item;
        const newTotalValue = currentTotalValue + importTotalValue;
        const newTotalQuantity = (product.current_stock || 0) + importItem.quantity;
        const newCostPerUnit = newTotalQuantity > 0 ? newTotalValue / newTotalQuantity : 0;

        // Update the product
        const { error: updateProductError } = await supabase
          .from('products')
          .update({
            current_stock: newStock,
            cost_per_unit: newCostPerUnit,
            updated_at: new Date().toISOString()
          })
          .eq('id', importItem.product_id);

        if (updateProductError) throw updateProductError;
      } catch (error) {
        console.error(`Error updating product ${importItem.product_id}:`, error);
        throw error;
      }
    }

    return updatedBatch;
  },

  async updateBatchImport(batchId: string, updates: InventoryBatchUpdate, newItems: BatchImportItem[], newCosts: BatchImportCost[]) {
    
    // Fetch the current batch details including its items and costs
    const { data: currentBatch, error: fetchError } = await supabase
      .from('inventory_batches')
      .select(`
        status,
        inventory_imports(*),
        import_costs(*)
      `)
      .eq('id', batchId)
      .select()
      .single();

    if (fetchError) throw fetchError;

    if (currentBatch.status === 'completed') {
      throw new Error('Completed batches cannot be edited. Please delete and re-import if changes are necessary.');
    }

    // Calculate total quantities for cost distribution
    const totalQuantity = newItems.reduce((sum, item) => sum + item.quantity, 0);
    const totalBaseValue = newItems.reduce((sum, item) => sum + (item.quantity * item.base_unit_cost_per_item), 0);

    // Calculate total additional costs
    let totalAdditionalCosts = 0;
    newCosts.forEach(cost => {
      const amount = parseFloat(cost.amount as any) || 0; // Ensure amount is number
      if (cost.calculation_type === 'per_unit') {
        totalAdditionalCosts += amount * totalQuantity;
      } else {
        totalAdditionalCosts += amount;
      }
    });

    
    console.log("New items: ", newItems);

    // Calculate final costs for each item
    const itemsWithFinalCosts = newItems.map(item => {
      const itemValue = item.quantity * item.base_unit_cost_per_item;
      const itemProportion = totalBaseValue > 0 ? itemValue / totalBaseValue : (newItems.length > 0 ? 1 / newItems.length : 0);
      const itemAdditionalCosts = totalAdditionalCosts * itemProportion;
      
      const final_unit_cost_per_item = item.base_unit_cost_per_item + (item.quantity > 0 ? itemAdditionalCosts / item.quantity : 0);
      const total_cost_for_item = final_unit_cost_per_item * item.quantity;

      return {
        ...item,
        final_unit_cost_per_item,
        total_cost_for_item
      };
    });

    const newTotalBatchCost = itemsWithFinalCosts.reduce((sum, item) => sum + item.total_cost_for_item, 0);

    // Update the batch record itself
    const { data, error } = await supabase
      .from('inventory_batches')
      .update({ ...updates, total_batch_cost: newTotalBatchCost, updated_at: new Date().toISOString() })
      .eq('id', batchId)
      .select()
      .single();

    if (error) throw error;
    console.log("currentBatch: ", currentBatch);

    // --- Update inventory_imports (products) ---
    const currentImportIds = new Set(currentBatch.inventory_imports.map((item: any) => item.id));
    console.log("CurrentImportIds: ", currentImportIds);
    const newImportIds = new Set(itemsWithFinalCosts.map((item: any) => item.id));
    console.log("newImportIds: ", newImportIds);
    

    // Items to delete
    const importsToDelete = currentBatch.inventory_imports.filter((item: any) => !newImportIds.has(item.id));
    if (importsToDelete.length > 0) {
      await supabase.from('inventory_imports').delete().in('id', importsToDelete.map((item: any) => item.id));
    }

    // Items to insert or update
    for (const item of itemsWithFinalCosts) {
      if (currentImportIds.has(item.id)) {
        // Update existing item
        await supabase.from('inventory_imports').update(item).eq('id', item.id);
      } else {
        // Insert new item
        await supabase.from('inventory_imports').insert({ ...item, batch_id: batchId, business_id: updates.business_id, imported_by: updates.imported_by });
      }
    }

    // --- Update import_costs ---
    const currentCostIds = new Set(currentBatch.import_costs.map((cost: any) => cost.id));
    const newCostIds = new Set(newCosts.map((cost: any) => cost.id));

    // Costs to delete
    const costsToDelete = currentBatch.import_costs.filter((cost: any) => !newCostIds.has(cost.id));
    if (costsToDelete.length > 0) {
      await supabase.from('import_costs').delete().in('id', costsToDelete.map((cost: any) => cost.id));
    }

    // Costs to insert or update
    for (const cost of newCosts) {
      if (currentCostIds.has(cost.id)) {
        // Update existing cost
        await supabase.from('import_costs').update(cost).eq('id', cost.id);
      } else {
        // Insert new cost
        await supabase.from('import_costs').insert({ ...cost, batch_id: batchId });
      }
    }

    return data;
  },

  async deleteBatchImport(batchId: string) {
    // Get batch details first
    const { data: batch, error: getBatchError } = await supabase
      .from('inventory_batches')
      .select(`
        status,
        inventory_imports(
          product_id,
          quantity
        )
      `)
      .eq('id', batchId)
      .single();

    if (getBatchError) throw getBatchError;

    // If the batch was completed, we need to reverse the stock changes
    if (batch.status === 'completed') {
      for (const importItem of batch.inventory_imports) {
        try {
          // Get current product data
          const { data: product, error: productError } = await supabase
            .from('products')
            .select('current_stock')
            .eq('id', importItem.product_id)
            .single();

          if (productError) throw productError;

          // Calculate new stock level (subtract the imported quantity)
          const newStock = Math.max(0, (product.current_stock || 0) - importItem.quantity);
          
          // Update the product stock
          const { error: updateError } = await supabase
            .from('products')
            .update({
              current_stock: newStock,
              updated_at: new Date().toISOString()
            })
            .eq('id', importItem.product_id);

          if (updateError) throw updateError;

          // Recalculate cost_per_unit
          await productService.recalculateProductCost(importItem.product_id);
        } catch (error) {
          console.error(`Error reversing stock for product ${importItem.product_id}:`, error);
          // Continue with other products even if one fails
        }
      }
    }

    // Delete the batch (cascade will handle related records)
    const { error: deleteError } = await supabase
      .from('inventory_batches')
      .delete()
      .eq('id', batchId);

    if (deleteError) throw deleteError;

    return true;
  },

  calculateItemCosts(items: BatchImportItem[], costs: BatchImportCost[]) {
    const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
    const totalBaseValue = items.reduce((sum, item) => sum + (item.quantity * item.base_unit_cost_per_item), 0);

    // Calculate total additional costs
    let totalAdditionalCosts = 0;
    costs.forEach(cost => {
      if (cost.calculation_type === 'per_unit') {
        totalAdditionalCosts += cost.amount * totalQuantity;
      } else {
        totalAdditionalCosts += cost.amount;
      }
    });

    // Calculate final costs for each item
    return items.map(item => {
      // Distribute additional costs proportionally based on item value
      const itemValue = item.quantity * item.base_unit_cost_per_item;
      const itemProportion = totalBaseValue > 0 ? itemValue / totalBaseValue : 1 / items.length;
      const itemAdditionalCosts = totalAdditionalCosts * itemProportion;
      
      const final_unit_cost_per_item = item.base_unit_cost_per_item + (itemAdditionalCosts / item.quantity);
      const total_cost_for_item = final_unit_cost_per_item * item.quantity;

      return {
        ...item,
        final_unit_cost_per_item,
        total_cost_for_item,
        allocated_additional_costs: itemAdditionalCosts
      };
    });
  }
};