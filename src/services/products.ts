import { supabase } from '../config/supabase';
import { storageService } from './storage';
import { Database } from '../types/database';
import { productTransactionService } from './productTransactions';
import { sanitizeSearchQuery } from '../lib/validation';

type Product = Database['public']['Tables']['products']['Row'];
type ProductInsert = Database['public']['Tables']['products']['Insert'];
type ProductUpdate = Database['public']['Tables']['products']['Update'];

export const productService = {
  async getProducts(businessId: string, limit?: number, offset?: number) {
    if (!businessId) {
      console.warn('productService.getProducts called without businessId');
      return [];
    }

    let query = supabase
      .from('products')
      .select('*')
      .eq('business_id', businessId)
      .eq('is_archived', false)
      .order('name');

    if (limit) {
      query = query.limit(limit);
    }

    if (offset) {
      query = query.range(offset, offset + (limit || 10) - 1);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  async getInStockProducts(businessId: string, limit?: number, offset?: number) {
    if (!businessId) {
      console.warn('productService.getInStockProducts called without businessId');
      return [];
    }

    let query = supabase
      .from('products')
      .select('*')
      .eq('business_id', businessId)
      .eq('is_archived', false)
      .gt('current_stock', 0)
      .order('name');

    if (limit) {
      query = query.limit(limit);
    }

    if (offset) {
      query = query.range(offset, offset + (limit || 10) - 1);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  async getProductsCount(businessId: string) {
    if (!businessId) {
      console.warn('productService.getProductsCount called without businessId');
      return 0;
    }

    const { count, error } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('business_id', businessId)
      .eq('is_archived', false);

    if (error) throw error;
    return count || 0;
  },

  async getProduct(id: string) {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  },

  async createProduct(product: ProductInsert) {
    const { data, error } = await supabase
      .from('products')
      .insert(product)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateProduct(id: string, updates: ProductUpdate, userId: string) {
    // Fetch the current product to compare values
    const { data: currentProduct, error: fetchError } = await supabase
      .from('products')
      .select('name, price, business_id')
      .eq('id', id)
      .single();

    if (fetchError) throw fetchError;

    const historyRecords = [];

    // Check for name change
    if (updates.name !== undefined && updates.name !== currentProduct.name) {
      historyRecords.push({
        product_id: id,
        changed_by_user_id: userId,
        business_id: currentProduct.business_id,
        field_name: 'name',
        old_value: currentProduct.name,
        new_value: updates.name,
      });
    }

    // Check for price change
    if (updates.price !== undefined && updates.price !== currentProduct.price) {
      historyRecords.push({
        product_id: id,
        changed_by_user_id: userId,
        business_id: currentProduct.business_id,
        field_name: 'price',
        old_value: currentProduct.price?.toString(),
        new_value: updates.price?.toString(),
      });
    }

    const { data, error } = await supabase
      .from('products')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // Insert history records if there are any changes
    if (historyRecords.length > 0) {
      const { error: historyError } = await supabase
        .from('product_history')
        .insert(historyRecords);

      if (historyError) console.error('Error inserting product history:', historyError);
    }

    return data;
  },

  async deleteProduct(id: string, userId: string) {
    const product = await this.getProduct(id);

    const transactionCheck = await productTransactionService.checkProductTransactions(id);

    if (product.image_url) {
      const imagePath = storageService.getImagePath(product.image_url);
      if (imagePath) {
        try {
          await storageService.deleteProductImage(imagePath);
        } catch (error) {
          console.warn('Failed to delete product image:', error);
        }
      }
    }

    if (transactionCheck.hasTransactions) {
      const { error } = await supabase
        .from('products')
        .update({
          is_archived: true,
          archived_at: new Date().toISOString(),
          archived_by: userId,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;

      return {
        type: 'archived' as const,
        transactionCheck
      };
    } else {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', id);

      if (error) throw error;

      return {
        type: 'deleted' as const,
        transactionCheck
      };
    }
  },

  async searchByBarcode(barcode: string, businessId: string) {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('barcode', barcode)
      .eq('business_id', businessId)
      .eq('is_archived', false)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') throw error;
    if (data) return data;

    // Fall back to per-product variant barcodes (product_unit_prices.barcode).
    // A scanned code may identify a specific unit variant (e.g. Box vs Bottle) of a product.
    const { data: variantMatches, error: variantError } = await supabase
      .from('product_unit_prices')
      .select('product_id, products(*)')
      .eq('business_id', businessId)
      .eq('barcode', barcode)
      .limit(1)
      .maybeSingle();

    if (variantError && variantError.code !== 'PGRST116') throw variantError;
    if (!variantMatches) return null;
    const matchedProduct: any = (variantMatches as any).products;
    if (!matchedProduct || matchedProduct.is_archived) return null;
    return matchedProduct;
  },

  async getLowStockProducts(businessId: string) {
    if (!businessId) {
      console.warn('productService.getLowStockProducts called without businessId');
      return [];
    }

    const { data, error } = await supabase.rpc('get_low_stock_products', {
      business_id_param: businessId
    });

    if (error && error.code === '42883') {
      const { data: allProducts, error: productsError } = await supabase
        .from('products')
        .select('*')
        .eq('business_id', businessId)
        .eq('is_archived', false);
  
      if (productsError) throw productsError;
  
      return allProducts.filter(product =>
        typeof product.current_stock === 'number' &&
        typeof product.min_stock_level === 'number' &&
        product.current_stock <= product.min_stock_level
      );
    }

    if (error) throw error;
    return data || [];
  },


  async updateStock(productId: string, newStock: number) {
    const { data, error } = await supabase
      .from('products')
      .update({ 
        current_stock: newStock,
        updated_at: new Date().toISOString()
      })
      .eq('id', productId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateCostPerUnit(productId: string, newCostPerUnit: number) {
    const { data, error } = await supabase
      .from('products')
      .update({ 
        cost_per_unit: newCostPerUnit,
        updated_at: new Date().toISOString()
      })
      .eq('id', productId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async searchProducts(businessId: string, query: string, limit?: number, offset?: number) {
    if (!businessId) {
      console.warn('productService.searchProducts called without businessId');
      return [];
    }

    const sanitizedQuery = sanitizeSearchQuery(query);

    let dbQuery = supabase
      .from('products')
      .select('*')
      .eq('business_id', businessId)
      .eq('is_archived', false)
      .or(`name.ilike.%${sanitizedQuery}%,description.ilike.%${sanitizedQuery}%,barcode.ilike.%${sanitizedQuery}%`)
      .order('name');

    if (limit) {
      dbQuery = dbQuery.limit(limit);
    }

    if (offset) {
      dbQuery = dbQuery.range(offset, offset + (limit || 10) - 1);
    }

    const { data, error } = await dbQuery;
    if (error) throw error;
    return data;
  },

  async getProductsByCategory(businessId: string, category?: string) {
    let query = supabase
      .from('products')
      .select('*')
      .eq('business_id', businessId)
      .eq('is_archived', false);

    if (category) {
      query = query.eq('category', category);
    }

    const { data, error } = await query.order('name');
    if (error) throw error;
    return data;
  },

  async getProductsWithLowStock(businessId: string) {
    // Use the same approach as getLowStockProducts for consistency
    return this.getLowStockProducts(businessId);
  },

  async bulkUpdateStock(updates: { productId: string; newStock: number }[]) {
    const promises = updates.map(update => 
      this.updateStock(update.productId, update.newStock)
    );
    
    return Promise.all(promises);
  },

  async getProductCostHistory(productId: string) {
    const { data, error } = await supabase
      .from('inventory_imports')
      .select(`
        id,
        quantity,
        base_unit_cost_per_item,
        final_unit_cost_per_item,
        total_cost_for_item,
        created_at
      `)
      .eq('product_id', productId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  async recalculateProductCost(productId: string) {
    // Get current cost before recalculation
    const { data: currentProduct } = await supabase
      .from('products')
      .select('cost_per_unit, business_id')
      .eq('id', productId)
      .single();

    const oldCost = currentProduct?.cost_per_unit || 0;

    const { data: imports, error: importsError } = await supabase
      .from('inventory_imports')
      .select('quantity, final_unit_cost_per_item, imported_by')
      .eq('product_id', productId)
      .eq('status', 'completed')
      .order('created_at');

    if (importsError) throw importsError;

    let totalQuantity = 0;
    let totalCost = 0;

    imports.forEach(imp => {
      totalQuantity += imp.quantity;
      totalCost += imp.quantity * imp.final_unit_cost_per_item;
    });

    const costPerUnit = totalQuantity > 0 ? totalCost / totalQuantity : 0;
    const roundedCost = Math.round(costPerUnit * 100) / 100;

    await this.updateCostPerUnit(productId, roundedCost);

    // Log to product_history if cost changed
    if (roundedCost !== oldCost && currentProduct) {
      const lastImport = imports[imports.length - 1];
      await supabase.from('product_history').insert({
        product_id: productId,
        changed_by_user_id: lastImport?.imported_by || null,
        business_id: currentProduct.business_id,
        field_name: 'cost_per_unit',
        old_value: oldCost.toString(),
        new_value: roundedCost.toString(),
      });
    }

    return roundedCost;
  },

  async getArchivedProducts(businessId: string, limit?: number, offset?: number) {
    let query = supabase
      .from('products')
      .select('*')
      .eq('business_id', businessId)
      .eq('is_archived', true)
      .order('archived_at', { ascending: false });

    if (limit) {
      query = query.limit(limit);
    }

    if (offset) {
      query = query.range(offset, offset + (limit || 10) - 1);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  async getArchivedProductsCount(businessId: string) {
    const { count, error } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('business_id', businessId)
      .eq('is_archived', true);

    if (error) throw error;
    return count || 0;
  },

  async searchArchivedProducts(businessId: string, query: string, limit?: number, offset?: number) {
    const sanitizedQuery = sanitizeSearchQuery(query);

    let dbQuery = supabase
      .from('products')
      .select('*')
      .eq('business_id', businessId)
      .eq('is_archived', true)
      .or(`name.ilike.%${sanitizedQuery}%,description.ilike.%${sanitizedQuery}%,barcode.ilike.%${sanitizedQuery}%`)
      .order('archived_at', { ascending: false });

    if (limit) {
      dbQuery = dbQuery.limit(limit);
    }

    if (offset) {
      dbQuery = dbQuery.range(offset, offset + (limit || 10) - 1);
    }

    const { data, error } = await dbQuery;
    if (error) throw error;
    return data;
  },

  async unarchiveProduct(id: string, userId: string) {
    const { data, error } = await supabase
      .from('products')
      .update({
        is_archived: false,
        archived_at: null,
        archived_by: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return data;
  }
};