import { en } from './locales/en.js';
import { es } from './locales/es.js';
import { fr } from './locales/fr.js';
import { de } from './locales/de.js';
import { ar } from './locales/ar.js';
import { yo } from './locales/yo.js';
import { ha } from './locales/ha.js';
import { ig } from './locales/ig.js';
import { zh } from './locales/zh.js';
import { PHRASE_DICTIONARY } from './phraseDictionary.js';

export type LanguageCode = 'en' | 'es' | 'fr' | 'de' | 'ar' | 'yo' | 'ha' | 'ig' | 'zh';

export interface LanguageInfo {
  code: LanguageCode;
  name: string;
  nativeName: string;
  flag: string;
  dir: 'ltr' | 'rtl';
}

export const SUPPORTED_LANGUAGES: LanguageInfo[] = [
  { code: 'en', name: 'English', nativeName: 'English', flag: '🇺🇸', dir: 'ltr' },
  { code: 'es', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸', dir: 'ltr' },
  { code: 'fr', name: 'French', nativeName: 'Français', flag: '🇫🇷', dir: 'ltr' },
  { code: 'de', name: 'German', nativeName: 'Deutsch', flag: '🇩🇪', dir: 'ltr' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', flag: '🇸🇦', dir: 'rtl' },
  { code: 'yo', name: 'Yoruba', nativeName: 'Èdè Yorùbá', flag: '🇳🇬', dir: 'ltr' },
  { code: 'ha', name: 'Hausa', nativeName: 'Harshen Hausa', flag: '🇳🇬', dir: 'ltr' },
  { code: 'ig', name: 'Igbo', nativeName: 'Asụsụ Igbo', flag: '🇳🇬', dir: 'ltr' },
  { code: 'zh', name: 'Chinese', nativeName: '中文', flag: '🇨🇳', dir: 'ltr' },
];

const TRANSLATIONS: Record<LanguageCode, any> = {
  en,
  es,
  fr,
  de,
  ar,
  yo,
  ha,
  ig,
  zh,
};

class I18nManager {
  private currentLanguage: LanguageCode = 'en';
  private listeners: Set<(lang: LanguageCode) => void> = new Set();

  constructor() {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('stockora_mini_language') as LanguageCode;
      if (stored && TRANSLATIONS[stored]) {
        this.currentLanguage = stored;
      }
      this.updateDocumentDirection();
    }
  }

  public getLanguage(): LanguageCode {
    return this.currentLanguage;
  }

  public setLanguage(lang: LanguageCode) {
    if (!TRANSLATIONS[lang]) return;
    this.currentLanguage = lang;
    if (typeof window !== 'undefined') {
      localStorage.setItem('stockora_mini_language', lang);
      this.updateDocumentDirection();
    }
    this.listeners.forEach((cb) => cb(lang));
  }

  public subscribe(cb: (lang: LanguageCode) => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  public isRTL(): boolean {
    const langInfo = SUPPORTED_LANGUAGES.find((l) => l.code === this.currentLanguage);
    return langInfo?.dir === 'rtl';
  }

  private updateDocumentDirection() {
    if (typeof document !== 'undefined') {
      const isRtl = this.isRTL();
      document.documentElement.dir = isRtl ? 'rtl' : 'ltr';
      document.documentElement.lang = this.currentLanguage;
    }
  }

  /**
   * Translate key using dot notation (e.g. 'dashboard.totalRevenue')
   * or direct phrase dictionary lookup (e.g. 'Sales Analytics' or 'Real-Time Inventory Master')
   */
  public t(key: string, params?: Record<string, string | number>): string {
    if (!key) return '';

    // 1. Try phrase dictionary direct match for the active language
    const phraseMatch = PHRASE_DICTIONARY[this.currentLanguage]?.[key];
    if (phraseMatch) {
      return this.interpolate(phraseMatch, params);
    }

    // 2. Try dot notation resolution in structured locale files
    const parts = key.split('.');
    let current: any = TRANSLATIONS[this.currentLanguage];
    let fallback: any = TRANSLATIONS['en'];

    for (const part of parts) {
      if (current && typeof current === 'object' && part in current) {
        current = current[part];
      } else {
        current = null;
      }

      if (fallback && typeof fallback === 'object' && part in fallback) {
        fallback = fallback[part];
      } else {
        fallback = null;
      }
    }

    let text =
      typeof current === 'string' ? current : typeof fallback === 'string' ? fallback : null;

    // 3. Fallback to English phrase dictionary or key
    if (!text) {
      text = PHRASE_DICTIONARY['en']?.[key] || key;
    }

    return this.interpolate(text, params);
  }

  private interpolate(text: string, params?: Record<string, string | number>): string {
    if (!params) return text;
    let result = text;
    for (const [paramKey, paramVal] of Object.entries(params)) {
      result = result.replace(new RegExp(`{${paramKey}}`, 'g'), String(paramVal));
    }
    return result;
  }
}

export const i18n = new I18nManager();
