import { supabase } from '../config/supabase';
import { processSalesImport, processSalesImportFromFile } from '../utils/salesImportProcessor';
import { processBulkInventoryImport, processBulkInventoryImportFromFile } from '../utils/bulkImportProcessor';

export const importService = {
  /**
   * Import sales data from CSV content
   * @param csvContent CSV content as string
   * @param profileId Current user's profile ID
   * @returns Import results
   */
  async importSalesFromCsv(csvContent: string, profileId: string) {

    if (typeof csvContent !== 'string' || !csvContent) return '';
    if (typeof profileId !== 'string' || !profileId) return;
    
    return processSalesImport(csvContent, profileId);
  },

  /**
   * Import sales data from a CSV file
   * @param file CSV file
   * @param profileId Current user's profile ID
   * @returns Import results
   */
  async importSalesFromFile(file: File, profileId: string) {
    
    if (typeof profileId !== 'string' || !profileId) return []; // Return empty array for consistency with processSalesImport
    
    return processSalesImportFromFile(file, profileId);
  },

  /**
   * Import inventory data from CSV content
   * @param csvContent CSV content as string
   * @param profileId Current user's profile ID
   * @returns Import results
   */
  async importInventoryFromCsv(csvContent: string, profileId: string) {

    if (typeof csvContent !== 'string' || !csvContent) return { totalRecords: 0, successCount: 0, failureCount: 0, results: [] }; // Return empty result object
    if (typeof profileId !== 'string' || !profileId) return;
    
    return processBulkInventoryImport(csvContent, profileId);
  },

  /**
   * Import inventory data from a CSV file
   * @param file CSV file
   * @param profileId Current user's profile ID
   * @returns Import results
   */
  async importInventoryFromFile(file: File, profileId: string) {

    if (typeof profileId !== 'string' || !profileId) return { totalRecords: 0, successCount: 0, failureCount: 0, results: [] }; // Return empty result object
    return processBulkInventoryImportFromFile(file, profileId);
  },

  /**
   * Generate a sample sales CSV template
   * @returns CSV template string
   */
  generateSalesCsvTemplate() {
    return `created_at(carts),created_by(carts),business_id(carts),customer_id(carts),product_id(cart_items),quantity(cart_items),unit_price(cart_items),original_subtotal(cart_items),discount_type(cart_items),discount_value(cart_items),item_discount_value(cart_items),item_discount_amount(cart_items),delivery_cost(carts),subtotal(cart_items),notes(carts),payment_method(sales)
2023-01-01,your_profile_id,your_business_id,customer_id,product_id,1,10.00,10.00,,,,,0,10.00,,cash
2023-01-02,your_profile_id,your_business_id,customer_id,product_id,2,15.00,30.00,percentage,10,10,3.00,0,27.00,Sample note,card`;
  },

  /**
   * Generate a sample inventory import CSV template
   * @returns CSV template string
   */
  generateInventoryImportCsvTemplate() {
    return `product_id,quantity,base_unit_cost,cost_type_1,amount_1,calculation_type_1,cost_type_2,amount_2,calculation_type_2
product_id_1,10,5.00,Shipping,2.00,per_total,Tax,0.50,per_unit
product_id_2,20,3.50,Handling,1.00,per_total,,0.00,`;
  }
};