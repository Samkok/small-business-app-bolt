export interface LanguageOption {
  code: string;
  label: string;
  nativeLabel: string;
}

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  {
    code: 'en',
    label: 'English',
    nativeLabel: 'English',
  },
  {
    code: 'km',
    label: 'Khmer',
    nativeLabel: 'ខ្មែរ',
  },
  {
    code: 'zh',
    label: 'Chinese',
    nativeLabel: '中文',
  },
];

export function getSupportedLanguages(): LanguageOption[] {
  return SUPPORTED_LANGUAGES;
}

export function getLanguageLabel(languageCode: string): string {
  const language = SUPPORTED_LANGUAGES.find((lang) => lang.code === languageCode);
  return language?.label || languageCode;
}

export function getLanguageNativeLabel(languageCode: string): string {
  const language = SUPPORTED_LANGUAGES.find((lang) => lang.code === languageCode);
  return language?.nativeLabel || languageCode;
}

export function isLanguageSupported(languageCode: string): boolean {
  return SUPPORTED_LANGUAGES.some((lang) => lang.code === languageCode);
}

export function getDefaultLanguage(): string {
  return 'en';
}
