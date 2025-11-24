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
    try {
      // Get the current session to ensure we have a valid token
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        throw new Error('No active session. Please sign in again.');
      }

      // Call the Edge Function to delete the business
      // The Edge Function uses service role key to bypass RLS and ensures atomic deletion
      // CASCADE constraints automatically delete all related data (sales, products, customers, etc.)
      const response = await supabase.functions.invoke('delete-business', {
        body: { businessId, userId },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      console.log('Edge Function response status:', response.error ? 'ERROR' : 'SUCCESS');
      console.log('Response data:', response.data);
      console.log('Response error:', response.error);

      if (response.error) {
        console.error('Error calling delete-business function:', response.error);

        // Log the actual response body to see the error message
        if (response.data) {
          console.error('Response data from function:', JSON.stringify(response.data, null, 2));
        }

        // Extract error message from response data (the actual error from the function)
        const errorMessage = response.data?.error || response.data?.message || response.error.message || 'Failed to delete business';
        throw new Error(errorMessage);
      }

      if (response.data?.error) {
        console.error('Error from delete-business function:', response.data.error);
        throw new Error(response.data.error);
      }

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
