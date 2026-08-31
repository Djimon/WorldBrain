import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import enCommon from './locales/en/common.json';
import enNav from './locales/en/nav.json';
import enEntity from './locales/en/entity.json';
import enMap from './locales/en/map.json';
import enSession from './locales/en/session.json';
import enMultiplayer from './locales/en/multiplayer.json';

import deCommon from './locales/de/common.json';
import deNav from './locales/de/nav.json';
import deEntity from './locales/de/entity.json';
import deMap from './locales/de/map.json';
import deSession from './locales/de/session.json';
import deMultiplayer from './locales/de/multiplayer.json';

const savedLang = typeof localStorage !== 'undefined' ? (localStorage.getItem('lang') ?? 'de') : 'de';

void i18n.use(initReactI18next).init({
  resources: {
    en: {
      common: enCommon,
      nav: enNav,
      entity: enEntity,
      map: enMap,
      session: enSession,
      multiplayer: enMultiplayer,
    },
    de: {
      common: deCommon,
      nav: deNav,
      entity: deEntity,
      map: deMap,
      session: deSession,
      multiplayer: deMultiplayer,
    },
  },
  lng: savedLang,
  fallbackLng: 'en' as string,
  defaultNS: 'common',
  interpolation: { escapeValue: false },
});

export default i18n;
