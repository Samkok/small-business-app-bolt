import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n from '@/src/locales';

interface LanguageContextType {
  isI18nReady: boolean;
  currentLanguage: string;
  changeLanguage: (language: string) => Promise<void>;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

interface LanguageProviderProps {
  children: ReactNode;
}

const LANGUAGE_STORAGE_KEY = 'language';
const DEFAULT_LANGUAGE = 'en';

export function LanguageProvider({ children }: LanguageProviderProps) {
  const [isI18nReady, setIsI18nReady] = useState(false);
  const [currentLanguage, setCurrentLanguage] = useState(DEFAULT_LANGUAGE);

  useEffect(() => {
    initializeLanguage();
  }, []);

  const initializeLanguage = async () => {
    try {
      const savedLanguage = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
      const languageToUse = savedLanguage || DEFAULT_LANGUAGE;

      await i18n.changeLanguage(languageToUse);
      setCurrentLanguage(languageToUse);
    } catch (error) {
      console.error('Failed to load saved language, using default:', error);
      await i18n.changeLanguage(DEFAULT_LANGUAGE);
      setCurrentLanguage(DEFAULT_LANGUAGE);
    } finally {
      setIsI18nReady(true);
    }
  };

  const changeLanguage = async (language: string) => {
    try {
      await i18n.changeLanguage(language);
      await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, language);
      setCurrentLanguage(language);
    } catch (error) {
      console.error('Failed to change language:', error);
      throw error;
    }
  };

  const value: LanguageContextType = {
    isI18nReady,
    currentLanguage,
    changeLanguage,
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextType {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
