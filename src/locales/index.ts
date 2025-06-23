import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Import translations
import en from './en.json';
import km from './km.json';
import zh from './zh.json';

// Polyfill for Intl.PluralRules if not available
if (!Intl.PluralRules) {
  // Simple polyfill for basic plural rules
  (global as any).Intl = (global as any).Intl || {};
  (global as any).Intl.PluralRules = class PluralRules {
    constructor(locale?: string) {
      this.locale = locale || 'en';
    }
    
    select(n: number): string {
      // Simple English-like plural rules
      if (n === 1) return 'one';
      return 'other';
    }
    
    private locale: string;
  };
}

const resources = {
  en: { translation: en },
  km: { translation: km },
  zh: { translation: zh },
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: 'en', // Default language
    fallbackLng: 'en',
    compatibilityJSON: 'v3', // Use v3 format for better compatibility
    interpolation: {
      escapeValue: false,
    },
    // Disable pluralization if it's causing issues
    pluralSeparator: '_',
    contextSeparator: '_',
  });

// Load saved language
AsyncStorage.getItem('language').then((savedLanguage) => {
  if (savedLanguage) {
    i18n.changeLanguage(savedLanguage);
  }
});

export default i18n;