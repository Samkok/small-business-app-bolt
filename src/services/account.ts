import { supabase, supabaseUrl } from '@/src/config/supabase';
import { businessService } from './business';

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
      console.log('[accountService.deleteAccount] Starting account deletion for user:', userId);

      // Step 1: Delete all owned businesses using the secure Edge Function
      const ownedBusinesses = await this.getOwnedBusinesses(userId);
      console.log(`[accountService.deleteAccount] Found ${ownedBusinesses.length} owned businesses to delete`);

      for (const business of ownedBusinesses) {
        console.log(`[accountService.deleteAccount] Deleting business: ${business.id} (${business.business_name})`);
        try {
          // Use the secure businessService.deleteBusiness which calls the Edge Function
          // This ensures proper authorization and audit logging
          await businessService.deleteBusiness(business.id, userId);
          console.log(`[accountService.deleteAccount] Successfully deleted business: ${business.id}`);
        } catch (businessError) {
          console.error(`[accountService.deleteAccount] Failed to delete business ${business.id}:`, businessError);
          throw new Error(`Failed to delete business "${business.business_name}": ${businessError instanceof Error ? businessError.message : String(businessError)}`);
        }
      }

      // Step 2: Delete user's business role memberships
      // Note: Owned business roles are already deleted by CASCADE when business was deleted
      // This removes roles where user is a member (not owner) of other businesses
      console.log('[accountService.deleteAccount] Deleting user business role memberships');
      const { error: rolesError } = await supabase
        .from('user_business_roles')
        .delete()
        .eq('user_id', userId);

      if (rolesError) {
        console.error('[accountService.deleteAccount] Failed to delete user business roles:', rolesError);
        throw new Error(`Failed to remove business memberships: ${rolesError.message}`);
      }

      // Step 3: Delete user profile
      console.log('[accountService.deleteAccount] Deleting user profile');
      const { error: profileError } = await supabase
        .from('user_profiles')
        .delete()
        .eq('user_id', userId);

      if (profileError) {
        console.error('[accountService.deleteAccount] Failed to delete user profile:', profileError);
        throw new Error(`Failed to delete user profile: ${profileError.message}`);
      }

      // Step 4: Delete auth user using Edge Function
      console.log('[accountService.deleteAccount] Deleting auth user via Edge Function');
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No active session. Please sign in again.');
      }

      const functionUrl = `${supabaseUrl}/functions/v1/delete-auth-user`;

      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('[accountService.deleteAccount] Failed to delete auth user:', errorData);
        throw new Error(`Failed to delete auth user: ${errorData.error || 'Unknown error'}`);
      }

      console.log('[accountService.deleteAccount] Account and auth user deleted successfully:', userId);
    } catch (error) {
      console.error('[accountService.deleteAccount] Error during account deletion:', error);
      throw error;
    }
  }
};
