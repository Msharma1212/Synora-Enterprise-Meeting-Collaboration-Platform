import { useLanguage } from '../context/LanguageContext';

export const useTranslation = () => {
  const { t, language, localeCode, setLanguage } = useLanguage();
  return { t, language, localeCode, setLanguage };
};
