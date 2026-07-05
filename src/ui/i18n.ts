import { ar } from "./locales/ar";
import { fr } from "./locales/fr";
import { en, setActiveStrings, type Strings } from "./strings";

export type Locale = "en" | "fr" | "ar";

export const LOCALES: readonly Locale[] = ["en", "fr", "ar"];

export const localeLabels: Record<Locale, string> = {
  en: "English",
  fr: "Français",
  ar: "العربية",
};

const bundles: Record<Locale, Strings> = { en, fr, ar };

const RTL_LOCALES: ReadonlySet<Locale> = new Set<Locale>(["ar"]);

let current: Locale = "en";

export function isLocale(value: unknown): value is Locale {
  return (
    typeof value === "string" && (LOCALES as readonly string[]).includes(value)
  );
}

export function getLocale(): Locale {
  return current;
}

export function isRtl(locale: Locale = current): boolean {
  return RTL_LOCALES.has(locale);
}

export function setLocale(locale: Locale): void {
  current = locale;
  setActiveStrings(bundles[locale]);
  const root = (
    globalThis as {
      document?: {
        documentElement?: { setAttribute(name: string, value: string): void };
      };
    }
  ).document?.documentElement;
  if (root) {
    root.setAttribute("lang", locale);
    root.setAttribute("dir", isRtl(locale) ? "rtl" : "ltr");
  }
}

export function detectLocale(): Locale {
  const nav = (
    globalThis as {
      navigator?: { languages?: readonly string[]; language?: string };
    }
  ).navigator;
  const candidates =
    nav?.languages && nav.languages.length > 0
      ? nav.languages
      : nav?.language
        ? [nav.language]
        : [];
  for (const candidate of candidates) {
    const base = candidate.toLowerCase().split("-")[0];
    if (base && isLocale(base)) {
      return base;
    }
  }
  return "en";
}
