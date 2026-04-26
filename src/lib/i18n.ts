import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import HttpBackend from 'i18next-http-backend';
import LanguageDetector from 'i18next-browser-languagedetector';

export const SUPPORTED_LANGUAGES = [
  { code: 'en',    name: 'English',            nativeName: 'English',   dir: 'ltr' },
  { code: 'zh',    name: 'Chinese Simplified', nativeName: '简体中文',   dir: 'ltr' },
  { code: 'zh-TW', name: 'Chinese Traditional',nativeName: '繁體中文',   dir: 'ltr' },
  { code: 'hi',    name: 'Hindi',              nativeName: 'हिन्दी',     dir: 'ltr' },
  { code: 'es', name: 'Spanish',           nativeName: 'Español',   dir: 'ltr' },
  { code: 'fr', name: 'French',            nativeName: 'Français',  dir: 'ltr' },
  { code: 'ar', name: 'Arabic',            nativeName: 'العربية',   dir: 'rtl' },
  { code: 'bn', name: 'Bengali',           nativeName: 'বাংলা',      dir: 'ltr' },
  { code: 'pt', name: 'Portuguese',        nativeName: 'Português', dir: 'ltr' },
  { code: 'ru', name: 'Russian',           nativeName: 'Русский',   dir: 'ltr' },
  { code: 'ur', name: 'Urdu',              nativeName: 'اردو',      dir: 'rtl' },
  { code: 'ja', name: 'Japanese',          nativeName: '日本語',     dir: 'ltr' },
  { code: 'ko', name: 'Korean',            nativeName: '한국어',     dir: 'ltr' },
] as const;

export type LangCode = typeof SUPPORTED_LANGUAGES[number]['code'];
export const RTL_LANGS = new Set<string>(['ar', 'ur']);

export const LANG_STORAGE_KEY = 'billsplitter_language';

/** Apply dir + lang to <html> element */
export function applyLangToDOM(lng: string) {
  const dir = RTL_LANGS.has(lng) ? 'rtl' : 'ltr';
  document.documentElement.dir  = dir;
  document.documentElement.lang = lng;
}

i18n
  .use(HttpBackend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng:      'en',
    supportedLngs:    SUPPORTED_LANGUAGES.map(l => l.code),
    ns:               ['translation', 'analytics'],
    defaultNS:        'translation',
    returnEmptyString: false,
    backend: {
      loadPath: '/locales/{{lng}}/{{ns}}.json',
    },
    detection: {
      order:               ['localStorage', 'navigator'],
      caches:              ['localStorage'],
      lookupLocalStorage:  LANG_STORAGE_KEY,
    },
    interpolation: {
      escapeValue: false,
    },
    react: {
      useSuspense: true,
    },
  });

// Keep <html dir> and <html lang> in sync whenever language changes
i18n.on('languageChanged', applyLangToDOM);

// Apply immediately for the detected language before any component renders
applyLangToDOM(i18n.language ?? 'en');

export default i18n;
