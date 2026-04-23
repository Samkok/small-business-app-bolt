import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { currencyService, Currency } from '@/src/services/currencies';
import { formatCurrency } from '@/src/utils/formatCurrency';
import { useAuth } from '@/src/context/AuthContext';

interface CurrencyContextValue {
  currencies: Currency[];
  defaultCurrency: Currency | null;
  loading: boolean;
  getSymbol: (currencyId?: string) => string;
  formatPrice: (amount: number, currencyId?: string) => string;
  refreshCurrencies: () => void;
}

const CurrencyContext = createContext<CurrencyContextValue>({
  currencies: [],
  defaultCurrency: null,
  loading: false,
  getSymbol: () => '$',
  formatPrice: (amount) => `$${amount.toFixed(2)}`,
  refreshCurrencies: () => {},
});

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const { currentBusiness } = useAuth();
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [defaultCurrency, setDefaultCurrency] = useState<Currency | null>(null);
  const [loading, setLoading] = useState(false);

  const loadCurrencies = useCallback(async () => {
    if (!currentBusiness?.id) {
      setCurrencies([]);
      setDefaultCurrency(null);
      return;
    }
    setLoading(true);
    try {
      const [all, def] = await Promise.all([
        currencyService.getCurrencies(currentBusiness.id),
        currencyService.getDefaultCurrency(currentBusiness.id),
      ]);
      setCurrencies(all);
      setDefaultCurrency(def);
    } catch (err) {
      console.error('CurrencyContext: failed to load currencies', err);
    } finally {
      setLoading(false);
    }
  }, [currentBusiness?.id]);

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
    return formatCurrency(amount, getSymbol(currencyId), 2);
  }, [getSymbol]);

  return (
    <CurrencyContext.Provider value={{ currencies, defaultCurrency, loading, getSymbol, formatPrice, refreshCurrencies: loadCurrencies }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrencyContext(): CurrencyContextValue {
  return useContext(CurrencyContext);
}
