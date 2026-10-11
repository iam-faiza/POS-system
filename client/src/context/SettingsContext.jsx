import React, { createContext, useContext, useState, useEffect } from 'react';
import { CURRENCIES, TRANSLATIONS, canConvertCurrency, formatCurrency } from '../utils/i18n';

const SettingsContext = createContext();

export function SettingsProvider({ children }) {
  const [theme, setThemeState] = useState(() => {
    return localStorage.getItem('pos_theme') || 'light';
  });

  const [language, setLanguageState] = useState(() => {
    return localStorage.getItem('pos_lang') || 'en';
  });

  const [currency, setCurrencyState] = useState(() => {
    const storedCurrency = localStorage.getItem('pos_currency') || 'PKR';
    return canConvertCurrency(storedCurrency) ? storedCurrency : 'PKR';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('pos_theme', theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.setAttribute('lang', language);
    document.documentElement.setAttribute('dir', language === 'ur' ? 'rtl' : 'ltr');
    localStorage.setItem('pos_lang', language);
  }, [language]);

  useEffect(() => {
    localStorage.setItem('pos_currency', currency);
  }, [currency]);

  const toggleTheme = () => {
    setThemeState((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  const setLanguage = (lang) => {
    if (TRANSLATIONS[lang]) {
      setLanguageState(lang);
    }
  };

  const setCurrency = (cur) => {
    if (CURRENCIES[cur] && canConvertCurrency(cur)) {
      setCurrencyState(cur);
    }
  };

  const t = (key) => {
    const dict = TRANSLATIONS[language] || TRANSLATIONS.en;
    return dict[key] || TRANSLATIONS.en[key] || key;
  };

  const formatPrice = (amountInPKR, showSecondary = false) => {
    return formatCurrency(amountInPKR, currency, showSecondary);
  };

  return (
    <SettingsContext.Provider
      value={{
        theme,
        toggleTheme,
        language,
        setLanguage,
        currency,
        setCurrency,
        t,
        formatPrice,
        availableCurrencies: Object.values(CURRENCIES)
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}
