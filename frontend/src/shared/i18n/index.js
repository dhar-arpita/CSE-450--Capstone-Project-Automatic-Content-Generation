import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { DEFAULT_LANGUAGE, LANGUAGES, STRINGS } from "./strings";

const STORAGE_KEY = "dhi.lang";
const I18nContext = createContext(null);

function readStoredLanguage() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && STRINGS[stored]) return stored;
  } catch {
    // Private mode or blocked storage — the default is a fine answer.
  }
  return DEFAULT_LANGUAGE;
}

/* Dot-path lookup so call sites read like i18next: t("hero.titleLead").
   Returns whatever sits at the path, including arrays, so list sections can
   map over them. Falls back to English, then to the key itself, which makes a
   missing translation obvious in the UI instead of rendering blank. */
function resolve(dict, path) {
  return path.split(".").reduce((node, key) => (node == null ? undefined : node[key]), dict);
}

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState(readStoredLanguage);

  useEffect(() => {
    document.documentElement.lang = LANGUAGES[lang].htmlLang;
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // Not being able to remember the choice must not break the page.
    }
  }, [lang]);

  const setLang = useCallback((next) => {
    if (STRINGS[next]) setLangState(next);
  }, []);

  const toggleLang = useCallback(() => {
    setLangState((current) => (current === "bn" ? "en" : "bn"));
  }, []);

  const t = useCallback(
    (path) => {
      const hit = resolve(STRINGS[lang], path);
      if (hit !== undefined) return hit;
      const fallback = resolve(STRINGS.en, path);
      return fallback !== undefined ? fallback : path;
    },
    [lang]
  );

  const value = useMemo(
    () => ({ lang, setLang, toggleLang, t, languages: LANGUAGES }),
    [lang, setLang, toggleLang, t]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside <I18nProvider>");
  return ctx;
}
