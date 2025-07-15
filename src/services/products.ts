import { supabase } from '../config/supabase';
import { storageService } from './storage';
import { Database } from '../types/database';

type Product = Database['public']['Tables']['products']['Row'];
type ProductInsert = Database['public']['Tables']['products']['Insert'];
type ProductUpdate = Database['public']['Tables']['products']['Update'];

export const productService = {
  async getProducts(businessId: string, limit?: number, offset?: number) {
    let query = supabase
      .from('products')
      .select('*')
      .eq('business_id', businessId)
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
    let query = supabase
      .from('products')
      .select('*')
      .eq('business_id', businessId)
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
    const { count, error } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('business_id', businessId);

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

  async deleteProduct(id: string) {
    // Get product to check for image
    const product = await this.getProduct(id);
    
    // Delete product image if it exists
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

    // Delete product record
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  async searchByBarcode(barcode: string, businessId: string) {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('barcode', barcode)
      .eq('business_id', businessId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },

  async getLowStockProducts(businessId: string) {
    const { data, error } = await supabase.rpc('get_low_stock_products', {
      business_id_param: businessId
    });

    if (error && error.code === '42883') {
      const { data: allProducts, error: productsError } = await supabase
        .from('products')
        .select('*')
        .eq('business_id', businessId);
  
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
    let dbQuery = supabase
      .from('products')
      .select('*')
      .eq('business_id', businessId)
      .or(`name.ilike.%${query}%,description.ilike.%${query}%,barcode.ilike.%${query}%`)
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
      .eq('business_id', businessId);

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
        base_unit_cost,
        final_unit_cost,
        total_cost,
        created_at
      `)
      .eq('product_id', productId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  async recalculateProductCost(productId: string) {
    // Get all imports for this product
    const { data: imports, error: importsError } = await supabase
      .from('inventory_imports')
      .select('quantity, final_unit_cost')
      .eq('product_id', productId)
      .order('created_at');

    if (importsError) throw importsError;

    // Get current stock
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('current_stock')
      .eq('id', productId)
      .single();

    if (productError) throw productError;

    // Calculate weighted average cost
    let totalQuantity = 0;
    let totalCost = 0;

    imports.forEach(imp => {
      totalQuantity += imp.quantity;
      totalCost += imp.quantity * imp.final_unit_cost;
    });

    const costPerUnit = totalQuantity > 0 ? totalCost / totalQuantity : 0;

    // Update the product's cost_per_unit
    await this.updateCostPerUnit(productId, costPerUnit);

    return costPerUnit;
  }
};