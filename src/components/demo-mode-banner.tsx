"use client";

import { Info } from "lucide-react";

import { useAuth } from "@/context/auth-context";
import { useLanguage } from "@/context/language-context";

export function DemoModeBanner() {
  const { demoMode } = useAuth();
  const { t } = useLanguage();
  if (!demoMode) return null;

  return (
    <div className="flex items-center gap-2 border-b bg-amber-500/10 px-4 py-2 text-xs text-amber-700 dark:text-amber-400 lg:px-6">
      <Info className="size-3.5 shrink-0" />
      <span>{t("demo.banner")}</span>
    </div>
  );
}
