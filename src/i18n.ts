import i18n from "i18next";
import { useTranslation, initReactI18next } from "react-i18next";
import uzJSON from "./translate/uz.json";
import ruJSON from "./translate/ru.json";

i18n.use(initReactI18next).init({
  resources: {
    uz: {
      translation: uzJSON,
    },
    ru: {
      translation: ruJSON,
    },
  },
  lng: "uz",
  fallbackLng: "uz",
  interpolation: {
    escapeValue: true,
  },
});
