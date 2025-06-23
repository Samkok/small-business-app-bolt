import { inventoryService } from '../services/inventory';
import { productService } from '../services/products';
import { parseInventoryImportCsv, InventoryImportRecord } from './csvParser';

interface ImportResult {
  success: boolean;
  productId: string;
  quantity: number;
  message?: string;
  error?: any;
}

interface BulkImportResult {
  totalRecords: number;
  successCount: number;
  failureCount: number;
  results: ImportResult[];
}

/**
 * Processes a bulk inventory import from CSV data
 * @param csvData The raw CSV data as a string
 * @param profileId The current user's profile ID
 * @returns A Promise that resolves to a BulkImportResult
 */
export async function processBulkInventoryImport(
  csvData: string,
  profileId: string
): Promise<BulkImportResult> {
  // Parse the CSV data
  const importRecords = parseInventoryImportCsv(csvData);
  
  const results: ImportResult[] = [];
  let successCount = 0;
  let failureCount = 0;
  
  // Process each record sequentially
  for (const record of importRecords) {
    try {
      // Calculate final_unit_cost and total_cost
      let totalAdditionalCost = 0;
      record.costs.forEach(cost => {
        if (cost.calculation_type === 'per_unit') {
          totalAdditionalCost += cost.amount * record.quantity;
        } else {
          totalAdditionalCost += cost.amount;
        }
      });
      
      const finalUnitCost = record.base_unit_cost + (totalAdditionalCost / record.quantity);
      const totalCost = finalUnitCost * record.quantity;
      
      // Ensure business_id and imported_by are set correctly
      const importData = {
        product_id: record.product_id,
        quantity: record.quantity,
        base_unit_cost: record.base_unit_cost,
        final_unit_cost: finalUnitCost,
        total_cost: totalCost,
        business_id: profileId,
        imported_by: profileId,
        notes: null
      };
      
      // Process the import
      await inventoryService.createImport(importData, record.costs);
      
      // Record success
      results.push({
        success: true,
        productId: record.product_id,
        quantity: record.quantity,
        message: `Successfully imported ${record.quantity} units of product ${record.product_id}`
      });
      
      successCount++;
    } catch (error) {
      console.error(`Error importing record for product ${record.product_id}:`, error);
      
      // Record failure
      results.push({
        success: false,
        productId: record.product_id,
        quantity: record.quantity,
        message: `Failed to import ${record.quantity} units of product ${record.product_id}`,
        error
      });
      
      failureCount++;
    }
  }
  
  return {
    totalRecords: importRecords.length,
    successCount,
    failureCount,
    results
  };
}

/**
 * Processes a bulk inventory import from a File object
 * @param file The File object containing CSV data
 * @param profileId The current user's profile ID
 * @returns A Promise that resolves to a BulkImportResult
 */
export async function processBulkInventoryImportFromFile(
  file: File,
  profileId: string
): Promise<BulkImportResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = async (event) => {
      try {
        const csvData = event.target?.result as string;
        const result = await processBulkInventoryImport(csvData, profileId);
        resolve(result);
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = (error) => {
      reject(error);
    };
    
    reader.readAsText(file);
  });
}