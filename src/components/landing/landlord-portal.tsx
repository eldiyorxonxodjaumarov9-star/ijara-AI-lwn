"use client";

import { useEffect, useState } from "react";
import {
  ArrowLeft,
  KeyRound,
  LogIn,
  User,
} from "lucide-react";
import { toast } from "sonner";

import { ArendaCrmApp } from "@/components/arenda-crm/arenda-crm-app";
import { LandingFooter } from "@/components/landing/landing-footer";
import { LandingNavbar } from "@/components/landing/landing-navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  clearLandlordProfile,
  getLandlordProfile,
  loginLandlord,
  normalizeLandlordForm,
  PROPERTY_TYPES,
  saveLandlordProfile,
  type LandlordProfile,
  type LandlordProfileForm,
} from "@/lib/landlord-profile";

const EMPTY_FORM: LandlordProfileForm = {
  login: "",
  password: "",
  fullName: "",
  phone: "",
  email: "",
  company: "",
  city: "Toshkent",
  propertyType: PROPERTY_TYPES[0],
  propertyCount: "1",
  about: "",
};

export function LandlordPortal() {
  const [profile, setProfile] = useState<LandlordProfile | null>(null);
  const [form, setForm] = useState<LandlordProfileForm>(EMPTY_FORM);
  const [loginForm, setLoginForm] = useState({ login: "", password: "" });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const saved = getLandlordProfile();
    setProfile(saved);
    if (saved) {
      setForm(normalizeLandlordForm({ ...saved, password: "" }));
    }
    setLoading(false);
  }, []);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const result = saveLandlordProfile(form);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    if (result.needsApproval) {
      toast.success(
        "Profil yaratildi! Dashboard admin tasdig'ini kuting — keyin kirishingiz mumkin."
      );
      setForm(EMPTY_FORM);
      return;
    }
    setProfile(result.profile);
    setForm(normalizeLandlordForm({ ...result.profile, password: "" }));
    toast.success("Arenda CRM profilingiz tayyor!");
  };

  const onLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginForm.login.trim() || !loginForm.password.trim()) {
      toast.error("Login va parol kiriting");
      return;
    }
    const result = loginLandlord(loginForm.login, loginForm.password);
    if (!result.ok) {
      if (result.reason === "no_access") {
        toast.error(
          "Kirish huquqi berilmagan. Dashboard adminidan ruxsat so'rang."
        );
      } else {
        toast.error("Login yoki parol noto'g'ri");
      }
      return;
    }
    setProfile(result.profile);
    setForm(normalizeLandlordForm({ ...result.profile, password: "" }));
    setLoginForm({ login: "", password: "" });
    toast.success(`Xush kelibsiz, ${result.profile.fullName}!`);
  };

  const onLogout = () => {
    clearLandlordProfile();
    setProfile(null);
    setForm(EMPTY_FORM);
    toast.success("Arenda CRM dan chiqildi");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#060d18] pt-24">
        <div className="mx-auto h-64 max-w-4xl animate-pulse rounded-2xl border border-white/10 bg-white/5 px-4" />
      </div>
    );
  }

  if (profile) {
    return (
      <ArendaCrmApp
        profile={profile}
        onLogout={onLogout}
        onProfileUpdate={setProfile}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#060d18] text-white selection:bg-cyan-500/30">
      <LandingNavbar activePath="/ijara-egalari" />
      <main className="pt-24 pb-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="mb-10 text-center">
            <span className="inline-flex items-center rounded-full border border-[#2563EB]/30 bg-[#2563EB]/10 px-4 py-1.5 text-sm text-[#38BDF8]">
              Arenda CRM · Enterprise SaaS
            </span>
            <h1 className="mt-4 text-3xl font-bold sm:text-4xl">
              Ijara egalari uchun{" "}
              <span className="bg-gradient-to-r from-[#2563EB] to-[#38BDF8] bg-clip-text text-transparent">
                Arenda CRM
              </span>
            </h1>
            <p className="mx-auto mt-3 max-w-2xl text-slate-400">
              AI-powered rental management: mulklar, mijozlar, bronlash, reklama,
              to&apos;lovlar va hisobotlar — barchasi bir platformada.
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <form
              onSubmit={onSubmit}
              className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl sm:p-8 lg:col-span-2"
            >
              <h2 className="text-xl font-semibold">Yangi profil yaratish</h2>
              <p className="mt-1 text-sm text-slate-400">
                Login va parol tanlang — keyin premium Arenda CRM ochiladi.
              </p>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="login">Login *</Label>
                  <Input
                    id="login"
                    value={form.login}
                    onChange={(e) => setForm((f) => ({ ...f, login: e.target.value }))}
                    placeholder="masalan: ali_valiyev"
                    autoComplete="username"
                    className="border-white/10 bg-white/5 text-white placeholder:text-slate-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password">Parol *</Label>
                  <Input
                    id="password"
                    type="password"
                    value={form.password}
                    onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                    placeholder="Kamida 4 belgi"
                    autoComplete="new-password"
                    className="border-white/10 bg-white/5 text-white placeholder:text-slate-500"
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="fullName">To&apos;liq ism *</Label>
                  <Input
                    id="fullName"
                    value={form.fullName}
                    onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
                    placeholder="Ali Valiyev"
                    className="border-white/10 bg-white/5 text-white placeholder:text-slate-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="phone">Telefon *</Label>
                  <Input
                    id="phone"
                    value={form.phone}
                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                    placeholder="+998901234567"
                    className="border-white/10 bg-white/5 text-white placeholder:text-slate-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    placeholder="email@example.com"
                    className="border-white/10 bg-white/5 text-white placeholder:text-slate-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="company">Kompaniya</Label>
                  <Input
                    id="company"
                    value={form.company}
                    onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
                    placeholder="Kompaniya nomi"
                    className="border-white/10 bg-white/5 text-white placeholder:text-slate-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="city">Shahar / hudud</Label>
                  <Input
                    id="city"
                    value={form.city}
                    onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                    placeholder="Toshkent"
                    className="border-white/10 bg-white/5 text-white placeholder:text-slate-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Mulk turi</Label>
                  <Select
                    value={form.propertyType}
                    onValueChange={(v) => setForm((f) => ({ ...f, propertyType: v }))}
                  >
                    <SelectTrigger className="border-white/10 bg-white/5 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PROPERTY_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="propertyCount">Mulk soni</Label>
                  <Input
                    id="propertyCount"
                    type="number"
                    min={1}
                    value={form.propertyCount}
                    onChange={(e) => setForm((f) => ({ ...f, propertyCount: e.target.value }))}
                    className="border-white/10 bg-white/5 text-white"
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="about">Qisqa tavsif</Label>
                  <Textarea
                    id="about"
                    value={form.about}
                    onChange={(e) => setForm((f) => ({ ...f, about: e.target.value }))}
                    placeholder="Mulklaringiz haqida qisqacha..."
                    className="min-h-24 border-white/10 bg-white/5 text-white placeholder:text-slate-500"
                  />
                </div>
              </div>

              <div className="mt-6">
                <Button
                  type="submit"
                  className="bg-gradient-to-r from-[#2563EB] to-[#38BDF8] text-white hover:opacity-90"
                >
                  Arenda CRM ni ochish
                </Button>
              </div>
            </form>

            <aside className="rounded-2xl border border-[#38BDF8]/20 bg-gradient-to-b from-[#0F172A] to-[#060d18] p-6 sm:p-8">
              <div className="flex items-center gap-2">
                <LogIn className="size-5 text-[#38BDF8]" />
                <h2 className="text-lg font-semibold text-white">Kirish</h2>
              </div>
              <p className="mt-2 text-sm text-slate-400">
                Akkauntingiz bormi? Login va parol bilan Arenda CRM ga kiring.
              </p>
              <form onSubmit={onLogin} className="mt-6 space-y-4">
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5 text-slate-300">
                    <User className="size-3.5 text-[#38BDF8]" />
                    Login
                  </Label>
                  <Input
                    value={loginForm.login}
                    onChange={(e) => setLoginForm((f) => ({ ...f, login: e.target.value }))}
                    className="border-white/10 bg-white/5 text-white"
                    placeholder="Login"
                    autoComplete="username"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5 text-slate-300">
                    <KeyRound className="size-3.5 text-[#38BDF8]" />
                    Parol
                  </Label>
                  <Input
                    type="password"
                    value={loginForm.password}
                    onChange={(e) => setLoginForm((f) => ({ ...f, password: e.target.value }))}
                    className="border-white/10 bg-white/5 text-white"
                    placeholder="Parol"
                    autoComplete="current-password"
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full gap-2 bg-gradient-to-r from-[#38BDF8] to-[#2563EB] hover:opacity-90"
                >
                  <LogIn className="size-4" />
                  Kirish
                </Button>
              </form>

              <div className="mt-8 space-y-2 text-xs text-slate-500">
                <p className="flex items-center gap-1.5">
                  <ArrowLeft className="size-3" />
                  Dashboard, AI, bronlash, reklama
                </p>
                <p>HubSpot + Airbnb + Salesforce uslubida</p>
              </div>
            </aside>
          </div>
        </div>
      </main>
      <LandingFooter />
    </div>
  );
}
