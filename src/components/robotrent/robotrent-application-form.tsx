"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ROBOTRENT_TRIAL_DAYS_DEFAULT,
  ROBOTRENT_TYPE_LABELS,
} from "@/lib/robotrent/constants";

export type RobotRentFormType = "CUSTOMER" | "DISTRIBUTOR" | "MANUFACTURER";

type FieldKind = "text" | "tel" | "email" | "number" | "date" | "textarea" | "checkbox";

interface FieldDef {
  name: string;
  label: string;
  kind: FieldKind;
  placeholder?: string;
  hint?: string;
}

const FIELDS: Record<RobotRentFormType, FieldDef[]> = {
  CUSTOMER: [
    { name: "companyName", label: "Kompaniya nomi", kind: "text", placeholder: "Masalan: Tashkent Mall" },
    { name: "city", label: "Shahar", kind: "text", placeholder: "Toshkent" },
    { name: "objectType", label: "Obyekt turi", kind: "text", placeholder: "Ofis, ombor, savdo markazi…" },
    { name: "areaSqm", label: "Maydon (m²)", kind: "number", placeholder: "1500" },
    { name: "phone", label: "Telefon", kind: "tel", placeholder: "+998 90 123 45 67" },
    { name: "startDate", label: "Boshlanish sanasi", kind: "date" },
  ],
  DISTRIBUTOR: [
    { name: "companyName", label: "Kompaniya nomi", kind: "text" },
    { name: "serviceCity", label: "Xizmat ko‘rsatish shahri", kind: "text", placeholder: "Toshkent" },
    { name: "robotModel", label: "Robot modeli", kind: "text" },
    { name: "hasDemoRobot", label: "Demo robot mavjud", kind: "checkbox" },
    {
      name: "serviceCapability",
      label: "Servis imkoniyati",
      kind: "textarea",
      placeholder: "Texnik xizmat, ehtiyot qismlar, o‘qitish…",
    },
    { name: "phone", label: "Telefon", kind: "tel", placeholder: "+998 90 123 45 67" },
  ],
  MANUFACTURER: [
    { name: "companyName", label: "Kompaniya nomi", kind: "text" },
    { name: "country", label: "Davlat", kind: "text", placeholder: "Xitoy, Janubiy Koreya…" },
    { name: "robotModel", label: "Robot modeli", kind: "text" },
    {
      name: "techDocumentNote",
      label: "Texnik hujjat izohi",
      kind: "textarea",
      placeholder: "Spetsifikatsiya, sertifikatlar, hujjatlar havolasi…",
    },
    {
      name: "monthlyRentalTerms",
      label: "Oylik ijara shartlari",
      kind: "textarea",
      placeholder: "Taxminiy oylik narx, minimal muddat…",
    },
    { name: "email", label: "Email", kind: "email", placeholder: "info@company.com" },
  ],
};

const TITLES: Record<RobotRentFormType, string> = {
  CUSTOMER: "Sinov uchun ariza",
  DISTRIBUTOR: "Distribyutor arizasi",
  MANUFACTURER: "Ishlab chiqaruvchi arizasi",
};

const inputCls =
  "border-white/15 bg-white/5 text-white placeholder:text-slate-500 focus-visible:ring-cyan-400/50";

type FormValues = Record<string, string | boolean>;

function initialValues(type: RobotRentFormType, robot?: string): FormValues {
  const values: FormValues = {};
  for (const f of FIELDS[type]) {
    values[f.name] = f.kind === "checkbox" ? false : "";
  }
  if (robot && type !== "CUSTOMER" && "robotModel" in values) {
    values.robotModel = robot;
  }
  return values;
}

