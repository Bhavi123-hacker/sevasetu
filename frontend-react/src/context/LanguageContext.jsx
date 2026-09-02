import React, { createContext, useContext, useState, useEffect } from "react";
import { translations } from "../i18n/translations";

const LanguageContext = createContext();

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(() => {
    return localStorage.getItem("sevasetu_lang") || "en";
  });

  useEffect(() => {
    localStorage.setItem("sevasetu_lang", lang);
  }, [lang]);

  const t = (key, defaultText = "") => {
    const currentDict = translations[lang] || translations.en;
    return currentDict[key] || translations.en[key] || defaultText || key;
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return ctx;
}
