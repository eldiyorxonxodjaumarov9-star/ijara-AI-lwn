"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { useAuth } from "@/context/auth-context";
import {
  translations,
  type TranslationKey,
} from "@/lib/i18n/translations";
import type { Language } from "@/types";

const LANG_KEY = "arendahub:language";

interface LanguageContextValue {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: TranslationKey) => string;
}

const LanguageContext = createContext<LanguageContextValue | undefined>(
  undefined
);

function readStoredLanguage(): Language {
  if (typeof window === "undefined") return "uz";
  const saved = window.localStorage.getItem(LANG_KEY) as Language | null;
  return saved && translations[saved] ? saved : "uz";
}

export function translateAt(lang: Language, key: TranslationKey): string {
  return translations[lang][key] ?? translations.uz[key] ?? key;
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [language, setLanguageState] = useState<Language>(readStoredLanguage);

  // Profil tilini sinxronlash (faqat user.language o'zgarganda)
  useEffect(() => {
    if (user?.language) {
      setLanguageState(user.language);
    }
  }, [user?.language]);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = language;
    }
    if (typeof window !== "undefined") {
      window.localStorage.setItem(LANG_KEY, language);
    }
  }, [language]);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(LANG_KEY, lang);
    }
  }, []);

  const t = useCallback(
    (key: TranslationKey) =>
      translations[language][key] ?? translations.uz[key] ?? key,
    [language]
  );

  const value = useMemo(
    () => ({ language, setLanguage, t }),
    [language, setLanguage, t]
  );

  return (
    <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error("useLanguage LanguageProvider ichida ishlatilishi kerak");
  }
  return ctx;
}
