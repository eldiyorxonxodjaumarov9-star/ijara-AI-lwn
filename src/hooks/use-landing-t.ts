"use client";

import { useLanguage } from "@/context/language-context";
import {
  getLandingMessage,
  type LandingMessageKey,
} from "@/lib/i18n/landing";

export function useLandingT() {
  const { language } = useLanguage();
  return (key: LandingMessageKey) => getLandingMessage(language, key);
}
