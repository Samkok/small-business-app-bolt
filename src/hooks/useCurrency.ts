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
    const c = currencyId ? currencies.find(cur => cur.id === currencyId) : defaultCurrency;
    const decimals = c?.decimal_places ?? 2;
    return formatCurrency(amount, symbol, decimals);
  }, [currencies, defaultCurrency, getSymbol]);

  return {
    currencies,
    defaultCurrency,
    loading,
    formatPrice,
    getSymbol,
    refreshCurrencies: loadCurrencies,
  };
}
