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
  if (robot && "robotModel" in values) values.robotModel = robot;
  return values;
}

export function RobotRentApplicationForm({
  type,
  robotSlug,
  embedded,
}: {
  type: RobotRentFormType;
  robotSlug?: string;
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

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = { type, formProfile, website };
      for (const f of fields) {
        const v = values[f.name];
        payload[f.name] =
          f.kind === "number"
            ? v === ""
              ? undefined
              : Number(v)
            : f.kind === "checkbox"
              ? Boolean(v)
              : v;
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
            ? "Juda ko‘p so‘rov. Keyinroq urinib ko‘ring."
            : "Ariza yuborilmadi. Maydonlarni tekshiring."
        );
        return;
      }
      setTrackingCode(json.data.trackingCode);
    } catch {
      setError("Server bilan bog‘lanib bo‘lmadi.");
    } finally {
      setSubmitting(false);
    }
  }

  if (trackingCode) {
    return (
      <div className="border border-[var(--rr-border)] bg-white px-6 py-8 text-center">
        <CheckCircle2 className="mx-auto size-10 text-[var(--rr-primary)]" />
        <h2 className="rr-serif mt-4 text-xl font-semibold">Ariza qabul qilindi</h2>
        <p className="mt-2 text-sm text-[var(--rr-muted)]">Tracking kod:</p>
        <p className="mx-auto mt-3 w-fit border border-[var(--rr-border)] bg-[var(--rr-bg)] px-4 py-2 font-mono text-sm font-semibold">
          {trackingCode}
        </p>
        <Link
          href={`/robotrent/track/${encodeURIComponent(trackingCode)}`}
          className="rr-btn mt-6 inline-flex"
        >
          Holatni ko‘rish
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {!embedded ? (
        <h2 className="rr-serif text-xl font-semibold lg:text-2xl">{title}</h2>
      ) : null}

      <div className="absolute -left-[9999px] h-0 w-0 overflow-hidden" aria-hidden>
        <input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
      </div>

      <div
        className={
          formProfile === "desktop"
            ? "grid grid-cols-1 gap-4 sm:grid-cols-2"
            : "space-y-4"
        }
      >
        {fields.map((f) => {
          const id = `rr-${f.name}`;
          const spanFull =
            f.kind === "textarea" || f.kind === "checkbox" ? "sm:col-span-2" : "";
          if (f.kind === "checkbox") {
            return (
              <label
                key={f.name}
                htmlFor={id}
                className={`flex items-center gap-3 text-sm ${spanFull}`}
              >
                <input
                  id={id}
                  type="checkbox"
                  checked={Boolean(values[f.name])}
                  onChange={(e) =>
                    setValues((p) => ({ ...p, [f.name]: e.target.checked }))
                  }
                />
                {f.label}
              </label>
            );
          }
          if (f.kind === "textarea") {
            return (
              <div key={f.name} className={spanFull}>
                <label htmlFor={id} className="mb-2 block text-sm font-medium">
                  {f.label}
                </label>
                <textarea
                  id={id}
                  required
                  rows={3}
                  className="rr-input min-h-[5.5rem] py-3"
                  value={String(values[f.name] ?? "")}
                  onChange={(e) =>
                    setValues((p) => ({ ...p, [f.name]: e.target.value }))
                  }
                />
              </div>
            );
          }
          return (
            <div key={f.name}>
              <label htmlFor={id} className="mb-2 block text-sm font-medium">
                {f.label}
              </label>
              <input
                id={id}
                required
                type={f.kind}
                className="rr-input"
                placeholder={f.placeholder}
                value={String(values[f.name] ?? "")}
                onChange={(e) =>
                  setValues((p) => ({ ...p, [f.name]: e.target.value }))
                }
              />
            </div>
          );
        })}
      </div>

      {error ? (
        <p role="alert" className="border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      <button type="submit" disabled={submitting} className="rr-btn w-full">
        {submitting ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
        {submitting ? "Yuborilmoqda…" : SUBMIT_LABELS[type]}
      </button>
    </form>
  );
}