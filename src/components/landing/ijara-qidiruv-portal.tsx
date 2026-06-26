"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Building2,
  Edit3,
  KeyRound,
  LogIn,
  LogOut,
  MapPin,
  MessageCircle,
  Phone,
  Search,
  User,
} from "lucide-react";
import { toast } from "sonner";

import { LandingFooter } from "@/components/landing/landing-footer";
import { LandingNavbar } from "@/components/landing/landing-navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PROPERTY_TYPES } from "@/lib/landlord-profile";
import { saveRentalInquiry, saveGlobalInquiryFromForm, getMessagesForRenter } from "@/lib/rental-inquiries";
import {
  clearRenterProfile,
  getRenterProfile,
  loginRenter,
  saveRenterProfile,
} from "@/lib/renter-profile";
import {
  ACTIVITY_TYPES,
  buildInquiryMessage,
  ensurePhoneInMessage,
  normalizeRenterForm,
  type RenterSearchForm,
} from "@/lib/renter-search-form";
import { formatSummaInput, parseSumma } from "@/lib/uzs-input";
import {
  formatUzs,
  searchRentalListingsFromForm,
  type RentalListing,
} from "@/lib/rental-search";

const EMPTY_FORM: RenterSearchForm = {
  login: "",
  password: "",
  companyName: "",
  phone: "",
  activityType: ACTIVITY_TYPES[0],
  activitySince: "",
  briefInfo: "",
  instagramLink: "",
  instagramQr: "",
  officeAddress: "",
  rentalPlaceType: PROPERTY_TYPES[0],
  kv: "",
  summa: "",
};

