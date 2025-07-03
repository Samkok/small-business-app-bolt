import { supabase } from '../config/supabase';
import { Database } from '../types/database';
import { productService } from './products';

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

    // Set purchase_date and status for new imports
    importData.purchase_date = importData.purchase_date || new Date().toISOString();
    importData.status = 'pending';

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

    // Note: We no longer update product stock or cost_per_unit here
    // This will be done when the import is marked as arrived

    return importRecord;
  },

  async updateImport(
    importId: string, 
    importData: Partial<InventoryImportUpdate>, 
    costs: Omit<ImportCostInsert, 'import_id'>[]
  ) {
    if (typeof importId !== 'string' || !importId) return;
    
    // Get the original import record to check status
    const { data: originalImport, error: getError } = await supabase
      .from('inventory_imports')
      .select('product_id, quantity, status')
      .eq('id', importId)
      .single();

    if (getError) throw getError;

    // If the import is already completed, prevent changes to quantity, costs, etc.
    if (originalImport.status === 'completed') {
      // Filter out fields that shouldn't be updated for completed imports
      const allowedUpdates: Partial<InventoryImportUpdate> = {};
      
      // Only allow updating notes for completed imports
      if (importData.notes !== undefined) {
        allowedUpdates.notes = importData.notes;
      }
      
      // If there are no allowed updates, return the original import
      if (Object.keys(allowedUpdates).length === 0) {
        return originalImport;
      }
      
      importData = allowedUpdates;
    }

    // Update the import record
    const { data: updatedImport, error: importError } = await supabase
      .from('inventory_imports')
      .update(importData)
      .eq('id', importId)
      .select()
      .single();

    if (importError) throw importError;

    // Only update costs if the import is still pending
    if (originalImport.status === 'pending' && costs.length > 0) {
      // Delete existing costs
      const { error: deleteCostsError } = await supabase
        .from('import_costs')
        .delete()
        .eq('import_id', importId);

      if (deleteCostsError) throw deleteCostsError;

      // Add new costs
      const costsWithImportId = costs.map(cost => ({
        ...cost,
        import_id: importId
      }));

      const { error: costsError } = await supabase
        .from('import_costs')
        .insert(costsWithImportId);

      if (costsError) throw costsError;
    }

    return updatedImport;
  },

  async deleteImport(importId: string) {
    if (typeof importId !== 'string' || !importId) return;
    
    // Get import details first
    const { data: importRecord, error: getError } = await supabase
      .from('inventory_imports')
      .select('product_id, quantity, status')
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

    // If the import was completed, we need to reverse the stock and cost changes
    if (importRecord.status === 'completed') {
      // Get current product data
      const { data: product, error: productError } = await supabase
        .from('products')
        .select('current_stock, cost_per_unit')
        .eq('id', importRecord.product_id)
        .single();

      if (productError) throw productError;

      // Calculate new stock level (subtract the imported quantity)
      const newStock = Math.max(0, (product.current_stock || 0) - importRecord.quantity);
      
      // Update the product stock
      const { error: updateError } = await supabase
        .from('products')
        .update({ 
          current_stock: newStock,
          updated_at: new Date().toISOString()
        })
        .eq('id', importRecord.product_id);

      if (updateError) throw updateError;

      // Recalculate cost_per_unit
      await productService.recalculateProductCost(importRecord.product_id);
    }

    return true;
  },

  async markImportAsArrived(importId: string, arrivalDate?: string) {
    if (typeof importId !== 'string' || !importId) return;
    
    // Get the import record
    const { data: importRecord, error: getError } = await supabase
      .from('inventory_imports')
      .select('product_id, quantity, final_unit_cost, status')
      .eq('id', importId)
      .single();

    if (getError) throw getError;

    // If already completed, return early
    if (importRecord.status === 'completed') {
      return importRecord;
    }

    // Set arrival date to current time if not provided
    const arrivalDateTime = arrivalDate || new Date().toISOString();

    // Update the import record to mark it as arrived
    const { data: updatedImport, error: updateError } = await supabase
      .from('inventory_imports')
      .update({ 
        status: 'completed',
        arrival_date: arrivalDateTime
      })
      .eq('id', importId)
      .select()
      .single();

    if (updateError) throw updateError;

    // Now update the product stock and cost
    try {
      // Get current product data
      const { data: product, error: productError } = await supabase
        .from('products')
        .select('current_stock, cost_per_unit')
        .eq('id', importRecord.product_id)
        .single();

      if (productError) throw productError;

      // Calculate new stock level
      const newStock = (product.current_stock || 0) + importRecord.quantity;
      
      // Calculate new weighted average cost
      const currentTotalValue = (product.current_stock || 0) * (product.cost_per_unit || 0);
      const importTotalValue = importRecord.quantity * importRecord.final_unit_cost;
      const newTotalValue = currentTotalValue + importTotalValue;
      const newTotalQuantity = (product.current_stock || 0) + importRecord.quantity;
      const newCostPerUnit = newTotalQuantity > 0 ? newTotalValue / newTotalQuantity : 0;

      // Update the product
      const { error: updateProductError } = await supabase
        .from('products')
        .update({ 
          current_stock: newStock,
          cost_per_unit: newCostPerUnit,
          updated_at: new Date().toISOString()
        })
        .eq('id', importRecord.product_id);

      if (updateProductError) throw updateProductError;
    } catch (error) {
      console.error('Error updating product after import arrival:', error);
      // Consider rolling back the import status update if product update fails
      throw error;
    }

    return updatedImport;
  },

  async getImportHistory(businessId: string) {
    if (typeof businessId !== 'string' || !businessId) return;
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
    if (typeof importId !== 'string' || !importId) return;
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