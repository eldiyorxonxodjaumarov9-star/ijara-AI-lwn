import en from "@/messages/landing/en.json";
import ru from "@/messages/landing/ru.json";
import uz from "@/messages/landing/uz.json";

export type LandingMessageKey = keyof typeof uz;

export const LANDING_LOCALES = ["uz", "ru", "en"] as const;

export type LandingLocale = (typeof LANDING_LOCALES)[number];

const catalogs: Record<LandingLocale, Record<LandingMessageKey, string>> = {
  uz,
  ru,
  en,
};

export function getLandingMessage(
  lang: string,
  key: LandingMessageKey
): string {
  const locale =
    lang === "uz" || lang === "ru" || lang === "en" ? lang : "uz";
  return catalogs[locale][key] ?? catalogs.uz[key] ?? key;
}

export function formatLandingMessage(
  template: string,
  vars: Record<string, string | number>
): string {
  return template.replace(/\{(\w+)\}/g, (_, name: string) =>
    vars[name] !== undefined ? String(vars[name]) : `{${name}}`
  );
}

export const LANDING_LANG_OPTIONS = [
  { code: "uz" as const, labelKey: "lang.uz" as const, short: "UZ" },
  { code: "ru" as const, labelKey: "lang.ru" as const, short: "RU" },
  { code: "en" as const, labelKey: "lang.en" as const, short: "EN" },
];
