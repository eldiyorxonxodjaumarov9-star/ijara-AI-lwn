"use client";

import { useState } from "react";
import { Bot, Mail, MapPin, MessageCircle, Package, Send, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { CrmGlassCard } from "@/components/arenda-crm/crm-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  AI_FEATURES,
  RENTAL_PACKAGES,
  UZ_REGIONS,
} from "@/lib/arenda-crm/constants";
import {
  normalizeLandlordForm,
  saveLandlordProfile,
  type LandlordProfile,
  type LandlordProfileForm,
} from "@/lib/landlord-profile";
import { PROPERTY_TYPES } from "@/lib/landlord-profile";

export function CrmAiCenterView() {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState("");

  const runAi = (type: string) => {
    if (!query.trim()) {
      toast.error("So'rov kiriting");
      return;
    }
    const responses: Record<string, string> = {
      search: `"${query}" bo'yicha 3 ta mos e'lon topildi: Chilonzor 2 xona, Yunusobod ofis, Sergeli do'kon.`,
      pricing: `Taxminiy ijara narxi: 4 200 000 — 5 800 000 so'm/oy. Bozor o'rtachasi: 5 100 000.`,
      ads: `📍 ${query}\n✅ Yangi ta'mir\n💰 Kelishiladi\n📞 Bog'laning\n#ijara #toshkent`,
      broker: `Tavsiya: 1) Yunusobod ofis 80m² 2) Chilonzor 3 xona 3) Mirzo Ulug'bek do'kon`,
      leads: `Lid sifati: 78% — yuqori ehtimol. 24 soat ichida bog'lanish tavsiya etiladi.`,
      contract: `IJARA SHARTNOMASI\n${query}\nMuddat: 12 oy\nDepozit: 1 oy`,
      description: `${query} — zamonaviy, qulay joylashuv, transport yaqinida, ofis yoki yashash uchun ideal.`,
    };
    setResult(responses[type] ?? "AI javob tayyorlandi.");
    toast.success("AI natija tayyor");
  };

  return (
    <div className="space-y-6">
      <CrmGlassCard
        title="AI Markaz"
        description="Qidiruv, narx, reklama, broker, lid tahlili va shartnoma generatori"
      >
        <div className="mb-6 space-y-3">
          <Label>AI so&apos;rovingiz</Label>
          <Textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Masalan: Chilonzorda 2 xonali kvartira 5 mln gacha"
            className="min-h-20"
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {AI_FEATURES.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => runAi(f.id)}
              className="rounded-xl border border-white/10 bg-white/40 p-4 text-left transition hover:border-[#2563EB]/40 hover:bg-[#2563EB]/5 dark:bg-white/5"
            >
              <div className="flex items-center gap-2">
                <Bot className="size-4 text-[#38BDF8]" />
                <span className="font-medium">{f.title}</span>
              </div>
              <p className="mt-1 text-xs text-slate-500">{f.description}</p>
            </button>
          ))}
        </div>

        {result && (
          <div className="mt-6 rounded-xl border border-[#38BDF8]/30 bg-[#38BDF8]/5 p-4">
            <div className="mb-2 flex items-center gap-2 text-[#38BDF8]">
              <Sparkles className="size-4" />
              <span className="text-sm font-semibold">AI natija</span>
            </div>
            <p className="whitespace-pre-wrap text-sm">{result}</p>
          </div>
        )}
      </CrmGlassCard>
    </div>
  );
}

export function CrmCommunicationView() {
  return (
    <CrmGlassCard title="Aloqa markazi" description="Telegram, SMS va Email kampaniyalar">
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { icon: MessageCircle, label: "Telegram", desc: "Bot orqali xabarlar" },
          { icon: Send, label: "SMS", desc: "To'lov eslatmalari" },
          { icon: Mail, label: "Email", desc: "Kampaniya yuborish" },
        ].map((c) => (
          <div key={c.label} className="rounded-xl border border-white/10 bg-white/40 p-5 dark:bg-white/5">
            <c.icon className="mb-2 size-6 text-[#2563EB]" />
            <p className="font-semibold">{c.label}</p>
            <p className="text-sm text-slate-500">{c.desc}</p>
            <Button size="sm" className="mt-3" variant="outline">
              Yuborish
            </Button>
          </div>
        ))}
      </div>
    </CrmGlassCard>
  );
}

