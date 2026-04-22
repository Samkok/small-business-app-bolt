import { useState, useEffect, useCallback } from 'react';
import { currencyService, Currency } from '@/src/services/currencies';
import { formatCurrency } from '@/src/utils/formatCurrency';

export function useCurrency(businessId?: string) {
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [defaultCurrency, setDefaultCurrency] = useState<Currency | null>(null);
  const [loading, setLoading] = useState(false);

  const loadCurrencies = useCallback(async () => {
    if (!businessId) return;
    setLoading(true);
    try {
      const [all, def] = await Promise.all([
        currencyService.getCurrencies(businessId),
        currencyService.getDefaultCurrency(businessId),
      ]);
      setCurrencies(all);
      setDefaultCurrency(def);
    } catch (err) {
      console.error('useCurrency: failed to load currencies', err);
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    loadCurrencies();
  }, [loadCurrencies]);

  const getSymbol = useCallback((currencyId?: string): string => {
    if (currencyId) {
      const c = currencies.find(cur => cur.id === currencyId);
      if (c) return c.symbol;
    }
    return defaultCurrency?.symbol || '$';
  }, [currencies, defaultCurrency]);

  const formatPrice = useCallback((amount: number, currencyId?: string): string => {
    const symbol = getSymbol(currencyId);
    return formatCurrency(amount, symbol, 2);
  }, [getSymbol]);

  const convertToDefault = useCallback((amount: number, fromCurrencyId?: string): number => {
    if (!fromCurrencyId || !defaultCurrency) return amount;
    const from = currencies.find(c => c.id === fromCurrencyId);
    if (!from || from.id === defaultCurrency.id) return amount;
    const usd = amount / Number(from.exchange_rate_to_usd || 1);
    return usd * Number(defaultCurrency.exchange_rate_to_usd || 1);
  }, [currencies, defaultCurrency]);

  const convertBetween = useCallback((amount: number, fromCurrencyId?: string, toCurrencyId?: string): number => {
    const from = fromCurrencyId ? currencies.find(c => c.id === fromCurrencyId) : defaultCurrency;
    const to = toCurrencyId ? currencies.find(c => c.id === toCurrencyId) : defaultCurrency;
    if (!from || !to || from.id === to.id) return amount;
    const usd = amount / Number(from.exchange_rate_to_usd || 1);
    return usd * Number(to.exchange_rate_to_usd || 1);
  }, [currencies, defaultCurrency]);

  return {
    currencies,
    defaultCurrency,
    loading,
    formatPrice,
    getSymbol,
    convertToDefault,
    convertBetween,
    refreshCurrencies: loadCurrencies,
  };
}
