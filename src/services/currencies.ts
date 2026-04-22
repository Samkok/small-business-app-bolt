import { supabase } from '@/src/config/supabase';

export interface Currency {
  id: string;
  business_id: string;
  code: string;
  name: string;
  symbol: string;
  exchange_rate: number;
  is_default: boolean;
  decimal_places: number;
  created_at: string;
  updated_at: string;
}

export const currencyService = {
  async getCurrencies(businessId: string): Promise<Currency[]> {
    if (!businessId) return [];
    const { data, error } = await supabase
      .from('currencies')
      .select('*')
      .eq('business_id', businessId)
      .order('is_default', { ascending: false })
      .order('code');
    if (error) throw error;
    return (data || []) as Currency[];
  },

  async getDefaultCurrency(businessId: string): Promise<Currency | null> {
    if (!businessId) return null;
    const { data, error } = await supabase
      .from('currencies')
      .select('*')
      .eq('business_id', businessId)
      .eq('is_default', true)
      .maybeSingle();
    if (error) throw error;
    return data as Currency | null;
  },

  async getCurrency(id: string): Promise<Currency | null> {
    if (!id) return null;
    const { data, error } = await supabase
      .from('currencies')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data as Currency | null;
  },

  async createCurrency(currency: Omit<Currency, 'id' | 'created_at' | 'updated_at'>): Promise<Currency> {
    const { data, error } = await supabase
      .from('currencies')
      .insert(currency)
      .select()
      .single();
    if (error) throw error;
    return data as Currency;
  },

  async updateCurrency(id: string, updates: Partial<Currency>): Promise<Currency> {
    const { data, error } = await supabase
      .from('currencies')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as Currency;
  },

  async deleteCurrency(id: string): Promise<void> {
    const { error } = await supabase
      .from('currencies')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  async setDefaultCurrency(businessId: string, currencyId: string): Promise<void> {
    const { error: clearError } = await supabase
      .from('currencies')
      .update({ is_default: false })
      .eq('business_id', businessId);
    if (clearError) throw clearError;

    const { error: setError } = await supabase
      .from('currencies')
      .update({ is_default: true })
      .eq('id', currencyId);
    if (setError) throw setError;
  },
};
