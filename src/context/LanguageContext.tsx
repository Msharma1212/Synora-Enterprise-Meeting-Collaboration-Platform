import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { translations } from '../lib/translations';
import api from '../services/api';

interface LanguageContextType {
  language: string;
  setLanguage: (lang: string) => Promise<void>;
  t: any;
  localeCode: string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, login } = useAuth();
  
  // Try to load initial language from localStorage, then user profile, defaulting to 'English (US)'
  const [language, setLanguageState] = useState<string>(() => {
    const saved = localStorage.getItem('synora_language');
    if (saved) return saved;
    return 'English (US)';
  });

  // Keep in sync with user's settings when user updates
  useEffect(() => {
    if (user?.settings?.language) {
      setLanguageState(user.settings.language);
      localStorage.setItem('synora_language', user.settings.language);
    }
  }, [user]);

  const setLanguage = async (newLang: string) => {
    setLanguageState(newLang);
    localStorage.setItem('synora_language', newLang);
    
    if (user) {
      try {
        const currentSettings = user.settings || {};
        const updatedSettings = {
          ...currentSettings,
          language: newLang
        };
        const { data } = await api.put('/auth/profile', { settings: updatedSettings });
        login(data);
      } catch (error) {
        console.error('Failed to sync language setting to server:', error);
      }
    }
  };

  const dict = translations[language] || translations['English (US)'];

  const formatFallback = (key: string): string => {
    return key
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, (str) => str.toUpperCase())
      .trim();
  };

  // Translation function as base for Proxy
  const tFn = (key: string, fallback?: string) => {
    if (key in dict) return dict[key];
    const englishDict = translations['English (US)'] || {};
    if (key in englishDict) return englishDict[key];
    return fallback !== undefined ? fallback : formatFallback(key);
  };

  // Proxy to support both:
  // 1. Property access: t.myKey
  // 2. Functional invocation: t('myKey', 'Fallback value')
  const t = new Proxy(tFn, {
    get(target, prop) {
      if (typeof prop === 'string') {
        if (prop in dict) {
          return dict[prop];
        }
        const englishDict = translations['English (US)'] || {};
        if (prop in englishDict) {
          return englishDict[prop];
        }
        return formatFallback(prop);
      }
      return Reflect.get(target, prop);
    },
    apply(target, thisArg, argumentsList) {
      const key = argumentsList[0];
      const fallback = argumentsList[1];
      if (typeof key !== 'string') return '';
      if (key in dict) {
        return dict[key];
      }
      const englishDict = translations['English (US)'] || {};
      if (key in englishDict) {
        return englishDict[key];
      }
      return fallback !== undefined ? fallback : formatFallback(key);
    }
  });

  const localeMap: Record<string, string> = {
    'English (US)': 'en-US',
    'Hindi (India)': 'hi-IN',
    'Spanish (ES)': 'es-ES',
    'French (FR)': 'fr-FR',
    'Arabic (AR)': 'ar-AE',
    'বাংলা': 'bn-BD'
  };

  const localeCode = localeMap[language] || 'en-US';

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, localeCode }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage must be used within LanguageProvider');
  return context;
};
