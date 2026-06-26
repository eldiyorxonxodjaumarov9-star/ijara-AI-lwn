"use client";

import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Building2,
  Edit3,
  KeyRound,
  LogIn,
  LogOut,
  Mail,
  MapPin,
  Phone,
  User,
} from "lucide-react";
import { toast } from "sonner";

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
import { getCrmReports } from "@/lib/landlord-crm";
import { LandlordCrmPanel } from "@/components/landing/landlord/landlord-crm-panel";

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
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<LandlordProfileForm>(EMPTY_FORM);
  const [loginForm, setLoginForm] = useState({ login: "", password: "" });
  const [loading, setLoading] = useState(true);
  const [crmStats, setCrmStats] = useState(getCrmReports());

  const loadProfile = () => {
    const saved = getLandlordProfile();
    setProfile(saved);
    setCrmStats(getCrmReports());
    if (saved) {
      setForm(normalizeLandlordForm({ ...saved, password: "" }));
    }
  };

  useEffect(() => {
    loadProfile();
    setLoading(false);
  }, []);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const result = saveLandlordProfile(form);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setProfile(result.profile);
    setForm(normalizeLandlordForm({ ...result.profile, password: "" }));
    setCrmStats(getCrmReports());
    setEditing(false);
    toast.success(profile ? "Profil yangilandi" : "Profil yaratildi!");
  };

  const onLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginForm.login.trim() || !loginForm.password.trim()) {
      toast.error("Login va parol kiriting");
      return;
    }
    const logged = loginLandlord(loginForm.login, loginForm.password);
    if (!logged) {
      toast.error("Login yoki parol noto'g'ri");
      return;
    }
    setProfile(logged);
    setForm(normalizeLandlordForm({ ...logged, password: "" }));
    setCrmStats(getCrmReports());
    setEditing(false);
    setLoginForm({ login: "", password: "" });
    toast.success(`Xush kelibsiz, ${logged.fullName}!`);
  };

  const onLogout = () => {
    clearLandlordProfile();
    setProfile(null);
    setForm(EMPTY_FORM);
    setEditing(false);
    toast.success("Profildan chiqildi");
  };

  const showForm = !profile || editing;
  const isNewProfile = !profile;

  return (
    <div className="min-h-screen bg-[#060d18] text-white selection:bg-cyan-500/30">
      <LandingNavbar activePath="/ijara-egalari" />
      <main className="pt-24 pb-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="mb-10 text-center">
            <span className="inline-flex items-center rounded-full border border-cyan-500/30 bg-cyan-500/10 px-4 py-1.5 text-sm text-cyan-300">
              Ijara egalari uchun MVP
            </span>
            <h1 className="mt-4 text-3xl font-bold sm:text-4xl">
              Shaxsiy{" "}
              <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                ijara egasi profili
              </span>
            </h1>
            <p className="mx-auto mt-3 max-w-2xl text-slate-400">
              Login va parol bilan shaxsiy profilingizga kiring. CRM: mijozlar,
              xabarlar, e&apos;lonlar va hisobotlar.
            </p>
          </div>

          {loading ? (
            <div className="h-64 animate-pulse rounded-2xl border border-white/10 bg-white/5" />
          ) : showForm ? (
            <div className="grid gap-6 lg:grid-cols-3">
              <form
                onSubmit={onSubmit}
                className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl sm:p-8 lg:col-span-2"
              >
                {profile && editing && (
                  <div className="mb-6 flex flex-wrap gap-2 border-b border-white/10 pb-4">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-2 border-white/20 bg-white/5 text-white hover:bg-white/10"
                      onClick={() => {
                        setForm(normalizeLandlordForm({ ...profile, password: "" }));
                        setEditing(false);
                      }}
                    >
                      <ArrowLeft className="size-4" />
                      Profilga qaytish
                    </Button>
                  </div>
                )}

                <h2 className="text-xl font-semibold">
                  {profile ? "Profilni tahrirlash" : "Yangi profil yaratish"}
                </h2>
                <p className="mt-1 text-sm text-slate-400">
                  {isNewProfile
                    ? "Login va parol o'zingiz tanlaysiz — keyin «Kirish» orqali profilingizga kirasiz."
                    : "MVP rejimida ma'lumotlar brauzeringizda saqlanadi."}
                </p>

                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="login">Login *</Label>
                    <Input
                      id="login"
                      value={form.login}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, login: e.target.value }))
                      }
                      disabled={!!profile}
                      placeholder="masalan: ali_valiyev"
                      autoComplete="username"
                      className="border-white/10 bg-white/5 text-white placeholder:text-slate-500 disabled:opacity-60"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="password">
                      {profile ? "Yangi parol (ixtiyoriy)" : "Parol *"}
                    </Label>
                    <Input
                      id="password"
                      type="password"
                      value={form.password}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, password: e.target.value }))
                      }
                      placeholder={
                        profile
                          ? "O'zgartirmasangiz bo'sh qoldiring"
                          : "Kamida 4 belgi"
                      }
                      autoComplete="new-password"
                      className="border-white/10 bg-white/5 text-white placeholder:text-slate-500"
                    />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="fullName">To&apos;liq ism *</Label>
                    <Input
                      id="fullName"
                      value={form.fullName}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, fullName: e.target.value }))
                      }
                      placeholder="Ali Valiyev"
                      className="border-white/10 bg-white/5 text-white placeholder:text-slate-500"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="phone">Telefon *</Label>
                    <Input
                      id="phone"
                      value={form.phone}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, phone: e.target.value }))
                      }
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
                      onChange={(e) =>
                        setForm((f) => ({ ...f, email: e.target.value }))
                      }
                      placeholder="email@example.com"
                      className="border-white/10 bg-white/5 text-white placeholder:text-slate-500"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="company">Kompaniya</Label>
                    <Input
                      id="company"
                      value={form.company}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, company: e.target.value }))
                      }
                      placeholder="Kompaniya nomi"
                      className="border-white/10 bg-white/5 text-white placeholder:text-slate-500"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="city">Shahar / hudud</Label>
                    <Input
                      id="city"
                      value={form.city}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, city: e.target.value }))
                      }
                      placeholder="Toshkent"
                      className="border-white/10 bg-white/5 text-white placeholder:text-slate-500"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Mulk turi</Label>
                    <Select
                      value={form.propertyType}
                      onValueChange={(v) =>
                        setForm((f) => ({ ...f, propertyType: v }))
                      }
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
                      onChange={(e) =>
                        setForm((f) => ({ ...f, propertyCount: e.target.value }))
                      }
                      className="border-white/10 bg-white/5 text-white"
                    />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="about">Qisqa tavsif</Label>
                    <Textarea
                      id="about"
                      value={form.about}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, about: e.target.value }))
                      }
                      placeholder="Mulklaringiz haqida qisqacha..."
                      className="min-h-24 border-white/10 bg-white/5 text-white placeholder:text-slate-500"
                    />
                  </div>
                </div>

                <div className="mt-6 flex flex-wrap gap-3">
                  <Button
                    type="submit"
                    className="bg-gradient-to-r from-blue-600 to-cyan-500 text-white hover:from-blue-500 hover:to-cyan-400"
                  >
                    {profile ? "Saqlash" : "Profil yaratish"}
                  </Button>
                  {profile && editing && (
                    <Button
                      type="button"
                      variant="outline"
                      className="border-white/20 bg-transparent text-white hover:bg-white/10"
                      onClick={() => {
                        setForm(normalizeLandlordForm({ ...profile, password: "" }));
                        setEditing(false);
                      }}
                    >
                      Bekor qilish
                    </Button>
                  )}
                </div>
              </form>

              {isNewProfile && (
                <aside className="rounded-2xl border border-cyan-500/20 bg-gradient-to-b from-cyan-950/40 to-[#0a1628] p-6 sm:p-8">
                  <div className="flex items-center gap-2">
                    <LogIn className="size-5 text-cyan-400" />
                    <h2 className="text-lg font-semibold text-white">Kirish</h2>
                  </div>
                  <p className="mt-2 text-sm text-slate-400">
                    Akkauntingiz bormi? O&apos;z login va parolingiz bilan shaxsiy
                    profilingizga kiring.
                  </p>
                  <form onSubmit={onLogin} className="mt-6 space-y-4">
                    <div className="space-y-1.5">
                      <Label className="flex items-center gap-1.5">
                        <User className="size-3.5 text-cyan-400" />
                        Login
                      </Label>
                      <Input
                        value={loginForm.login}
                        onChange={(e) =>
                          setLoginForm((f) => ({ ...f, login: e.target.value }))
                        }
                        className="border-white/10 bg-white/5 text-white"
                        placeholder="Login"
                        autoComplete="username"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="flex items-center gap-1.5">
                        <KeyRound className="size-3.5 text-cyan-400" />
                        Parol
                      </Label>
                      <Input
                        type="password"
                        value={loginForm.password}
                        onChange={(e) =>
                          setLoginForm((f) => ({
                            ...f,
                            password: e.target.value,
                          }))
                        }
                        className="border-white/10 bg-white/5 text-white"
                        placeholder="Parol"
                        autoComplete="current-password"
                      />
                    </div>
                    <Button
                      type="submit"
                      className="w-full gap-2 bg-gradient-to-r from-cyan-600 to-blue-500 hover:from-cyan-500 hover:to-blue-400"
                    >
                      <LogIn className="size-4" />
                      Kirish
                    </Button>
                  </form>
                </aside>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              <div className="overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-blue-950/50 via-[#0a1628] to-slate-900/80">
                <div className="border-b border-white/10 bg-white/5 px-6 py-8 sm:px-8">
                  <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-4">
                      <div className="flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-400 text-2xl font-bold text-white shadow-lg shadow-blue-500/30">
                        {profile.fullName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h2 className="text-2xl font-bold">{profile.fullName}</h2>
                        {profile.company && (
                          <p className="text-slate-400">{profile.company}</p>
                        )}
                        <p className="mt-1 text-sm text-cyan-400">
                          Ijara egasi profili
                        </p>
                        {profile.login && (
                          <p className="text-xs text-slate-500">@{profile.login}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        className="border-white/20 bg-white/5 text-white hover:bg-white/10"
                        onClick={() => {
                          setForm(
                            normalizeLandlordForm({ ...profile, password: "" })
                          );
                          setEditing(true);
                        }}
                      >
                        <Edit3 className="size-4" />
                        Tahrirlash
                      </Button>
                      <Button
                        variant="outline"
                        className="border-white/20 bg-white/5 text-white hover:bg-white/10"
                        onClick={onLogout}
                      >
                        <LogOut className="size-4" />
                        Chiqish
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 p-6 sm:grid-cols-3 sm:p-8">
                  {[
                    { label: "Mulklar", value: profile.propertyCount },
                    { label: "Faol e'lonlar", value: crmStats.activeListings },
                    { label: "Mijozlar", value: crmStats.totalClients },
                  ].map((stat) => (
                    <div
                      key={stat.label}
                      className="rounded-xl border border-white/10 bg-white/5 p-4"
                    >
                      <p className="text-sm text-slate-400">{stat.label}</p>
                      <p className="mt-1 text-2xl font-bold">{stat.value}</p>
                    </div>
                  ))}
                </div>

                <div className="grid gap-4 border-t border-white/10 p-6 sm:grid-cols-2 sm:p-8">
                  <div className="flex items-start gap-3 text-sm text-slate-300">
                    <Phone className="mt-0.5 size-4 shrink-0 text-cyan-400" />
                    <div>
                      <p className="text-slate-500">Telefon</p>
                      <p className="font-medium text-white">{profile.phone}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 text-sm text-slate-300">
                    <Mail className="mt-0.5 size-4 shrink-0 text-cyan-400" />
                    <div>
                      <p className="text-slate-500">Email</p>
                      <p className="font-medium text-white">{profile.email}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 text-sm text-slate-300">
                    <MapPin className="mt-0.5 size-4 shrink-0 text-cyan-400" />
                    <div>
                      <p className="text-slate-500">Hudud</p>
                      <p className="font-medium text-white">{profile.city}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 text-sm text-slate-300">
                    <Building2 className="mt-0.5 size-4 shrink-0 text-cyan-400" />
                    <div>
                      <p className="text-slate-500">Mulk turi</p>
                      <p className="font-medium text-white">
                        {profile.propertyType}
                      </p>
                    </div>
                  </div>
                  {profile.about && (
                    <div className="flex items-start gap-3 text-sm text-slate-300 sm:col-span-2">
                      <User className="mt-0.5 size-4 shrink-0 text-cyan-400" />
                      <div>
                        <p className="text-slate-500">Haqida</p>
                        <p className="font-medium text-white">{profile.about}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 sm:p-8">
                <h3 className="mb-2 text-lg font-semibold">Ijara egasi CRM</h3>
                <p className="mb-6 text-sm text-slate-400">
                  Mijozlar, tekshirish, e&apos;lonlar va hisobotlar
                </p>
                <LandlordCrmPanel />
              </div>
            </div>
          )}
        </div>
      </main>
      <LandingFooter />
    </div>
  );
}