export function CrmRegionsView() {
  return (
    <CrmGlassCard title="Hududlar analitikasi" description="O'zbekiston bo'ylab mulklar va daromad">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {UZ_REGIONS.map((region, i) => (
          <div key={region} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/40 px-4 py-3 dark:bg-white/5">
            <div className="flex items-center gap-2">
              <MapPin className="size-4 text-[#38BDF8]" />
              <span className="font-medium">{region}</span>
            </div>
            <Badge variant="secondary">{Math.max(0, 12 - i)} mulk</Badge>
          </div>
        ))}
      </div>
    </CrmGlassCard>
  );
}

export function CrmPackagesView() {
  return (
    <CrmGlassCard title="Ijara paketlari" description="Qurilish, tadbir va ofis paketlari">
      <div className="grid gap-4 sm:grid-cols-3">
        {RENTAL_PACKAGES.map((pkg) => (
          <div key={pkg.id} className="rounded-xl border border-white/10 bg-gradient-to-br from-[#2563EB]/10 to-transparent p-5">
            <span className="text-3xl">{pkg.icon}</span>
            <p className="mt-2 font-semibold">{pkg.name}</p>
            <ul className="mt-2 space-y-1 text-sm text-slate-500">
              {pkg.items.map((item) => (
                <li key={item}>• {item}</li>
              ))}
            </ul>
            <Button size="sm" className="mt-4 w-full">
              <Package className="size-4" />
              Paket yaratish
            </Button>
          </div>
        ))}
      </div>
    </CrmGlassCard>
  );
}

export function CrmSettingsView({
  profile,
  onProfileUpdate,
}: {
  profile: LandlordProfile;
  onProfileUpdate: (p: LandlordProfile) => void;
}) {
  const [form, setForm] = useState<LandlordProfileForm>(
    normalizeLandlordForm({ ...profile, password: "" })
  );

  const onSave = (e: React.FormEvent) => {
    e.preventDefault();
    const result = saveLandlordProfile(form);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    onProfileUpdate(result.profile);
    toast.success("Profil yangilandi");
  };

  return (
    <CrmGlassCard title="Sozlamalar" description="Profil, kompaniya va xavfsizlik">
      <form onSubmit={onSave} className="grid max-w-2xl gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Login</Label>
          <Input value={form.login} disabled />
        </div>
        <div className="space-y-1.5">
          <Label>Yangi parol</Label>
          <Input type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} placeholder="Ixtiyoriy" />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label>To&apos;liq ism</Label>
          <Input value={form.fullName} onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))} />
        </div>
        <div className="space-y-1.5">
          <Label>Telefon</Label>
          <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
        </div>
        <div className="space-y-1.5">
          <Label>Email</Label>
          <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
        </div>
        <div className="space-y-1.5">
          <Label>Kompaniya</Label>
          <Input value={form.company} onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))} />
        </div>
        <div className="space-y-1.5">
          <Label>Shahar</Label>
          <Input value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} />
        </div>
        <div className="space-y-1.5">
          <Label>Mulk turi</Label>
          <select
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={form.propertyType}
            onChange={(e) => setForm((f) => ({ ...f, propertyType: e.target.value }))}
          >
            {PROPERTY_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label>Haqida</Label>
          <Textarea value={form.about} onChange={(e) => setForm((f) => ({ ...f, about: e.target.value }))} />
        </div>
        <div className="sm:col-span-2">
          <Button type="submit">Saqlash</Button>
        </div>
      </form>
    </CrmGlassCard>
  );
}
