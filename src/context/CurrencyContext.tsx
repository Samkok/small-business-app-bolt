import React, { createContext, useContext, useCallback, useEffect, useState } from 'react';
import { currencyService, Currency } from '@/src/services/currencies';
import { formatCurrency } from '@/src/utils/formatCurrency';
import { useAuth } from './AuthContext';

interface CurrencyContextType {
  currencies: Currency[];
  defaultCurrency: Currency | null;
  defaultSymbol: string;
  formatPrice: (amount: number, currencyId?: string) => string;
  getSymbol: (currencyId?: string) => string;
  refreshCurrencies: () => Promise<void>;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const { currentBusiness } = useAuth();
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [defaultCurrency, setDefaultCurrency] = useState<Currency | null>(null);

  const loadCurrencies = useCallback(async () => {
    if (!currentBusiness?.id) {
      setCurrencies([]);
      setDefaultCurrency(null);
      return;
    }
    try {
      const [all, def] = await Promise.all([
        currencyService.getCurrencies(currentBusiness.id),
        currencyService.getDefaultCurrency(currentBusiness.id),
      ]);
      setCurrencies(all);
      setDefaultCurrency(def);
    } catch (err) {
      console.error('CurrencyContext: failed to load currencies', err);
    }
  }, [currentBusiness?.id]);

  useEffect(() => {
    loadCurrencies();
  }, [loadCurrencies]);

  const getSymbol = useCallback((currencyId?: string): string => {
    if (currencyId) {
      const found = currencies.find(c => c.id === currencyId);
      if (found) return found.symbol;
    }
    return defaultCurrency?.symbol ?? '$';
  }, [currencies, defaultCurrency]);

  const formatPrice = useCallback((amount: number, currencyId?: string): string => {
    return formatCurrency(amount, getSymbol(currencyId));
  }, [getSymbol]);

  const defaultSymbol = defaultCurrency?.symbol ?? '$';

  return (
    <CurrencyContext.Provider
      value={{ currencies, defaultCurrency, defaultSymbol, formatPrice, getSymbol, refreshCurrencies: loadCurrencies }}
    >
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrencyContext(): CurrencyContextType {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error('useCurrencyContext must be used within CurrencyProvider');
  return ctx;
}
