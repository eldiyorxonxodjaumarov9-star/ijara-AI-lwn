"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Globe, LogOut } from "lucide-react";

import { useAuth } from "@/context/auth-context";
import { useLanguage } from "@/context/language-context";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/brand-logo";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Language } from "@/types";

export default function PortalLayout({ children }: { children: ReactNode }) {
  const { user, loading, logout, updateUser } = useAuth();
  const { t, language, setLanguage } = useLanguage();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (user.role !== "tenant") {
      router.replace("/dashboard");
    }
  }, [loading, user, router]);

  const changeLanguage = async (lang: Language) => {
    setLanguage(lang);
    await updateUser({ language: lang });
  };

  if (loading || !user || user.role !== "tenant") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <BrandLogo showText={false} className="animate-pulse" />
          <p className="text-sm text-muted-foreground">{t("portal.loading")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background/80 px-4 backdrop-blur lg:px-6">
        <BrandLogo />
        <div className="flex items-center gap-2">
          <Select value={language} onValueChange={(v) => changeLanguage(v as Language)}>
            <SelectTrigger className="h-9 w-[7.5rem] gap-1 border-none bg-transparent shadow-none">
              <Globe className="size-4 shrink-0 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="uz">{t("settings.langUz")}</SelectItem>
              <SelectItem value="ru">{t("settings.langRu")}</SelectItem>
              <SelectItem value="kk">{t("settings.langKk")}</SelectItem>
              <SelectItem value="en">{t("settings.langEn")}</SelectItem>
            </SelectContent>
          </Select>
          <ThemeToggle />
          <span className="hidden max-w-[10rem] truncate text-sm font-medium sm:inline">
            {user.displayName}
          </span>
          <Button
            variant="ghost"
            size="icon"
            aria-label={t("portal.logout")}
            onClick={async () => {
              await logout();
              router.replace("/login");
            }}
          >
            <LogOut className="size-4" />
          </Button>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 p-4 lg:p-6">{children}</main>
    </div>
  );
}
