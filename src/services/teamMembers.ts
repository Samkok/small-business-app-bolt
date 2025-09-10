import { supabase } from '../config/supabase';
import { Database } from '../types/database';

type UserBusinessRole = Database['public']['Tables']['user_business_roles']['Row'];
type UserProfile = Database['public']['Tables']['user_profiles']['Row'];

export interface TeamMember {
  user_id: string;
  business_id: string;
  role: 'admin' | 'staff';
  user_name: string;
  user_email: string;
  created_at: string;
  updated_at: string;
}

export const teamMemberService = {
  /**
   * Get the current user's role in a specific business
   */
  async getCurrentUserRole(businessId: string, userId: string): Promise<'admin' | 'staff' | null> {
    try {
      const { data, error } = await supabase
        .from('user_business_roles')
        .select('role')
        .eq('business_id', businessId)
        .eq('user_id', userId)
        .single();

      if (error) {
        console.error('Error fetching current user role:', error);
        return null;
      }

      return data.role as 'admin' | 'staff';
    } catch (error) {
      console.error('Error in getCurrentUserRole:', error);
      return null;
    }
  },

  /**
   * Get team members based on user role
   * Admins see all members, staff see only themselves
   */
  async getTeamMembers(businessId: string, currentUserId: string, currentUserRole: 'admin' | 'staff'): Promise<TeamMember[]> {
    try {
      // Build the query based on user role
      let query = supabase
        .from('user_business_roles')
        .select(`
          user_id,
          business_id,
          role,
          created_at,
          updated_at
        `)
        .eq('business_id', businessId);

      // If user is staff, only show their own profile
      // if (currentUserRole === 'staff') {
      //   query = query.eq('user_id', currentUserId);
      // }
      

      const { data: roles, error: rolesError } = await query;
      
      if (rolesError) throw rolesError;

      // Get user profiles for names and emails
      const userIds = roles.map(role => role.user_id);
      const { data: profiles, error: profilesError } = await supabase
        .from('user_profiles')
        .select('user_id, full_name, email')
        .in('user_id', userIds);

      if (profilesError) {
        console.warn('Could not fetch user profiles:', profilesError);
      }

      // Combine the data
      const members: TeamMember[] = roles.map(role => ({
        user_id: role.user_id,
        business_id: role.business_id,
        role: role.role as 'admin' | 'staff',
        user_name: profiles?.find(p => p.user_id === role.user_id)?.full_name || 'Unnamed User',
        user_email: profiles?.find(p => p.user_id === role.user_id)?.email || 'No email',
        created_at: role.created_at,
        updated_at: role.updated_at
      }));

      console.log(members);

      return members;
    } catch (error) {
      console.error('Error loading team members:', error);
      throw error;
    }
  },

  /**
   * Invite a user to join the business
   */
  async inviteUser(businessId: string, userEmail: string, role: 'admin' | 'staff'): Promise<boolean> {
    try {
      const { data, error } = await supabase.rpc('invite_user_to_business', {
        business_id_param: businessId,
        user_email_param: userEmail.trim(),
        role_param: role
      });

      if (error) {
        throw new Error(error.message || 'Failed to invite user');
      }

      return data;
    } catch (error) {
      console.error('Error inviting user:', error);
      throw error;
    }
  },

  /**
   * Change a user's role in the business
   */
  async changeUserRole(businessId: string, userId: string, newRole: 'admin' | 'staff'): Promise<boolean> {
    try {
      const { data, error } = await supabase.rpc('change_user_business_role', {
        business_id_param: businessId,
        user_id_param: userId,
        new_role_param: newRole
      });

      if (error) {
        throw new Error(error.message || 'Failed to change user role');
      }

      return data;
    } catch (error) {
      console.error('Error changing user role:', error);
      throw error;
    }
  },

  /**
   * Remove a user from the business
   */
  async removeUser(businessId: string, userId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase.rpc('remove_user_from_business', {
        business_id_param: businessId,
        user_id_param: userId
      });

      if (error) {
        throw new Error(error.message || 'Failed to remove user');
      }

      return data;
    } catch (error) {
      console.error('Error removing user:', error);
      throw error;
    }
  },

  /**
   * Check if a user can perform admin actions
   */
  canPerformAdminActions(currentUserRole: 'admin' | 'staff' | null): boolean {
    return currentUserRole === 'admin';
  },

  /**
   * Check if a user can modify another team member
   */
  canModifyMember(
    currentUserRole: 'admin' | 'staff' | null,
    targetUserId: string,
    currentUserId: string,
    businessOwnerId: string
  ): boolean {
    // Only admins can modify other users
    if (currentUserRole !== 'admin') return false;
    
    // Cannot modify yourself
    if (targetUserId === currentUserId) return false;
    
    // Cannot modify the business owner
    if (targetUserId === businessOwnerId) return false;
    
    return true;
  }
};