export function IjaraQidiruvPortal() {
  const [form, setForm] = useState<RenterSearchForm>(EMPTY_FORM);
  const [step, setStep] = useState<"form" | "profile">("form");
  const [results, setResults] = useState<RentalListing[]>([]);
  const [hint, setHint] = useState("");
  const [searchMode, setSearchMode] = useState<"matched" | "similar" | "all">("matched");
  const [sentMessages, setSentMessages] = useState<ReturnType<typeof getMessagesForRenter>>([]);
  const [messageTarget, setMessageTarget] = useState<RentalListing | null>(null);
  const [messageText, setMessageText] = useState("");
  const [ready, setReady] = useState(false);
  const [hasProfile, setHasProfile] = useState(false);
  const [loginForm, setLoginForm] = useState({ login: "", password: "" });
  const qrInputRef = useRef<HTMLInputElement>(null);

  const reloadSentMessages = (login?: string) => {
    setSentMessages(getMessagesForRenter(login ?? form.login));
  };

  const runSearch = (data: RenterSearchForm) => {
    const maxPrice = parseSumma(data.summa);
    const minArea = Number(data.kv) || undefined;
    const { parsed, results: found, query, mode } = searchRentalListingsFromForm({
      officeAddress: data.officeAddress.trim(),
      maxPrice,
      minArea,
      propertyType: data.rentalPlaceType,
    });
    setResults(found);
    setSearchMode(mode);
    const hints: string[] = [];
    if (parsed.districts.length) hints.push(`Hudud: ${parsed.districts.join(", ")}`);
    if (minArea) hints.push(`KV: ${minArea} m²`);
    if (maxPrice) hints.push(`Summa: ${formatUzs(maxPrice)} gacha`);
    if (data.rentalPlaceType) hints.push(`Tur: ${data.rentalPlaceType}`);
    if (mode === "similar") {
      hints.push("Mos e'lon topilmadi — o'xshash joylashtirilgan e'lonlar");
    } else if (mode === "all") {
      hints.push("Barcha joylashtirilgan e'lonlar");
    }
    setHint(hints.length > 0 ? hints.join(" · ") : query);
    return found;
  };

  useEffect(() => {
    const saved = getRenterProfile();
    if (saved) {
      const { createdAt: _c, updatedAt: _u, ...raw } = saved;
      const formData = normalizeRenterForm(raw);
      setForm(formData);
      runSearch(formData);
      setStep("profile");
      setHasProfile(true);
      reloadSentMessages(formData.login);
    }
    setReady(true);
  }, []);

  const onQrUpload = (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Faqat rasm fayli yuklang");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Rasm 2 MB dan kichik bo'lsin");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setForm((f) => ({ ...f, instagramQr: String(reader.result ?? "") }));
      toast.success("QR yuklandi");
    };
    reader.readAsDataURL(file);
  };

  const onSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !form.login.trim() ||
      !form.companyName.trim() ||
      !form.phone?.trim() ||
      !form.officeAddress.trim() ||
      !form.kv.trim() ||
      !form.summa.trim()
    ) {
      toast.error("Login, firma nomi, telefon, manzil, KV va summa majburiy");
      return;
    }
    if (!hasProfile && !form.password.trim()) {
      toast.error("Yangi profil uchun parol kiriting");
      return;
    }

    const saved = saveRenterProfile(form);
    if (!saved.ok) {
      toast.error(saved.error);
      return;
    }

    saveGlobalInquiryFromForm(form);
    runSearch(form);
    setStep("profile");
    setHasProfile(true);
    reloadSentMessages(form.login);
    toast.success(
      hasProfile
        ? "Profil yangilandi!"
        : "Profil yaratildi! Barcha ijara egalari mijozlar ro'yxatida ko'radi."
    );
  };

  const onLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginForm.login.trim() || !loginForm.password.trim()) {
      toast.error("Login va parol kiriting");
      return;
    }
    const profile = loginRenter(loginForm.login, loginForm.password);
    if (!profile) {
      toast.error("Login yoki parol noto'g'ri");
      return;
    }
    const { createdAt: _c, updatedAt: _u, ...raw } = profile;
    const formData = normalizeRenterForm(raw);
    setForm(formData);
    runSearch(formData);
    setStep("profile");
    setHasProfile(true);
    reloadSentMessages(formData.login);
    setLoginForm({ login: "", password: "" });
    toast.success(`Xush kelibsiz, ${profile.companyName}!`);
  };

  const goToProfile = () => {
    const saved = getRenterProfile();
    if (saved) {
      const { createdAt: _c, updatedAt: _u, ...raw } = saved;
      const formData = normalizeRenterForm(raw);
      setForm(formData);
      runSearch(formData);
    }
    setStep("profile");
    reloadSentMessages(saved?.login);
  };

  const exitProfile = () => {
    clearRenterProfile();
    setForm(EMPTY_FORM);
    setResults([]);
    setHint("");
    setStep("form");
    setHasProfile(false);
    toast.success("Profildan chiqildi");
  };

  const openMessage = (listing: RentalListing) => {
    if (!listing.landlordEmail) {
      toast.info("Bu platforma e'loni — xabar faqat ijara egasi e'lonlariga");
      return;
    }
    if (!(form.phone ?? "").trim()) {
      toast.error("Xabar yuborish uchun avval telefon raqam kiriting");
      setForm((f) => ({ ...f, password: "" }));
      setStep("form");
      return;
    }
    setMessageTarget(listing);
    setMessageText(buildInquiryMessage(form, listing.title));
  };

  const sendMessage = () => {
    if (!messageTarget?.landlordEmail || !messageText.trim()) return;
    const phone = (form.phone ?? "").trim();
    if (!phone) {
      toast.error("Telefon raqam majburiy — formada kiriting");
      setMessageTarget(null);
      setForm((f) => ({ ...f, password: "" }));
      setStep("form");
      return;
    }
    const finalMessage = ensurePhoneInMessage(messageText.trim(), phone);
    const summa = parseSumma(form.summa) ?? 0;
    saveRentalInquiry({
      companyName: form.companyName.trim(),
      phone,
      activityType: form.activityType,
      activitySince: form.activitySince.trim(),
      briefInfo: form.briefInfo.trim(),
      instagramLink: form.instagramLink.trim(),
      instagramQr: form.instagramQr || undefined,
      officeAddress: form.officeAddress.trim(),
      rentalPlaceType: form.rentalPlaceType,
      kv: Number(form.kv) || 0,
      summa,
      message: finalMessage,
      listingId: messageTarget.id,
      listingTitle: messageTarget.title,
      renterLogin: form.login.trim(),
      landlordEmail: messageTarget.landlordEmail,
      landlordName: messageTarget.landlordName,
    });
    reloadSentMessages(form.login);
    toast.success(
      "Xabar yuborildi! Ijara egasining «Xabarlar» bo'limida ko'rinadi."
    );
    setMessageTarget(null);
    setMessageText("");
  };

  if (!ready) {
    return (
      <div className="min-h-screen bg-[#060d18] pt-24">
        <div className="mx-auto h-64 max-w-4xl animate-pulse rounded-2xl border border-white/10 bg-white/5 px-4" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#060d18] text-white selection:bg-cyan-500/30">
      <LandingNavbar activePath="/ijara-qidiruv" />
      <main className="pt-24 pb-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-4 py-1.5 text-sm text-cyan-300">
              <Search className="size-4" />
              Arendatorlar uchun
            </span>
            <h1 className="mt-4 text-3xl font-bold sm:text-4xl">
              Ijara{" "}
              <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                qidiruv
              </span>
            </h1>
            <p className="mx-auto mt-3 max-w-2xl text-slate-400">
              Firma ma&apos;lumotlarini kiriting va mos e&apos;lonlarni toping.
            </p>
          </div>

          {step === "form" ? (
            <div className="mt-10 grid gap-6 lg:grid-cols-3">
            <form
              onSubmit={onSubmitForm}
              className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl sm:p-8 lg:col-span-2"
            >
              {hasProfile && (
                <div className="mb-6 flex flex-wrap gap-2 border-b border-white/10 pb-4">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-2 border-white/20 bg-white/5 text-white hover:bg-white/10"
                    onClick={goToProfile}
                  >
                    <ArrowLeft className="size-4" />
                    Profilga qaytish
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="gap-2 text-slate-400 hover:bg-white/5 hover:text-white"
                    onClick={exitProfile}
                  >
                    <LogOut className="size-4" />
                    Chiqish
                  </Button>
                </div>
              )}
              <h2 className="text-lg font-semibold">Qidiruv formasi</h2>
              <p className="mt-1 text-sm text-slate-500">
                Login va parol o&apos;zingiz tanlaysiz — keyin shu orqali kirasiz
              </p>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Login *</Label>
                  <Input
                    value={form.login}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, login: e.target.value }))
                    }
                    disabled={hasProfile}
                    className="border-white/10 bg-white/5 text-white disabled:opacity-60"
                    placeholder="masalan: umarxon"
                    autoComplete="username"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>{hasProfile ? "Yangi parol (ixtiyoriy)" : "Parol *"}</Label>
                  <Input
                    type="password"
                    value={form.password}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, password: e.target.value }))
                    }
                    className="border-white/10 bg-white/5 text-white"
                    placeholder={hasProfile ? "O'zgartirmasangiz bo'sh qoldiring" : "Kamida 4 belgi"}
                    autoComplete={hasProfile ? "new-password" : "new-password"}
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Firma nomi *</Label>
                  <Input
                    value={form.companyName}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, companyName: e.target.value }))
                    }
                    className="border-white/10 bg-white/5 text-white"
                    placeholder="MChJ ..."
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Telefon raqam *</Label>
                  <Input
                    type="tel"
                    value={form.phone}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, phone: e.target.value }))
                    }
                    className="border-white/10 bg-white/5 text-white"
                    placeholder="+998901234567"
                    autoComplete="tel"
                  />
                  <p className="text-xs text-slate-500">
                    Ijara egalari siz bilan shu raqam orqali bog&apos;lanadi
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label>Faoliyat turi *</Label>
                  <Select
                    value={form.activityType}
                    onValueChange={(v) =>
                      setForm((f) => ({ ...f, activityType: v }))
                    }
                  >
                    <SelectTrigger className="border-white/10 bg-white/5 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ACTIVITY_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Qanchadan beri faoliyat yuritadi</Label>
                  <Input
                    value={form.activitySince}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, activitySince: e.target.value }))
                    }
                    className="border-white/10 bg-white/5 text-white"
                    placeholder="Masalan: 2020 yildan yoki 5 yil"
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Qisqacha ma&apos;lumot</Label>
                  <Textarea
                    value={form.briefInfo}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, briefInfo: e.target.value }))
                    }
                    className="min-h-20 border-white/10 bg-white/5 text-white"
                    placeholder="Firma va faoliyat haqida qisqacha..."
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Instagram linki</Label>
                  <Input
                    value={form.instagramLink}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, instagramLink: e.target.value }))
                    }
                    className="border-white/10 bg-white/5 text-white"
                    placeholder="https://instagram.com/..."
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Instagram QR</Label>
                  <div className="flex flex-wrap items-center gap-3">
                    <input
                      ref={qrInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => onQrUpload(e.target.files?.[0] ?? null)}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      className="border-white/20 bg-white/5 text-white hover:bg-white/10"
                      onClick={() => qrInputRef.current?.click()}
                    >
                      QR yuklash
                    </Button>
                    {form.instagramQr && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={form.instagramQr}
                        alt="Instagram QR"
                        className="size-16 rounded-lg border border-white/10 object-cover"
                      />
                    )}
                  </div>
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Ofis manzili *</Label>
                  <Textarea
                    value={form.officeAddress}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, officeAddress: e.target.value }))
                    }
                    className="border-white/10 bg-white/5 text-white"
                    placeholder="Toshkent, Chilonzor, ..."
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Ijaraga olmoqchi joy turi *</Label>
                  <Select
                    value={form.rentalPlaceType}
                    onValueChange={(v) =>
                      setForm((f) => ({ ...f, rentalPlaceType: v }))
                    }
                  >
                    <SelectTrigger className="border-white/10 bg-white/5 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PROPERTY_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>KV (m²) *</Label>
                  <Input
                    type="number"
                    min={1}
                    value={form.kv}
                    onChange={(e) => setForm((f) => ({ ...f, kv: e.target.value }))}
                    className="border-white/10 bg-white/5 text-white"
                    placeholder="50"
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Summa (so&apos;m) *</Label>
                  <Input
                    inputMode="numeric"
                    value={form.summa}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        summa: formatSummaInput(e.target.value),
                      }))
                    }
                    className="border-white/10 bg-white/5 text-white"
                    placeholder="5 000 000"
                  />
                  <p className="text-xs text-slate-500">
                    O&apos;zbek so&apos;mida kiriting. Masalan: 5 000 000
                  </p>
                </div>
              </div>
              <Button
                type="submit"
                className="mt-6 gap-2 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400"
              >
                <Search className="size-4" />
                Profil ochish va e&apos;lonlarni ko&apos;rish
              </Button>
            </form>

            <aside className="h-fit rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-cyan-950/40 to-[#0a1628] p-6 backdrop-blur-xl sm:p-8">
              <div className="flex items-center gap-2 text-cyan-400">
                <LogIn className="size-5" />
                <h2 className="text-lg font-semibold text-white">Kirish</h2>
              </div>
              <p className="mt-2 text-sm text-slate-400">
                Akkauntingiz bormi? O&apos;z login va parolingiz bilan kiring.
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
                      setLoginForm((f) => ({ ...f, password: e.target.value }))
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
            </div>
          ) : (
            <div className="mt-10 space-y-6">
              <div className="overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-blue-950/50 via-[#0a1628] to-slate-900/80">
                <div className="border-b border-white/10 bg-white/5 px-6 py-6 sm:px-8">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex items-center gap-4">
                      <div className="flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-400 text-xl font-bold text-white">
                        {form.companyName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h2 className="text-xl font-bold">{form.companyName}</h2>
                        <p className="text-sm text-cyan-400">{form.activityType}</p>
                        {form.login && (
                          <p className="text-xs text-slate-500">@{form.login}</p>
                        )}
                        {form.activitySince && (
                          <p className="text-xs text-slate-500">{form.activitySince}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2 border-white/20 bg-white/5 text-white hover:bg-white/10"
                        onClick={() => {
                          setForm((f) => ({ ...f, password: "" }));
                          setStep("form");
                        }}
                      >
                        <Edit3 className="size-4" />
                        Tahrirlash
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-2 text-slate-400 hover:bg-white/5 hover:text-white"
                        onClick={exitProfile}
                      >
                        <LogOut className="size-4" />
                        Chiqish
                      </Button>
                    </div>
                  </div>
                </div>
                <div className="grid gap-4 p-6 sm:grid-cols-2 sm:p-8">
                  <div className="flex gap-3 text-sm sm:col-span-2">
                    <Phone className="mt-0.5 size-4 shrink-0 text-cyan-400" />
                    <div>
                      <p className="text-slate-500">Telefon</p>
                      <p className="text-white">{form.phone || "—"}</p>
                    </div>
                  </div>
                  <div className="flex gap-3 text-sm">
                    <Building2 className="mt-0.5 size-4 shrink-0 text-cyan-400" />
                    <div>
                      <p className="text-slate-500">Ofis manzili</p>
                      <p className="text-white">{form.officeAddress}</p>
                    </div>
                  </div>
                  <div className="text-sm">
                    <p className="text-slate-500">Joy turi</p>
                    <p className="text-white">{form.rentalPlaceType}</p>
                  </div>
                  <div className="text-sm">
                    <p className="text-slate-500">KV</p>
                    <p className="text-white">{form.kv} m²</p>
                  </div>
                  <div className="text-sm">
                    <p className="text-slate-500">Summa</p>
                    <p className="font-semibold text-cyan-400">
                      {form.summa ? formatUzs(parseSumma(form.summa) ?? 0) : "—"}
                    </p>
                  </div>
                  {form.briefInfo && (
                    <div className="text-sm sm:col-span-2">
                      <p className="text-slate-500">Qisqacha</p>
                      <p className="text-white">{form.briefInfo}</p>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <h3 className="mb-1 text-lg font-semibold">
                  {searchMode === "matched"
                    ? "Mos e'lonlar"
                    : searchMode === "similar"
                      ? "O'xshash e'lonlar"
                      : "Joylashtirilgan e'lonlar"}
                </h3>
                <p className="text-sm text-cyan-400">{hint}</p>
                <p className="text-sm text-slate-500">
                  {results.length} ta e&apos;lon topildi
                </p>
              </div>

              {results.length === 0 ? (
                <div className="rounded-xl border border-white/10 bg-white/5 p-8 text-center">
                  <p className="text-slate-400">
                    Hozircha joylashtirilgan e&apos;lon yo&apos;q. Ijara egalari yoki
                    dashboard orqali e&apos;lon qo&apos;shing.
                  </p>
                  <Button
                    variant="outline"
                    className="mt-4 gap-2 border-white/20 bg-white/5 text-white hover:bg-white/10"
                    onClick={() => {
                      setForm((f) => ({ ...f, password: "" }));
                      setStep("form");
                    }}
                  >
                    <ArrowLeft className="size-4" />
                    Formaga qaytish
                  </Button>
                </div>
              ) : (
                results.map((item) => (
                  <article
                    key={item.id}
                    className="overflow-hidden rounded-xl border border-white/10 bg-gradient-to-r from-white/[0.06] to-transparent"
                  >
                    {item.images?.[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.images[0]}
                        alt={item.title}
                        className="h-44 w-full object-cover"
                      />
                    ) : null}
                    <div className="p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-semibold text-white">
                          {item.title}
                        </h3>
                        <p className="mt-1 flex items-center gap-1 text-sm text-slate-400">
                          <MapPin className="size-3.5" />
                          {item.district} · {item.rooms} xona · {item.area} m²
                        </p>
                        {item.landlordName && (
                          <p className="mt-1 text-xs text-slate-500">
                            Ijara egasi: {item.landlordName}
                          </p>
                        )}
                      </div>
                      <p className="text-xl font-bold text-cyan-400">
                        {formatUzs(item.price)}
                      </p>
                    </div>
                    {item.description && (
                      <p className="mt-3 text-sm text-slate-400">
                        {item.description}
                      </p>
                    )}
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <Badge variant="secondary">{item.propertyType}</Badge>
                      <Badge variant="outline" className="border-white/20 text-slate-400">
                        {item.source === "landlord" ? "Ijara egasi" : "Arenda AI"}
                      </Badge>
                      {item.landlordEmail ? (
                        <Button
                          size="sm"
                          className="ml-auto gap-2"
                          onClick={() => openMessage(item)}
                        >
                          <MessageCircle className="size-4" />
                          Xabar yuborish
                        </Button>
                      ) : null}
                    </div>
                    </div>
                  </article>
                ))
              )}

              {sentMessages.length > 0 && (
                <div className="space-y-4 border-t border-white/10 pt-8">
                  <h3 className="text-lg font-semibold">Yuborilgan xabarlar</h3>
                  <p className="text-sm text-slate-500">
                    Ijara egalariga yuborgan xabarlaringiz
                  </p>
                  {sentMessages.map((msg) => (
                    <div
                      key={msg.id}
                      className="rounded-xl border border-white/10 bg-white/5 p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-medium text-cyan-400">
                          {msg.listingTitle}
                        </p>
                        <p className="text-xs text-slate-500">
                          {msg.landlordName || "Ijara egasi"}
                        </p>
                      </div>
                      <p className="mt-2 whitespace-pre-wrap text-sm text-slate-400 line-clamp-4">
                        {msg.message}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </main>
      <LandingFooter />

      <Dialog open={!!messageTarget} onOpenChange={() => setMessageTarget(null)}>
        <DialogContent className="border-white/10 bg-[#0a1628] text-white">
          <DialogHeader>
            <DialogTitle>Xabar yuborish</DialogTitle>
          </DialogHeader>
          {messageTarget && (
            <p className="text-sm text-slate-400">
              E&apos;lon: <span className="text-white">{messageTarget.title}</span>
            </p>
          )}
          {(form.phone ?? "").trim() && (
            <p className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
              <Phone className="size-4 shrink-0" />
              Arendator telefoni: <span className="font-medium text-white">{form.phone}</span>
            </p>
          )}
          <Textarea
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            className="min-h-28 border-white/10 bg-white/5 text-white"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setMessageTarget(null)}>
              Bekor
            </Button>
            <Button onClick={sendMessage}>Yuborish</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
