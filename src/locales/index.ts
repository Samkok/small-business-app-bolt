import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { useTranslation as useReactI18nTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Import translations
import en from './en.json';
import km from './km.json';
import zh from './zh.json';

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

// Export a wrapped version of useTranslation to ensure it's properly initialized
export const useTranslation = () => {
  return useReactI18nTranslation();
};

export default i18n;