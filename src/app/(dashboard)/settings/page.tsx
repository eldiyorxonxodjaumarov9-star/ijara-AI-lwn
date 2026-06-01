"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Building2, Globe, Loader2, Moon, User } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Avatar,
  AvatarFallback,
} from "@/components/ui/avatar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/context/auth-context";
import { getInitials } from "@/lib/utils";
import { ROLE_MAP } from "@/lib/constants";
import type { Language } from "@/types";

export default function SettingsPage() {
  const { user, updateUser } = useAuth();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");
  const [language, setLanguage] = useState<Language>("uz");
  const [saving, setSaving] = useState(false);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName ?? "");
      setPhone(user.phone ?? "");
      setCompany(user.company ?? "");
      setLanguage(user.language ?? "uz");
    }
  }, [user]);

  const saveProfile = async () => {
    try {
      setSaving(true);
      await updateUser({ displayName, phone });
      toast.success("Profil saqlandi");
    } finally {
      setSaving(false);
    }
  };

  const saveCompany = async () => {
    await updateUser({ company });
    toast.success("Kompaniya ma'lumotlari saqlandi");
  };

  const saveLanguage = async (lang: Language) => {
    setLanguage(lang);
    await updateUser({ language: lang });
    toast.success("Til o'zgartirildi");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sozlamalar"
        description="Profil, kompaniya va ilova sozlamalari."
      />

      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile">
            <User className="mr-1.5 size-4" /> Profil
          </TabsTrigger>
          <TabsTrigger value="company">
            <Building2 className="mr-1.5 size-4" /> Kompaniya
          </TabsTrigger>
          <TabsTrigger value="appearance">
            <Moon className="mr-1.5 size-4" /> Ko&apos;rinish
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle>Profil ma&apos;lumotlari</CardTitle>
              <CardDescription>Shaxsiy ma&apos;lumotlaringiz.</CardDescription>
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
                  <Label>To&apos;liq ism</Label>
                  <Input
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Telefon</Label>
                  <Input
                    value={phone}
                    placeholder="+998..."
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Email</Label>
                  <Input value={user?.email ?? ""} disabled />
                </div>
              </div>

              <Button onClick={saveProfile} disabled={saving}>
                {saving && <Loader2 className="size-4 animate-spin" />}
                Saqlash
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="company">
          <Card>
            <CardHeader>
              <CardTitle>Kompaniya ma&apos;lumotlari</CardTitle>
              <CardDescription>Biznesingiz haqida.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-1.5">
                <Label>Kompaniya nomi</Label>
                <Input
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                />
              </div>
              <Button onClick={saveCompany}>Saqlash</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="appearance">
          <Card>
            <CardHeader>
              <CardTitle>Ko&apos;rinish va til</CardTitle>
              <CardDescription>Interfeys sozlamalari.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="flex items-center gap-3">
                  <Moon className="size-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Tungi rejim</p>
                    <p className="text-sm text-muted-foreground">
                      Qorong&apos;i mavzuni yoqish
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
                    <p className="font-medium">Til</p>
                    <p className="text-sm text-muted-foreground">
                      Interfeys tili
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
                    <SelectItem value="uz">O&apos;zbekcha</SelectItem>
                    <SelectItem value="ru">Русский</SelectItem>
                    <SelectItem value="en">English</SelectItem>
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
