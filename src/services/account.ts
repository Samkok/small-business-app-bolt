import { supabase } from '@/src/config/supabase';

export interface OwnedBusiness {
  id: string;
  business_name: string;
}

export interface AccountDeletePreview {
  ownedBusinesses: OwnedBusiness[];
  totalBusinessesCount: number;
  totalSalesCount: number;
  totalExpensesCount: number;
  totalCustomersCount: number;
  totalProductsCount: number;
  totalCartsCount: number;
  totalTeamMembersCount: number;
}

export const accountService = {
  async getOwnedBusinesses(userId: string): Promise<OwnedBusiness[]> {
    try {
      const { data, error } = await supabase
        .from('businesses')
        .select('id, business_name')
        .eq('owner_user_id', userId);

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('Error getting owned businesses:', error);
      return [];
    }
  },

  async getAccountDeletePreview(userId: string): Promise<AccountDeletePreview> {
    try {
      const ownedBusinesses = await this.getOwnedBusinesses(userId);
      const businessIds = ownedBusinesses.map(b => b.id);

      if (businessIds.length === 0) {
        return {
          ownedBusinesses: [],
          totalBusinessesCount: 0,
          totalSalesCount: 0,
          totalExpensesCount: 0,
          totalCustomersCount: 0,
          totalProductsCount: 0,
          totalCartsCount: 0,
          totalTeamMembersCount: 0,
        };
      }

      const [salesResult, expensesResult, customersResult, productsResult, cartsResult, teamMembersResult] = await Promise.all([
        supabase.from('sales').select('id', { count: 'exact', head: true }).in('business_id', businessIds),
        supabase.from('expenses').select('id', { count: 'exact', head: true }).in('business_id', businessIds),
        supabase.from('customers').select('id', { count: 'exact', head: true }).in('business_id', businessIds),
        supabase.from('products').select('id', { count: 'exact', head: true }).in('business_id', businessIds),
        supabase.from('carts').select('id', { count: 'exact', head: true }).in('business_id', businessIds),
        supabase.from('user_business_roles').select('user_id', { count: 'exact', head: true }).in('business_id', businessIds)
      ]);

      return {
        ownedBusinesses,
        totalBusinessesCount: ownedBusinesses.length,
        totalSalesCount: salesResult.count || 0,
        totalExpensesCount: expensesResult.count || 0,
        totalCustomersCount: customersResult.count || 0,
        totalProductsCount: productsResult.count || 0,
        totalCartsCount: cartsResult.count || 0,
        totalTeamMembersCount: teamMembersResult.count || 0,
      };
    } catch (error) {
      console.error('Error getting account delete preview:', error);
      return {
        ownedBusinesses: [],
        totalBusinessesCount: 0,
        totalSalesCount: 0,
        totalExpensesCount: 0,
        totalCustomersCount: 0,
        totalProductsCount: 0,
        totalCartsCount: 0,
        totalTeamMembersCount: 0,
      };
    }
  },

  async deleteAccount(userId: string): Promise<void> {
    try {
      const ownedBusinesses = await this.getOwnedBusinesses(userId);

      for (const business of ownedBusinesses) {
        await this.deleteBusiness(business.id);
      }

      const { error: profileError } = await supabase
        .from('user_profiles')
        .delete()
        .eq('user_id', userId);

      if (profileError) throw profileError;

      const { error: authError } = await supabase.auth.admin.deleteUser(userId);

      if (authError) {
        console.error('Error deleting auth user (this may require admin privileges):', authError);
      }

      console.log('Account deleted successfully:', userId);
    } catch (error) {
      console.error('Error deleting account:', error);
      throw error;
    }
  },

  async deleteBusiness(businessId: string): Promise<void> {
    try {
      const { data: sales } = await supabase
        .from('sales')
        .select('id')
        .eq('business_id', businessId);

      const saleIds = (sales as Array<{ id: string }> | null)?.map(s => s.id) || [];

      if (saleIds.length > 0) {
        const { error: saleActionsError } = await supabase
          .from('sale_actions')
          .delete()
          .in('sale_id', saleIds);

        if (saleActionsError) throw saleActionsError;
      }

      const { data: carts } = await supabase
        .from('carts')
        .select('id')
        .eq('business_id', businessId);

      const cartIds = (carts as Array<{ id: string }> | null)?.map(c => c.id) || [];

      const { error: salesError } = await supabase
        .from('sales')
        .delete()
        .eq('business_id', businessId);

      if (salesError) throw salesError;

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

      const { data: batches } = await supabase
        .from('inventory_batches')
        .select('id')
        .eq('business_id', businessId);

      const batchIds = (batches as Array<{ id: string }> | null)?.map(b => b.id) || [];

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

      console.log('Business deleted successfully as part of account deletion:', businessId);
    } catch (error) {
      console.error('Error deleting business during account deletion:', error);
      throw error;
    }
  }
};
