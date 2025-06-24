import { supabase } from '../config/supabase';
import { productService } from '../services/products';

interface SaleImportRecord {
  created_at: string;
  created_by: string;
  business_id: string;
  customer_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  original_subtotal: number;
  discount_type: 'percentage' | 'fixed' | null;
  discount_value: number | null;
  item_discount_value: number | null;
  item_discount_amount: number | null;
  delivery_cost: number | null;
  subtotal: number;
  notes: string | null;
  payment_method: 'cash' | 'card' | 'transfer' | 'other';
}

interface ImportResult {
  success: boolean;
  cartId?: string;
  saleId?: string;
  message?: string;
  error?: any;
}

/**
 * Processes a sales import from CSV data
 * @param csvData The raw CSV data as a string
 * @param profileId The current user's profile ID (used as default if not in CSV)
 * @returns A Promise that resolves to an array of import results
 */
export async function processSalesImport(
  csvData: string,
  profileId: string
): Promise<ImportResult[]> {
  // Parse the CSV data
  const importRecords = parseSalesCsv(csvData);
  
  const results: ImportResult[] = [];
  
  // Process each record sequentially to avoid race conditions
  for (const record of importRecords) {
    try {
      // Step 1: Create cart
      const { data: cart, error: cartError } = await supabase
        .from('carts')
        .insert({
          customer_id: record.customer_id,
          business_id: record.business_id || profileId,
          created_by: record.created_by || profileId,
          status: 'completed',
          total_amount: record.subtotal,
          delivery_cost: record.delivery_cost,
          notes: record.notes,
          created_at: record.created_at || new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (cartError) throw cartError;

      // Step 2: Add item to cart
      const { data: cartItem, error: cartItemError } = await supabase
        .from('cart_items')
        .insert({
          cart_id: cart.id,
          product_id: record.product_id,
          quantity: record.quantity,
          unit_price: record.unit_price,
          original_subtotal: record.original_subtotal || (record.quantity * record.unit_price),
          discount_type: record.discount_type,
          discount_value: record.discount_value,
          item_discount_type: record.discount_type,
          item_discount_value: record.item_discount_value,
          item_discount_amount: record.item_discount_amount,
          subtotal: record.subtotal,
          created_at: record.created_at || new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (cartItemError) throw cartItemError;

      // Step 3: Create sale
      const { data: sale, error: saleError } = await supabase
        .from('sales')
        .insert({
          cart_id: cart.id,
          customer_id: record.customer_id,
          total_amount: record.subtotal,
          payment_method: record.payment_method,
          status: 'completed',
          sale_date: record.created_at || new Date().toISOString(),
          notes: record.notes,
          business_id: record.business_id || profileId,
          created_by: record.created_by || profileId,
          created_at: record.created_at || new Date().toISOString(),
          subtotal_before_discount: record.original_subtotal || (record.quantity * record.unit_price)
        })
        .select()
        .single();

      if (saleError) throw saleError;

      // Step 4: Update product stock
      try {
        const product = await productService.getProduct(record.product_id);
        const newStock = Math.max(0, product.current_stock - record.quantity);
        await productService.updateStock(record.product_id, newStock);
      } catch (stockError) {
        console.error('Error updating product stock:', stockError);
        // Continue with the import even if stock update fails
      }

      // Record success
      results.push({
        success: true,
        cartId: cart.id,
        saleId: sale.id,
        message: `Successfully imported sale for ${record.quantity} units of product ${record.product_id}`
      });
    } catch (error) {
      console.error('Error importing sale record:', error);
      
      // Record failure
      results.push({
        success: false,
        message: `Failed to import sale for product ${record.product_id}`,
        error
      });
    }
  }
  
  return results;
}

/**
 * Parses a CSV string containing sales import data
 * @param csvData The CSV string to parse
 * @returns An array of structured sale import records
 */
export function parseSalesCsv(csvData: string): SaleImportRecord[] {
  // Split the CSV into lines
  const lines = csvData.split('\n').filter(line => line.trim() !== '');
  
  // Skip the header line
  const dataLines = lines.slice(1);
  
  return dataLines.map(line => {
    // Split the line by commas, but handle commas within quotes
    const values = line.split(',').map(value => value.trim());
    
    // Extract values from the CSV line
    const created_at = values[0];
    const created_by = values[1];
    const business_id = values[2];
    const customer_id = values[3];
    const product_id = values[4];
    const quantity = parseInt(values[5], 10) || 0;
    const unit_price = parseFloat(values[6]) || 0;
    const original_subtotal = parseFloat(values[7]) || 0;
    
    // Handle discount fields which might be empty
    let discount_type: 'percentage' | 'fixed' | null = null;
    if (values[8] === 'percentage' || values[8] === 'fixed') {
      discount_type = values[8];
    }
    
    const discount_value = values[9] ? parseFloat(values[9]) : null;
    const item_discount_value = values[10] ? parseFloat(values[10]) : null;
    const item_discount_amount = values[11] ? parseFloat(values[11]) : null;
    
    // Handle delivery cost which might be empty
    const delivery_cost = values[12] ? parseFloat(values[12]) : null;
    
    const subtotal = parseFloat(values[13]) || 0;
    const notes = values[14] || null;
    
    // Payment method with default to 'cash' if not provided
    let payment_method: 'cash' | 'card' | 'transfer' | 'other' = 'cash';
    if (values[15] === 'card' || values[15] === 'transfer' || values[15] === 'other') {
      payment_method = values[15];
    }
    
    return {
      created_at,
      created_by,
      business_id,
      customer_id,
      product_id,
      quantity,
      unit_price,
      original_subtotal,
      discount_type,
      discount_value,
      item_discount_value,
      item_discount_amount,
      delivery_cost,
      subtotal,
      notes,
      payment_method
    };
  });
}

/**
 * Processes a sales import from a File object
 * @param file The File object containing CSV data
 * @param profileId The current user's profile ID
 * @returns A Promise that resolves to an array of import results
 */
export async function processSalesImportFromFile(
  file: File,
  profileId: string
): Promise<ImportResult[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = async (event) => {
      try {
        const csvData = event.target?.result as string;
        const results = await processSalesImport(csvData, profileId);
        resolve(results);
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