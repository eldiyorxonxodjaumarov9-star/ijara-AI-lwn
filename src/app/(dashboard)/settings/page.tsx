"use client";

import { useSearchParams, usePathname, useRouter } from "next/navigation";
import { Suspense, useEffect, useState, useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { Building2, Cloud, Globe, KeyRound, Loader2, Moon, Radio, User } from "lucide-react";
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
import type { AppUser, Language } from "@/types";
import { PostingChannelsPanel } from "@/components/listings/posting-channels-panel";
import { InstagramSettingsPanel } from "@/components/listings/instagram-settings-panel";
import { TelegramDistributionPanel } from "@/components/listings/telegram-distribution-panel";
import { TtlockSettingsPanel } from "@/components/settings/ttlock-settings-panel";

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-muted-foreground">Yuklanmoqda...</div>}>
      <SettingsPageContent />
    </Suspense>
  );
}

function useClientMounted() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
}

function profileFromUser(user: AppUser | null) {
  return {
    displayName: user?.displayName ?? "",
    phone: user?.phone ?? "",
    email: user?.email ?? "",
    company: user?.company ?? "",
    language: (user?.language ?? "uz") as Language,
  };
}

function SettingsPageContent() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const urlTab = searchParams.get("tab") ?? "profile";
  const { user, updateUser, demoMode } = useAuth();
  const { t, setLanguage: setAppLanguage } = useLanguage();
  const { theme, setTheme } = useTheme();
  const mounted = useClientMounted();

  const [profile, setProfile] = useState(() => profileFromUser(user));
  const [profileUserId, setProfileUserId] = useState(user?.id ?? "");
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [cloudAvailable, setCloudAvailable] = useState<boolean | null>(null);

  const [activeTab, setActiveTab] = useState(urlTab);
  const [prevUrlTab, setPrevUrlTab] = useState(urlTab);

  if (urlTab !== prevUrlTab) {
    setPrevUrlTab(urlTab);
    setActiveTab(urlTab);
  }

  const nextUserId = user?.id ?? "";
  if (nextUserId !== profileUserId) {
    setProfileUserId(nextUserId);
    setProfile(profileFromUser(user));
  }

  useEffect(() => {
    if (!demoMode) return;
    void checkCloudSyncAvailable().then(setCloudAvailable);
  }, [demoMode]);

  const onTabChange = (value: string) => {
    setActiveTab(value);
    router.replace(`${pathname}?tab=${encodeURIComponent(value)}`, {
      scroll: false,
    });
  };

  const saveProfile = async () => {
    const trimmedEmail = profile.email.trim();
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      toast.error(t("settings.emailInvalid"));
      return;
    }
    try {
      setSaving(true);
      await updateUser({
        displayName: profile.displayName,
        phone: profile.phone,
        email: trimmedEmail,
      });
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
    await updateUser({ company: profile.company });
    toast.success(t("settings.savedCompany"));
  };

  const saveLanguage = async (lang: Language) => {
    setProfile((p) => ({ ...p, language: lang }));
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

      <Tabs value={activeTab} onValueChange={onTabChange}>
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 overflow-x-auto sm:flex-nowrap">
          <TabsTrigger value="profile">
            <User className="mr-1.5 size-4" /> {t("settings.profile")}
          </TabsTrigger>
          <TabsTrigger value="company">
            <Building2 className="mr-1.5 size-4" /> {t("settings.company")}
          </TabsTrigger>
          <TabsTrigger value="appearance">
            <Moon className="mr-1.5 size-4" /> {t("settings.appearance")}
          </TabsTrigger>
          <TabsTrigger value="posting">
            <Radio className="mr-1.5 size-4" /> Posting sozlamalari
          </TabsTrigger>
          <TabsTrigger value="integrations">
            <KeyRound className="mr-1.5 size-4" /> Integratsiyalar
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

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>{t("settings.fullName")}</Label>
                  <Input
                    value={profile.displayName}
                    onChange={(e) =>
                      setProfile((p) => ({ ...p, displayName: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>{t("settings.phone")}</Label>
                  <Input
                    value={profile.phone}
                    onChange={(e) =>
                      setProfile((p) => ({ ...p, phone: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>{t("settings.email")}</Label>
                  <Input
                    type="email"
                    value={profile.email}
                    onChange={(e) =>
                      setProfile((p) => ({ ...p, email: e.target.value }))
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    {t("settings.emailHint")}
                  </p>
                </div>
              </div>

              {demoMode && (
                <div className="rounded-lg border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <Cloud className="size-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">{t("settings.syncTitle")}</p>
                        <p className="text-sm text-muted-foreground">
                          {cloudAvailable === false
                            ? t("settings.syncOfflineHint")
                            : t("settings.syncDesc")}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      disabled={syncing || cloudAvailable === false}
                      onClick={() => void runCloudSync()}
                    >
                      {syncing ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : null}
                      {t("settings.syncNow")}
                    </Button>
                  </div>
                </div>
              )}

              <Button onClick={() => void saveProfile()} disabled={saving}>
                {saving ? <Loader2 className="size-4 animate-spin" /> : null}
                {t("common.save")}
              </Button>
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
                  value={profile.company}
                  onChange={(e) =>
                    setProfile((p) => ({ ...p, company: e.target.value }))
                  }
                />
              </div>
              <Button onClick={() => void saveCompany()}>{t("common.save")}</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="posting" className="space-y-6">
          <TelegramDistributionPanel />
          <InstagramSettingsPanel />
          <Card>
            <CardHeader>
              <CardTitle>Boshqa tarqatish kanallari</CardTitle>
              <CardDescription>Telegram, OLX, Joymee va boshqalar</CardDescription>
            </CardHeader>
            <CardContent>
              <PostingChannelsPanel hideInstagram />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="integrations" className="space-y-6">
          <TtlockSettingsPanel />
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
                  value={profile.language}
                  onValueChange={(v) => void saveLanguage(v as Language)}
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