export function RobotRentApplicationForm({
  type,
  robotSlug,
}: {
  type: RobotRentFormType;
  /** Katalogdan kelgan robot slug (?robot=slug) */
  robotSlug?: string;
}) {
  const [values, setValues] = useState<FormValues>(() =>
    initialValues(type, robotSlug)
  );
  const [website, setWebsite] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [trackingCode, setTrackingCode] = useState<string | null>(null);

  const fields = FIELDS[type];

  function setValue(name: string, value: string | boolean) {
    setValues((prev) => ({ ...prev, [name]: value }));
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = { type, website };
      for (const f of fields) {
        const v = values[f.name];
        payload[f.name] =
          f.kind === "number" ? Number(v) : f.kind === "checkbox" ? Boolean(v) : v;
      }
      if (robotSlug && type === "CUSTOMER") payload.robotSlug = robotSlug;

      const res = await fetch("/api/public/robotrent/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await res.json().catch(() => null)) as {
        data?: { trackingCode?: string };
        message?: string;
      } | null;
      if (!res.ok || !json?.data?.trackingCode) {
        setError(
          res.status === 429
            ? "Juda ko‘p so‘rov yuborildi. Birozdan so‘ng qayta urinib ko‘ring."
            : "Arizani yuborib bo‘lmadi. Maydonlarni tekshirib, qayta urinib ko‘ring."
        );
        return;
      }
      setTrackingCode(json.data.trackingCode);
    } catch {
      setError("Server bilan bog‘lanib bo‘lmadi. Qayta urinib ko‘ring.");
    } finally {
      setSubmitting(false);
    }
  }

  if (trackingCode) {
    return (
      <div className="robotrent-card p-8 text-center">
        <CheckCircle2 className="mx-auto size-12 text-cyan-300" />
        <h2 className="mt-4 text-2xl font-bold text-white">
          Arizangiz qabul qilindi
        </h2>
        <p className="mt-2 text-slate-400">
          Ariza holatini kuzatish uchun tracking kodni saqlab qo‘ying:
        </p>
        <p className="mx-auto mt-4 w-fit select-all rounded-lg border border-cyan-300/30 bg-cyan-400/10 px-5 py-3 font-mono text-lg font-semibold tracking-wider text-cyan-300">
          {trackingCode}
        </p>
        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          <Button
            asChild
            className="bg-cyan-400 text-[#071429] hover:bg-cyan-300"
          >
            <Link href={`/robotrent/track/${encodeURIComponent(trackingCode)}`}>
              Ariza holatini ko‘rish
            </Link>
          </Button>
          <Button
            asChild
            variant="outline"
            className="border-white/25 bg-transparent text-white hover:bg-white/10 hover:text-white"
          >
            <Link href="/robotrent">Bosh sahifaga</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="robotrent-card space-y-5 p-6 sm:p-8" noValidate={false}>
      <div>
        <h2 className="text-xl font-bold text-white">{TITLES[type]}</h2>
        <p className="mt-1 text-sm text-slate-400">
          {ROBOTRENT_TYPE_LABELS[type]} sifatida ariza qoldiring.
          {type === "CUSTOMER"
            ? ` Sinov muddati ${ROBOTRENT_TRIAL_DAYS_DEFAULT} kun.`
            : null}
        </p>
        {robotSlug && type === "CUSTOMER" ? (
          <p className="mt-2 text-xs text-cyan-300">
            Tanlangan robot: <span className="font-mono">{robotSlug}</span>
          </p>
        ) : null}
      </div>

      {/* Honeypot: odamlar ko‘rmaydi */}
      <div
        aria-hidden="true"
        className="absolute -left-[9999px] h-0 w-0 overflow-hidden"
      >
        <label htmlFor="rr-website">Website</label>
        <input
          id="rr-website"
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        {fields.map((f) => {
          const id = `rr-${f.name}`;
          if (f.kind === "checkbox") {
            return (
              <label
                key={f.name}
                htmlFor={id}
                className="flex cursor-pointer items-center gap-3 text-sm text-slate-200 sm:col-span-2"
              >
                <input
                  id={id}
                  type="checkbox"
                  checked={Boolean(values[f.name])}
                  onChange={(e) => setValue(f.name, e.target.checked)}
                  className="size-4 accent-cyan-400"
                />
                {f.label}
              </label>
            );
          }
          if (f.kind === "textarea") {
            return (
              <div key={f.name} className="space-y-2 sm:col-span-2">
                <Label htmlFor={id} className="text-slate-200">
                  {f.label}
                </Label>
                <textarea
                  id={id}
                  required
                  rows={3}
                  maxLength={500}
                  placeholder={f.placeholder}
                  value={String(values[f.name] ?? "")}
                  onChange={(e) => setValue(f.name, e.target.value)}
                  className="flex w-full rounded-md border border-white/15 bg-white/5 px-3 py-2 text-sm text-white shadow-sm placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50"
                />
              </div>
            );
          }
          return (
            <div key={f.name} className="space-y-2">
              <Label htmlFor={id} className="text-slate-200">
                {f.label}
              </Label>
              <Input
                id={id}
                required
                type={f.kind}
                min={f.kind === "number" ? 1 : undefined}
                step={f.kind === "number" ? "any" : undefined}
                maxLength={f.kind === "text" || f.kind === "email" ? 200 : undefined}
                placeholder={f.placeholder}
                value={String(values[f.name] ?? "")}
                onChange={(e) => setValue(f.name, e.target.value)}
                className={`${inputCls} ${f.kind === "date" ? "[color-scheme:dark]" : ""}`}
              />
            </div>
          );
        })}
      </div>

      {error ? (
        <p role="alert" className="rounded-md border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      ) : null}

      <Button
        type="submit"
        size="lg"
        disabled={submitting}
        className="w-full bg-cyan-400 text-[#071429] hover:bg-cyan-300 sm:w-auto"
      >
        {submitting ? <Loader2 className="animate-spin" /> : null}
        {submitting ? "Yuborilmoqda…" : "Arizani yuborish"}
      </Button>
    </form>
  );
}
