"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2 } from "lucide-react";

import {
  fieldsForProfile,
  FORM_TITLES,
  SUBMIT_LABELS,
  type FormProfile,
  type RobotRentFormType,
} from "@/lib/robotrent/form-fields";

export type { RobotRentFormType };

type FormValues = Record<string, string | boolean>;

function useFormProfile(): FormProfile {
  const [profile, setProfile] = useState<FormProfile>("mobile");

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const apply = () => setProfile(mq.matches ? "desktop" : "mobile");
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  return profile;
}

function initialValues(type: RobotRentFormType, robot?: string): FormValues {
  const values: FormValues = {};
  for (const f of fieldsForProfile(type, "desktop")) {
    values[f.name] = f.kind === "checkbox" ? false : "";
  }
  if (robot && (type === "DISTRIBUTOR" || type === "CUSTOMER")) {
    if ("robotModel" in values) values.robotModel = robot;
  }
  return values;
}

export function RobotRentApplicationForm({
  type,
  robotSlug,
  embedded,
}: {
  type: RobotRentFormType;
  robotSlug?: string;
  /** Form sahifasida sarlavha tashqarida bo‘lsa */
  embedded?: boolean;
}) {
  const formProfile = useFormProfile();
  const fields = useMemo(
    () => fieldsForProfile(type, formProfile),
    [type, formProfile]
  );
  const [values, setValues] = useState<FormValues>(() =>
    initialValues(type, robotSlug)
  );
  const [website, setWebsite] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [trackingCode, setTrackingCode] = useState<string | null>(null);

  const title = FORM_TITLES[type][formProfile];

  function setValue(name: string, value: string | boolean) {
    setValues((prev) => ({ ...prev, [name]: value }));
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        type,
        formProfile,
        website,
      };
      for (const f of fields) {
        const v = values[f.name];
        payload[f.name] =
          f.kind === "number" ? (v === "" ? undefined : Number(v)) : f.kind === "checkbox" ? Boolean(v) : v;
      }
      if (robotSlug && type === "CUSTOMER") payload.robotSlug = robotSlug;

      const res = await fetch("/api/public/robotrent/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await res.json().catch(() => null)) as {
        data?: { trackingCode?: string };
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
      <div className="robotrent-card px-6 py-8 text-center">
        <CheckCircle2 className="mx-auto size-11 text-[var(--rr-primary)]" />
        <h2 className="mt-4 text-xl font-bold text-[var(--rr-text)]">
          Arizangiz qabul qilindi
        </h2>
        <p className="mt-2 text-sm text-[var(--rr-muted)]">Tracking kod:</p>
        <p className="mx-auto mt-3 w-fit select-all rounded-lg border border-[var(--rr-border)] bg-[var(--rr-surface)] px-4 py-2 font-mono text-base font-semibold text-[var(--rr-text)]">
          {trackingCode}
        </p>
        <Link
          href={`/robotrent/track/${encodeURIComponent(trackingCode)}`}
          className="robotrent-btn-primary mt-6 inline-flex max-w-xs"
        >
          Ariza holatini ko‘rish
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate={false}>
      {!embedded ? (
        <h2 className="text-xl font-bold text-[var(--rr-text)] md:text-2xl">{title}</h2>
      ) : null}

      <div
        aria-hidden
        className="absolute -left-[9999px] h-0 w-0 overflow-hidden"
      >
        <input
          tabIndex={-1}
          autoComplete="off"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
        />
      </div>

      <div className="space-y-4">
        {fields.map((f) => {
          const id = `rr-${f.name}`;
          if (f.kind === "checkbox") {
            return (
              <label
                key={f.name}
                htmlFor={id}
                className="flex cursor-pointer items-center gap-3 text-sm text-[var(--rr-text)]"
              >
                <input
                  id={id}
                  type="checkbox"
                  checked={Boolean(values[f.name])}
                  onChange={(e) => setValue(f.name, e.target.checked)}
                  className="size-4 accent-[var(--rr-primary)]"
                />
                {f.label}
              </label>
            );
          }
          if (f.kind === "textarea") {
            return (
              <div key={f.name}>
                <label htmlFor={id} className="mb-2 block text-sm font-medium text-[var(--rr-text)]">
                  {f.label}
                </label>
                <textarea
                  id={id}
                  required
                  rows={3}
                  maxLength={500}
                  placeholder={f.placeholder}
                  value={String(values[f.name] ?? "")}
                  onChange={(e) => setValue(f.name, e.target.value)}
                  className="robotrent-input min-h-[6rem] resize-y py-3"
                />
              </div>
            );
          }
          return (
            <div key={f.name}>
              <label htmlFor={id} className="mb-2 block text-sm font-medium text-[var(--rr-text)]">
                {f.label}
              </label>
              <input
                id={id}
                required
                type={f.kind}
                min={f.kind === "number" ? 1 : undefined}
                placeholder={f.placeholder}
                value={String(values[f.name] ?? "")}
                onChange={(e) => setValue(f.name, e.target.value)}
                className="robotrent-input"
              />
            </div>
          );
        })}
      </div>

      {error ? (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {error}
        </p>
      ) : null}

      <button type="submit" disabled={submitting} className="robotrent-btn-primary">
        {submitting ? <Loader2 className="mr-2 size-5 animate-spin" /> : null}
        {submitting ? "Yuborilmoqda…" : SUBMIT_LABELS[type]}
      </button>
    </form>
  );
}