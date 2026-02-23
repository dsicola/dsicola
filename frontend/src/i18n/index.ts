/**
 * Internacionalização (i18n) - pt-BR, pt-AO, en
 * Uso: import { useTranslation } from 'react-i18next'; const { t } = useTranslation();
 */
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import ptBR from './locales/pt-BR';
import ptAO from './locales/pt-AO';
import en from './locales/en';

const resources = {
  'pt-BR': { translation: ptBR },
  'pt-AO': { translation: ptAO },
  en: { translation: en },
};

const savedLng = typeof localStorage !== 'undefined' ? localStorage.getItem('i18nextLng') : null;

i18n.use(initReactI18next).init({
  resources,
  lng: savedLng || 'pt-BR',
  fallbackLng: 'pt-BR',
  supportedLngs: ['pt-BR', 'pt-AO', 'en'],
  interpolation: { escapeValue: false },
});

export default i18n;
