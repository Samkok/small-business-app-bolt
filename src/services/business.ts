import { supabase } from '@/src/config/supabase';

export interface DeletePreview {
  salesCount: number;
  expensesCount: number;
  customersCount: number;
  productsCount: number;
  cartsCount: number;
  teamMembersCount: number;
}

export interface CreateBusinessResult {
  allowed: boolean;
  currentCount: number;
  maxAllowed: number | null;
  reason?: string;
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
        .select('*, access_state')
        .eq('owner_user_id', userId);

      if (ownedError) throw ownedError;

      const { data: memberBusinesses, error: memberError } = await supabase
        .from('user_business_roles')
        .select('business_id, businesses(*, access_state)')
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
  },

  async canUserCreateBusiness(userId: string): Promise<CreateBusinessResult> {
    try {
      const { data, error } = await supabase.rpc('can_user_create_business', {
        p_user_id: userId
      });

      if (error) throw error;

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('subscription_tier, max_owned_businesses')
        .eq('id', userId)
        .maybeSingle();

      const { count: currentCount } = await supabase
        .from('businesses')
        .select('id', { count: 'exact', head: true })
        .eq('owner_user_id', userId);

      const maxAllowed = profile?.max_owned_businesses || 1;
      const allowed = data === true;

      return {
        allowed,
        currentCount: currentCount || 0,
        maxAllowed,
        reason: allowed ? undefined : `Your ${profile?.subscription_tier || 'free'} tier allows ${maxAllowed} business${maxAllowed === 1 ? '' : 'es'}. You currently own ${currentCount}.`
      };
    } catch (error) {
      console.error('Error checking if user can create business:', error);
      return {
        allowed: false,
        currentCount: 0,
        maxAllowed: 1,
        reason: 'Error checking business creation limit'
      };
    }
  },

  async getBusinessAccessState(businessId: string): Promise<'active' | 'read_only_sales'> {
    try {
      const { data, error } = await supabase
        .from('businesses')
        .select('access_state')
        .eq('id', businessId)
        .maybeSingle();

      if (error) throw error;

      return data?.access_state || 'active';
    } catch (error) {
      console.error('Error getting business access state:', error);
      return 'active';
    }
  },

  async getUserOwnedBusinessesWithState(userId: string) {
    try {
      console.log('[BusinessService] Fetching owned businesses for user:', userId);

      const { data, error } = await supabase
        .from('businesses')
        .select('id, business_name, created_at, access_state, business_image_url')
        .eq('owner_user_id', userId);

      if (error) {
        console.error('[BusinessService] Error fetching businesses:', error);
        throw error;
      }

      console.log('[BusinessService] Found', (data || []).length, 'businesses');

      const businesses = (data || []).map(business => ({
        ...business,
        name: business.business_name
      }));

      console.log('[BusinessService] Returning businesses:', businesses.map(b => ({ id: b.id, name: b.name, access_state: b.access_state })));

      return businesses;
    } catch (error) {
      console.error('[BusinessService] Error getting owned businesses with state:', error);
      return [];
    }
  }
};
