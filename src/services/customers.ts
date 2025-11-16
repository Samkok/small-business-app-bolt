import { supabase } from '../config/supabase';
import { Database } from '../types/database';
import { logger, ValidationError, DatabaseError } from '../lib';
import { sanitizeSearchQuery } from '../lib/validation';

type Customer = Database['public']['Tables']['customers']['Row'];
type CustomerInsert = Database['public']['Tables']['customers']['Insert'];
type CustomerUpdate = Database['public']['Tables']['customers']['Update'];

export const customerService = {
  async getCustomers(businessId: string): Promise<Customer[]> {
    if (!businessId) {
      logger.warn('getCustomers called without businessId');
      throw new ValidationError('Business ID is required');
    }

    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('business_id', businessId)
      .order('name');

    if (error) {
      logger.error('Failed to fetch customers', error, { businessId });
      throw new DatabaseError('Failed to fetch customers');
    }

    return data;
  },

  async getCustomer(id: string): Promise<Customer> {
    if (!id) {
      throw new ValidationError('Customer ID is required');
    }

    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      logger.error('Failed to fetch customer', error, { customerId: id });
      throw new DatabaseError('Failed to fetch customer');
    }

    return data;
  },

  async createCustomer(customer: CustomerInsert): Promise<Customer> {
    const { data, error } = await supabase
      .from('customers')
      .insert(customer)
      .select()
      .single();

    if (error) {
      logger.error('Failed to create customer', error, { customer });
      throw new DatabaseError('Failed to create customer');
    }

    logger.info('Customer created successfully', { customerId: data.id });
    return data;
  },

  async updateCustomer(id: string, updates: CustomerUpdate): Promise<Customer> {
    if (!id) {
      throw new ValidationError('Customer ID is required');
    }

    const { data, error } = await supabase
      .from('customers')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      logger.error('Failed to update customer', error, { customerId: id, updates });
      throw new DatabaseError('Failed to update customer');
    }

    return data;
  },

  async deleteCustomer(id: string): Promise<void> {
    if (!id) {
      throw new ValidationError('Customer ID is required');
    }

    const { error } = await supabase
      .from('customers')
      .delete()
      .eq('id', id);

    if (error) {
      logger.error('Failed to delete customer', error, { customerId: id });
      throw new DatabaseError('Failed to delete customer');
    }

    logger.info('Customer deleted successfully', { customerId: id });
  },

  async searchCustomers(businessId: string, query: string): Promise<Customer[]> {
    if (!businessId) {
      throw new ValidationError('Business ID is required');
    }
    if (!query) {
      throw new ValidationError('Search query is required');
    }

    const sanitizedQuery = sanitizeSearchQuery(query);

    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('business_id', businessId)
      .or(`name.ilike.%${sanitizedQuery}%,phone.ilike.%${sanitizedQuery}%`)
      .order('name');

    if (error) {
      logger.error('Failed to search customers', error, { businessId, query });
      throw new DatabaseError('Failed to search customers');
    }

    return data;
  },

  async enrichCustomerProfile(
    customerId: string,
    updates: {
      platform?: string;
      phone?: string;
      address?: string;
      notes?: string;
    }
  ): Promise<Customer> {
    if (!customerId) {
      throw new ValidationError('Customer ID is required');
    }

    const { data, error } = await supabase
      .from('customers')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', customerId)
      .select()
      .single();

    if (error) {
      logger.error('Failed to enrich customer profile', error, { customerId, updates });
      throw new DatabaseError('Failed to enrich customer profile');
    }

    return data;
  },

  async getPlatformUsage(businessId: string): Promise<Record<string, number>> {
    if (!businessId) {
      throw new ValidationError('Business ID is required');
    }

    const { data: customers, error } = await supabase
      .from('customers')
      .select('platform')
      .eq('business_id', businessId)
      .not('platform', 'is', null);

    if (error) {
      logger.error('Failed to get platform usage', error, { businessId });
      throw new DatabaseError('Failed to get platform usage');
    }

    const platformUsage: Record<string, number> = {};
    customers.forEach((customer) => {
      if (customer.platform) {
        platformUsage[customer.platform] = (platformUsage[customer.platform] || 0) + 1;
      }
    });

    return platformUsage;
  },

  async getCustomersByPlatform(businessId: string, platform: string): Promise<Customer[]> {
    if (!businessId) {
      throw new ValidationError('Business ID is required');
    }
    if (!platform) {
      throw new ValidationError('Platform is required');
    }

    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('business_id', businessId)
      .eq('platform', platform)
      .order('name');

    if (error) {
      logger.error('Failed to get customers by platform', error, { businessId, platform });
      throw new DatabaseError('Failed to get customers by platform');
    }

    return data;
  },

  async updateCustomerPlatform(customerId: string, platform: string | null): Promise<Customer> {
    if (!customerId) {
      throw new ValidationError('Customer ID is required');
    }

    const { data, error } = await supabase
      .from('customers')
      .update({
        platform,
        updated_at: new Date().toISOString(),
      })
      .eq('id', customerId)
      .select()
      .single();

    if (error) {
      logger.error('Failed to update customer platform', error, { customerId, platform });
      throw new DatabaseError('Failed to update customer platform');
    }

    return data;
  },

  async bulkUpdateCustomerPlatform(
    customerIds: string[],
    platform: string | null
  ): Promise<Customer[]> {
    if (!customerIds || customerIds.length === 0) {
      throw new ValidationError('Customer IDs are required');
    }

    const { data, error } = await supabase
      .from('customers')
      .update({
        platform,
        updated_at: new Date().toISOString(),
      })
      .in('id', customerIds)
      .select();

    if (error) {
      logger.error('Failed to bulk update customer platform', error, {
        customerCount: customerIds.length,
        platform,
      });
      throw new DatabaseError('Failed to bulk update customer platform');
    }

    return data;
  },
};