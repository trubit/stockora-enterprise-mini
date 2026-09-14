import { useState, useEffect, useCallback } from 'react';
import { i18n, type LanguageCode, SUPPORTED_LANGUAGES } from '../i18n/i18n.js';

export function useTranslation() {
  const [language, setLanguageState] = useState<LanguageCode>(i18n.getLanguage());

  useEffect(() => {
    const unsubscribe = i18n.subscribe((newLang) => {
      setLanguageState(newLang);
    });
    return unsubscribe;
  }, []);

  const setLanguage = useCallback((lang: LanguageCode) => {
    i18n.setLanguage(lang);
  }, []);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) => {
      return i18n.t(key, params);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [language]
  );

  return {
    t,
    language,
    setLanguage,
    isRTL: i18n.isRTL(),
    supportedLanguages: SUPPORTED_LANGUAGES,
  };
}
