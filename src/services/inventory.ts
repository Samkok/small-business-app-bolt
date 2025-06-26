import { supabase } from '../config/supabase';
import { Database } from '../types/database';

type InventoryImport = Database['public']['Tables']['inventory_imports']['Row'];
type InventoryImportInsert = Database['public']['Tables']['inventory_imports']['Insert'];
type InventoryImportUpdate = Database['public']['Tables']['inventory_imports']['Update'];
type ImportCost = Database['public']['Tables']['import_costs']['Row'];
type ImportCostInsert = Database['public']['Tables']['import_costs']['Insert'];

export const inventoryService = {
  async createImport(importData: InventoryImportInsert, costs: Omit<ImportCostInsert, 'import_id'>[]) {
    // Ensure final_unit_cost and total_cost are calculated correctly
    if (!importData.final_unit_cost || !importData.total_cost) {
      const calculatedCosts = this.calculateFinalCost(
        importData.base_unit_cost,
        importData.quantity,
        costs
      );
      
      importData.final_unit_cost = calculatedCosts.finalUnitCost;
      importData.total_cost = calculatedCosts.totalCost;
    }

    const { data: importRecord, error: importError } = await supabase
      .from('inventory_imports')
      .insert(importData)
      .select()
      .single();

    if (importError) throw importError;

    // Add associated costs
    if (costs.length > 0) {
      const costsWithImportId = costs.map(cost => ({
        ...cost,
        import_id: importRecord.id
      }));

      const { error: costsError } = await supabase
        .from('import_costs')
        .insert(costsWithImportId);

      if (costsError) throw costsError;
    }

    // Update product stock
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('current_stock')
      .eq('id', importData.product_id)
      .single();

    if (productError) throw productError;

    const { error: updateError } = await supabase
      .from('products')
      .update({ 
        current_stock: (product.current_stock || 0) + importData.quantity,
        updated_at: new Date().toISOString()
      })
      .eq('id', importData.product_id);

    if (updateError) throw updateError;

    return importRecord;
  },

  async updateImport(
    importId: string, 
    importData: Partial<InventoryImportUpdate>, 
    costs: Omit<ImportCostInsert, 'import_id'>[]
  ) {

    if (typeof importId !== 'string' || !importId) return;
    
    // Get the original import record to calculate stock adjustment
    const { data: originalImport, error: getError } = await supabase
      .from('inventory_imports')
      .select('product_id, quantity')
      .eq('id', importId)
      .single();

    if (getError) throw getError;

    // Update the import record
    const { data: updatedImport, error: importError } = await supabase
      .from('inventory_imports')
      .update(importData)
      .eq('id', importId)
      .select()
      .single();

    if (importError) throw importError;

    // Delete existing costs
    const { error: deleteCostsError } = await supabase
      .from('import_costs')
      .delete()
      .eq('import_id', importId);

    if (deleteCostsError) throw deleteCostsError;

    // Add new costs
    if (costs.length > 0) {
      const costsWithImportId = costs.map(cost => ({
        ...cost,
        import_id: importId
      }));

      const { error: costsError } = await supabase
        .from('import_costs')
        .insert(costsWithImportId);

      if (costsError) throw costsError;
    }

    // Update product stock if quantity changed
    if (importData.quantity && importData.quantity !== originalImport.quantity) {
      // Get current product stock
      const { data: product, error: productError } = await supabase
        .from('products')
        .select('current_stock')
        .eq('id', originalImport.product_id)
        .single();

      if (productError) throw productError;

      // Calculate the stock adjustment (new quantity - old quantity)
      const stockAdjustment = importData.quantity - originalImport.quantity;
      
      // Update the product stock
      const { error: updateError } = await supabase
        .from('products')
        .update({ 
          current_stock: Math.max(0, (product.current_stock || 0) + stockAdjustment),
          updated_at: new Date().toISOString()
        })
        .eq('id', originalImport.product_id);

      if (updateError) throw updateError;
    }

    return updatedImport;
  },

  async deleteImport(importId: string) {
    // Get import details first
    const { data: importRecord, error: getError } = await supabase
      .from('inventory_imports')
      .select('product_id, quantity')
      .eq('id', importId)
      .single();

    if (getError) throw getError;

    // Delete associated costs first
    const { error: deleteCostsError } = await supabase
      .from('import_costs')
      .delete()
      .eq('import_id', importId);

    if (deleteCostsError) throw deleteCostsError;

    // Delete the import record
    const { error: deleteImportError } = await supabase
      .from('inventory_imports')
      .delete()
      .eq('id', importId);

    if (deleteImportError) throw deleteImportError;

    // Update product stock (subtract the imported quantity)
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('current_stock')
      .eq('id', importRecord.product_id)
      .single();

    if (productError) throw productError;

    const newStock = Math.max(0, (product.current_stock || 0) - importRecord.quantity);
    
    const { error: updateError } = await supabase
      .from('products')
      .update({ 
        current_stock: newStock,
        updated_at: new Date().toISOString()
      })
      .eq('id', importRecord.product_id);

    if (updateError) throw updateError;

    return true;
  },

  async getImportHistory(businessId: string) {
    const { data, error } = await supabase
      .from('inventory_imports')
      .select(`
        *,
        products(name, barcode),
        import_costs(*)
      `)
      .eq('business_id', businessId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  async getImportDetails(importId: string) {
    const { data, error } = await supabase
      .from('inventory_imports')
      .select(`
        *,
        products(name, barcode),
        import_costs(*),
        profiles!inventory_imports_imported_by_fkey(full_name)
      `)
      .eq('id', importId)
      .single();

    if (error) throw error;
    return data;
  },

  calculateFinalCost(baseUnitCost: number, quantity: number, costs: any[]) {
    let totalAdditionalCost = 0;

    costs.forEach(cost => {
      if (cost.calculation_type === 'per_unit') {
        totalAdditionalCost += cost.amount * quantity;
      } else {
        totalAdditionalCost += cost.amount;
      }
    });

    const finalUnitCost = quantity > 0 ? baseUnitCost + (totalAdditionalCost / quantity) : baseUnitCost;
    const totalCost = finalUnitCost * quantity;

    return { finalUnitCost, totalCost };
  }
};