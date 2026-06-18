"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Building2, Cloud, Globe, Loader2, Moon, User } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/context/auth-context";
import { translateAt, useLanguage } from "@/context/language-context";
import {
  checkCloudSyncAvailable,
  forceCloudSync,
} from "@/lib/cloud/sync-client";
import { getInitials } from "@/lib/utils";
import { ROLE_MAP } from "@/lib/constants";
import type { Language } from "@/types";

export default function SettingsPage() {
  const { user, updateUser, demoMode } = useAuth();
  const { t, setLanguage: setAppLanguage } = useLanguage();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [language, setLanguage] = useState<Language>("uz");
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [cloudAvailable, setCloudAvailable] = useState<boolean | null>(null);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!demoMode) return;
    void checkCloudSyncAvailable().then(setCloudAvailable);
  }, [demoMode]);
  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName ?? "");
      setPhone(user.phone ?? "");
      setEmail(user.email ?? "");
      setCompany(user.company ?? "");
      setLanguage(user.language ?? "uz");
    }
  }, [user]);

  const saveProfile = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      toast.error(t("settings.emailInvalid"));
      return;
    }
    try {
      setSaving(true);
      await updateUser({ displayName, phone, email: trimmedEmail });
      toast.success(t("settings.savedProfile"));
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : t("settings.saveFailed")
      );
    } finally {
      setSaving(false);
    }
  };

  const saveCompany = async () => {
    await updateUser({ company });
    toast.success(t("settings.savedCompany"));
  };

  const saveLanguage = async (lang: Language) => {
    setLanguage(lang);
    setAppLanguage(lang);
    await updateUser({ language: lang });
    toast.success(translateAt(lang, "settings.savedLanguage"));
  };

  const runCloudSync = async () => {
    if (!user?.email) return;
    setSyncing(true);
    try {
      const result = await forceCloudSync(user.email);
      if (result.ok) {
        toast.success(
          result.direction === "pull"
            ? t("settings.syncPulled")
            : t("settings.syncPushed")
        );
        if (result.direction === "pull") {
          window.location.reload();
        }
      } else {
        toast.error(t("settings.syncFailed"));
      }
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title={t("settings.title")} description={t("settings.desc")} />

      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile">
            <User className="mr-1.5 size-4" /> {t("settings.profile")}
          </TabsTrigger>
          <TabsTrigger value="company">
            <Building2 className="mr-1.5 size-4" /> {t("settings.company")}
          </TabsTrigger>
          <TabsTrigger value="appearance">
            <Moon className="mr-1.5 size-4" /> {t("settings.appearance")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle>{t("settings.profileTitle")}</CardTitle>
              <CardDescription>{t("settings.profileDesc")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex items-center gap-4">
                <Avatar className="size-16">
                  <AvatarFallback className="text-lg">
                    {getInitials(user?.displayName)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold">{user?.displayName}</p>
                  <p className="text-sm text-muted-foreground">{user?.email}</p>
                  <span className="mt-1 inline-block rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                    {user?.role ? ROLE_MAP[user.role] : ""}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>{t("settings.fullName")}</Label>
                  <Input
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>{t("settings.phone")}</Label>
                  <Input
                    value={phone}
                    placeholder="+998..."
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>{t("settings.email")}</Label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    {t("settings.emailHint")}
                  </p>
                </div>
              </div>

              <Button onClick={saveProfile} disabled={saving}>
                {saving && <Loader2 className="size-4 animate-spin" />}
                {t("common.save")}
              </Button>

              {demoMode && (
                <div className="rounded-lg border border-dashed p-4">
                  <div className="flex items-start gap-3">
                    <Cloud className="mt-0.5 size-5 text-muted-foreground" />
                    <div className="flex-1 space-y-2">
                      <p className="font-medium">{t("settings.syncTitle")}</p>
                      <p className="text-sm text-muted-foreground">
                        {cloudAvailable === false
                          ? t("settings.syncOfflineHint")
                          : t("settings.syncDesc")}
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={runCloudSync}
                        disabled={syncing || cloudAvailable === false}
                      >
                        {syncing && (
                          <Loader2 className="size-4 animate-spin" />
                        )}
                        {t("settings.syncNow")}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="company">
          <Card>
            <CardHeader>
              <CardTitle>{t("settings.companyTitle")}</CardTitle>
              <CardDescription>{t("settings.companyDesc")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-1.5">
                <Label>{t("settings.companyName")}</Label>
                <Input
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                />
              </div>
              <Button onClick={saveCompany}>{t("common.save")}</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="appearance">
          <Card>
            <CardHeader>
              <CardTitle>{t("settings.appearanceTitle")}</CardTitle>
              <CardDescription>{t("settings.appearanceDesc")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="flex items-center gap-3">
                  <Moon className="size-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">{t("settings.darkMode")}</p>
                    <p className="text-sm text-muted-foreground">
                      {t("settings.darkModeDesc")}
                    </p>
                  </div>
                </div>
                {mounted && (
                  <Switch
                    checked={theme === "dark"}
                    onCheckedChange={(c) => setTheme(c ? "dark" : "light")}
                  />
                )}
              </div>

              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="flex items-center gap-3">
                  <Globe className="size-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">{t("settings.language")}</p>
                    <p className="text-sm text-muted-foreground">
                      {t("settings.languageDesc")}
                    </p>
                  </div>
                </div>
                <Select
                  value={language}
                  onValueChange={(v) => saveLanguage(v as Language)}
                >
                  <SelectTrigger className="w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="uz">{t("settings.langUz")}</SelectItem>
                    <SelectItem value="ru">{t("settings.langRu")}</SelectItem>
                    <SelectItem value="kk">{t("settings.langKk")}</SelectItem>
                    <SelectItem value="en">{t("settings.langEn")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
