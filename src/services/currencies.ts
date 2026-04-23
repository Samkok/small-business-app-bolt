import { supabase } from '@/src/config/supabase';

export interface Currency {
  id: string;
  business_id: string;
  code: string;
  name: string;
  symbol: string;
  exchange_rate_to_usd: number;
  is_default: boolean;
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

  async createCurrency(input: {
    business_id: string;
    code: string;
    name: string;
    symbol: string;
    exchange_rate_to_usd: number;
    is_default?: boolean;
  }): Promise<Currency> {
    const { data, error } = await supabase
      .from('currencies')
      .insert({
        business_id: input.business_id,
        code: input.code.toUpperCase().trim(),
        name: input.name.trim(),
        symbol: input.symbol.trim(),
        exchange_rate_to_usd: input.exchange_rate_to_usd,
        is_default: input.is_default ?? false,
      })
      .select()
      .single();
    if (error) {
      if ((error as any).code === '23505') {
        throw new Error('A currency with this code already exists for this business');
      }
      throw error;
    }
    return data as Currency;
  },

  async updateCurrency(
    id: string,
    updates: Partial<Pick<Currency, 'name' | 'symbol' | 'exchange_rate_to_usd'>>,
  ): Promise<Currency> {
    const { data, error } = await supabase
      .from('currencies')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as Currency;
  },

  async deleteCurrency(id: string): Promise<void> {
    const existing = await this.getCurrency(id);
    if (!existing) return;
    if (existing.is_default) {
      throw new Error('Cannot delete the default currency');
    }
    const { error } = await supabase.from('currencies').delete().eq('id', id);
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

  convertToDefault(amount: number, fromRateToUsd: number, defaultRateToUsd: number): number {
    if (!fromRateToUsd || !defaultRateToUsd) return amount;
    if (fromRateToUsd === defaultRateToUsd) return amount;
    const usdAmount = amount / fromRateToUsd;
    return usdAmount * defaultRateToUsd;
  },
};
