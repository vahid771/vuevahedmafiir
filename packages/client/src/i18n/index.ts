import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import en from './en.json';
import fa from './fa.json';
import ar from './ar.json';
import zh from './zh.json';
import hi from './hi.json';
import es from './es.json';
import fr from './fr.json';
import de from './de.json';
import pt from './pt.json';
import ru from './ru.json';
import tr from './tr.json';
import id from './id.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      fa: { translation: fa },
      ar: { translation: ar },
      zh: { translation: zh },
      hi: { translation: hi },
      es: { translation: es },
      fr: { translation: fr },
      de: { translation: de },
      pt: { translation: pt },
      ru: { translation: ru },
      tr: { translation: tr },
      id: { translation: id },
    },
    fallbackLng: 'en',
    supportedLngs: ['en', 'fa', 'ar', 'zh', 'hi', 'es', 'fr', 'de', 'pt', 'ru', 'tr', 'id'],
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['htmlTag', 'navigator'],
      caches: [],
    },
  });

export default i18n;
