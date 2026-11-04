import { supabase } from '../config/supabase';
import { productCostService, importLineToBaseUnits } from './productCost';
import { Database } from '../types/database';
import { batchImportService } from './batchImport';

type InventoryImport = Database['public']['Tables']['inventory_imports']['Row'];
type InventoryImportInsert = Database['public']['Tables']['inventory_imports']['Insert'];
type InventoryImportUpdate = Database['public']['Tables']['inventory_imports']['Update'];
type ImportCost = Database['public']['Tables']['import_costs']['Row'];
type ImportCostInsert = Database['public']['Tables']['import_costs']['Insert'];

// Legacy support - map old structure to new batch structure
type LegacyInventoryImportInsert = {
  product_id: string;
  quantity: number;
  base_unit_cost: number;
  final_unit_cost: number;
  total_cost: number;
  notes?: string;
  business_id: string;
  imported_by: string;
  purchase_date?: string;
  status?: 'pending' | 'completed';
};

export const inventoryService = {
  // Legacy method - creates a single-item batch for backward compatibility
  async createImport(importData: LegacyInventoryImportInsert, costs: Omit<ImportCostInsert, 'batch_id'>[]) {
    // Convert legacy format to new batch format
    const batchData = {
      business_id: importData.business_id,
      imported_by: importData.imported_by,
      purchase_date: importData.purchase_date,
      notes: importData.notes,
      items: [{
        product_id: importData.product_id,
        quantity: importData.quantity,
        base_unit_cost_per_item: importData.base_unit_cost
      }],
      costs: costs.map(cost => ({
        cost_type: cost.cost_type,
        amount: cost.amount,
        calculation_type: cost.calculation_type,
        description: cost.description
      }))
    };

    const result = await batchImportService.createBatchImport(batchData);
    
    // Return the first (and only) import record for backward compatibility
    return result.imports[0];
  },

  // New batch import method
  async createBatchImport(batchData: any) {
    return batchImportService.createBatchImport(batchData);
  },

  // Legacy method - now works with batches
  async updateImport(importId: string, importData: any, costs: any[]) {
    // This is more complex now since we need to update the batch
    // For now, we'll keep it simple and just update the import record
    const { data: updatedImport, error: importError } = await supabase
      .from('inventory_imports')
      .update({
        quantity: importData.quantity,
        base_unit_cost_per_item: importData.base_unit_cost,
        final_unit_cost_per_item: importData.final_unit_cost,
        total_cost_for_item: importData.total_cost
      })
      .eq('id', importId)
      .select()
      .single();

    if (importError) throw importError;
    return updatedImport;
  },

  // Legacy method - now deletes the entire batch if it's a single-item batch
  async deleteImport(importId: string) {
    // Get the import and its batch
    const { data: importRecord, error: getError } = await supabase
      .from('inventory_imports')
      .select('batch_id, inventory_batches(*)')
      .eq('id', importId)
      .single();

    if (getError) throw getError;

    // Check if this is the only import in the batch
    const { data: batchImports, error: batchImportsError } = await supabase
      .from('inventory_imports')
      .select('id')
      .eq('batch_id', importRecord.batch_id);

    if (batchImportsError) throw batchImportsError;

    if (batchImports.length === 1) {
      // Delete the entire batch
      return batchImportService.deleteBatchImport(importRecord.batch_id);
    } else {
      // Just delete this import record
      const { error: deleteError } = await supabase
        .from('inventory_imports')
        .delete()
        .eq('id', importId);

      if (deleteError) throw deleteError;
      return true;
    }
  },

  // Legacy method - now marks the entire batch as arrived
  async markImportAsArrived(importId: string, arrivalDate?: string) {
    // Get the batch ID for this import
    const { data: importRecord, error: getError } = await supabase
      .from('inventory_imports')
      .select('batch_id')
      .eq('id', importId)
      .single();

    if (getError) throw getError;

    return batchImportService.markBatchAsArrived(importRecord.batch_id, arrivalDate);
  },

  // Updated to work with new batch structure
  async createImportRecord(
    importData: InventoryImportInsert, 
    costs: Omit<ImportCostInsert, 'import_id'>[]
  ) {
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
      .select('product_id, quantity, final_unit_cost_per_item, status, units(conversion_factor_to_base)')
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

    // A completed import put stock on the shelf; take it back out through the cost ledger
    // at the cost it came in with (the ledger keeps the average if the goods were sold).
    if (importRecord.status === 'completed') {
      const { baseQty, costPerBaseUnit } = importLineToBaseUnits(
        importRecord.quantity,
        importRecord.final_unit_cost_per_item,
        (importRecord as any).units?.conversion_factor_to_base,
      );
      if (baseQty > 0) {
        await productCostService.reverseReceipt(importRecord.product_id, baseQty, costPerBaseUnit, 'inventory_import', importId);
      }
    }

    return true;
  },

  async markImportAsArrived(importId: string, arrivalDate?: string) {
    if (typeof importId !== 'string' || !importId) return;
    
    // Get the import record
    const { data: importRecord, error: getError } = await supabase
      .from('inventory_imports')
      .select('product_id, quantity, final_unit_cost_per_item, status, imported_by, business_id, units(conversion_factor_to_base)')
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

    // Stock and cost move through the cost ledger: landed cost per base unit, box imports converted.
    const { baseQty, costPerBaseUnit } = importLineToBaseUnits(
      importRecord.quantity,
      importRecord.final_unit_cost_per_item,
      (importRecord as any).units?.conversion_factor_to_base,
    );
    try {
      await productCostService.receive(importRecord.product_id, baseQty, costPerBaseUnit, 'inventory_import', importId);
    } catch (error) {
      console.error('Error receiving stock after import arrival:', error);
      throw error;
    }

    return updatedImport;
  },

  async getImportHistory(businessId: string) {
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
    
    // Return batch data directly instead of flattening
    return data;
  },

  async getImportsByProductId(productId: string) {
    if (typeof productId !== 'string' || !productId) return;
     const { data, error } = await supabase
      .from('inventory_imports')
      .select(`
        *,
        inventory_batches!batch_id(
          *,
          import_costs!batch_id(*)
        )
      `)
      .eq('product_id', productId)
      .eq('inventory_batches.status', 'completed')
      .order('arrival_date', { ascending: false });

    console.log("Data: ", data);

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