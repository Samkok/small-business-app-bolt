import { supabase } from '@/src/config/supabase';

export interface DeletePreview {
  salesCount: number;
  expensesCount: number;
  customersCount: number;
  productsCount: number;
  cartsCount: number;
  teamMembersCount: number;
}

export const businessService = {
  async checkBusinessOwnership(businessId: string, userId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('businesses')
        .select('owner_user_id')
        .eq('id', businessId)
        .maybeSingle();

      if (error) throw error;
      if (!data) return false;

      return data.owner_user_id === userId;
    } catch (error) {
      console.error('Error checking business ownership:', error);
      return false;
    }
  },

  async getBusinessDeletePreview(businessId: string): Promise<DeletePreview> {
    try {
      const [salesResult, expensesResult, customersResult, productsResult, cartsResult, teamMembersResult] = await Promise.all([
        supabase.from('sales').select('id', { count: 'exact', head: true }).eq('business_id', businessId),
        supabase.from('expenses').select('id', { count: 'exact', head: true }).eq('business_id', businessId),
        supabase.from('customers').select('id', { count: 'exact', head: true }).eq('business_id', businessId),
        supabase.from('products').select('id', { count: 'exact', head: true }).eq('business_id', businessId),
        supabase.from('carts').select('id', { count: 'exact', head: true }).eq('business_id', businessId),
        supabase.from('user_business_roles').select('user_id', { count: 'exact', head: true }).eq('business_id', businessId)
      ]);

      return {
        salesCount: salesResult.count || 0,
        expensesCount: expensesResult.count || 0,
        customersCount: customersResult.count || 0,
        productsCount: productsResult.count || 0,
        cartsCount: cartsResult.count || 0,
        teamMembersCount: teamMembersResult.count || 0,
      };
    } catch (error) {
      console.error('Error getting delete preview:', error);
      return {
        salesCount: 0,
        expensesCount: 0,
        customersCount: 0,
        productsCount: 0,
        cartsCount: 0,
        teamMembersCount: 0,
      };
    }
  },

  async deleteBusiness(businessId: string, userId: string): Promise<void> {
    const isOwner = await this.checkBusinessOwnership(businessId, userId);
    if (!isOwner) {
      throw new Error('Unauthorized: Only the business owner can delete this business');
    }

    try {
      // Fetch sale IDs first
      const { data: sales } = await supabase
        .from('sales')
        .select('id')
        .eq('business_id', businessId);

      const saleIds = sales?.map(s => s.id) || [];

      // Delete sale actions if there are sales
      if (saleIds.length > 0) {
        const { error: saleActionsError } = await supabase
          .from('sale_actions')
          .delete()
          .in('sale_id', saleIds);

        if (saleActionsError) throw saleActionsError;
      }

      // Fetch cart IDs first
      const { data: carts } = await supabase
        .from('carts')
        .select('id')
        .eq('business_id', businessId);

      const cartIds = carts?.map(c => c.id) || [];

      // Delete cart items if there are carts
      if (cartIds.length > 0) {
        const { error: cartItemsError } = await supabase
          .from('cart_items')
          .delete()
          .in('cart_id', cartIds);

        if (cartItemsError) throw cartItemsError;
      }

      const { error: cartsError } = await supabase
        .from('carts')
        .delete()
        .eq('business_id', businessId);

      if (cartsError) throw cartsError;

      const { error: salesError } = await supabase
        .from('sales')
        .delete()
        .eq('business_id', businessId);

      if (salesError) throw salesError;

      const { error: expensesError } = await supabase
        .from('expenses')
        .delete()
        .eq('business_id', businessId);

      if (expensesError) throw expensesError;

      const { error: expenseCategoriesError } = await supabase
        .from('expense_categories')
        .delete()
        .eq('business_id', businessId);

      if (expenseCategoriesError) throw expenseCategoriesError;

      // Fetch batch IDs first
      const { data: batches } = await supabase
        .from('inventory_batches')
        .select('id')
        .eq('business_id', businessId);

      const batchIds = batches?.map(b => b.id) || [];

      // Delete import costs if there are batches
      if (batchIds.length > 0) {
        const { error: importCostsError } = await supabase
          .from('import_costs')
          .delete()
          .in('batch_id', batchIds);

        if (importCostsError) throw importCostsError;
      }

      const { error: inventoryImportsError } = await supabase
        .from('inventory_imports')
        .delete()
        .eq('business_id', businessId);

      if (inventoryImportsError) throw inventoryImportsError;

      const { error: inventoryBatchesError } = await supabase
        .from('inventory_batches')
        .delete()
        .eq('business_id', businessId);

      if (inventoryBatchesError) throw inventoryBatchesError;

      const { error: productHistoryError } = await supabase
        .from('product_history')
        .delete()
        .eq('business_id', businessId);

      if (productHistoryError) throw productHistoryError;

      const { error: customersError } = await supabase
        .from('customers')
        .delete()
        .eq('business_id', businessId);

      if (customersError) throw customersError;

      const { error: productsError } = await supabase
        .from('products')
        .delete()
        .eq('business_id', businessId);

      if (productsError) throw productsError;

      const { error: notificationsError } = await supabase
        .from('notifications')
        .delete()
        .eq('business_id', businessId);

      if (notificationsError) throw notificationsError;

      const { error: businessMembersError } = await supabase
        .from('user_business_roles')
        .delete()
        .eq('business_id', businessId);

      if (businessMembersError) throw businessMembersError;

      const { error: businessError } = await supabase
        .from('businesses')
        .delete()
        .eq('id', businessId);

      if (businessError) throw businessError;

      console.log('Business deleted successfully:', businessId);
    } catch (error) {
      console.error('Error deleting business:', error);
      throw error;
    }
  },

  async getUserBusinesses(userId: string) {
    try {
      const { data: ownedBusinesses, error: ownedError } = await supabase
        .from('businesses')
        .select('*')
        .eq('owner_user_id', userId);

      if (ownedError) throw ownedError;

      const { data: memberBusinesses, error: memberError } = await supabase
        .from('user_business_roles')
        .select('business_id, businesses(*)')
        .eq('user_id', userId);

      if (memberError) throw memberError;

      const allBusinesses = [
        ...(ownedBusinesses || []),
        ...(memberBusinesses?.map(mb => mb.businesses).filter(Boolean) || [])
      ];

      const uniqueBusinesses = Array.from(
        new Map(allBusinesses.map(b => [b.id, b])).values()
      );

      return uniqueBusinesses;
    } catch (error) {
      console.error('Error getting user businesses:', error);
      return [];
    }
  }
};
