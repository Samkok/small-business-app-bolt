import { supabase } from '../config/supabase';
import { Database } from '../types/database';

type Customer = Database['public']['Tables']['customers']['Row'];
type CustomerInsert = Database['public']['Tables']['customers']['Insert'];
type CustomerUpdate = Database['public']['Tables']['customers']['Update'];

export const customerService = {
  async getCustomers(businessId: string) {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('business_id', businessId)
      .order('name');

    if (error) throw error;
    return data;
  },

  async getCustomer(id: string) {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  },

  async createCustomer(customer: CustomerInsert) {
    const { data, error } = await supabase
      .from('customers')
      .insert(customer)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateCustomer(id: string, updates: CustomerUpdate) {
    const { data, error } = await supabase
      .from('customers')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async deleteCustomer(id: string) {
    const { error } = await supabase
      .from('customers')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  async searchCustomers(businessId: string, query: string) {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('business_id', businessId)
      .or(`name.ilike.%${query}%,phone.ilike.%${query}%`)
      .order('name');

    if (error) throw error;
    return data;
  },

  async enrichCustomerProfile(customerId: string, updates: {
    platform?: string;
    phone?: string;
    address?: string;
    notes?: string;
  }) {
    const { data, error } = await supabase
      .from('customers')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', customerId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async getPlatformUsage(businessId: string) {
    const { data, error } = await supabase
      .from('customers')
      .select('platform, count')
      .eq('business_id', businessId)
      .not('platform', 'is', null)
      .group('platform');

    if (error) throw error;

    // Convert the result to a map of platform -> count
    const platformUsage: Record<string, number> = {};
    data.forEach((item: any) => {
      platformUsage[item.platform] = parseInt(item.count);
    });

    return platformUsage;
  },

  async getCustomersByPlatform(businessId: string, platform: string) {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('business_id', businessId)
      .eq('platform', platform)
      .order('name');

    if (error) throw error;
    return data;
  },

  async updateCustomerPlatform(customerId: string, platform: string | null) {
    const { data, error } = await supabase
      .from('customers')
      .update({ 
        platform, 
        updated_at: new Date().toISOString() 
      })
      .eq('id', customerId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async bulkUpdateCustomerPlatform(customerIds: string[], platform: string | null) {
    const { data, error } = await supabase
      .from('customers')
      .update({ 
        platform, 
        updated_at: new Date().toISOString() 
      })
      .in('id', customerIds)
      .select();

    if (error) throw error;
    return data;
  }
};