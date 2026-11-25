"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, Loader2, Upload, X } from "lucide-react";
import { toast } from "sonner";

type RatingOpt = { key: string; value: number; emoji: string; label: string };

type PublicView = {
  name: string;
  locationLabel: string | null;
  brandName: string;
  ratings: RatingOpt[];
};

export default function PublicFeedbackPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const [view, setView] = useState<PublicView | null>(null);
  const [loading, setLoading] = useState(true);
  const [rating, setRating] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [idempotencyKey] = useState(() =>
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `idemp-${Math.random().toString(36).slice(2)}`
  );
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/public/feedback/${token}`);
      const json = (await res.json()) as {
        success?: boolean;
        data?: PublicView;
        message?: string;
      };
      if (!res.ok || !json.success || !json.data) {
        throw new Error(json.message || "QR topilmadi");
      }
      setView(json.data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Xato");
      setView(null);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    const t = setTimeout(() => void load(), 0);
    return () => clearTimeout(t);
  }, [load]);

  useEffect(() => {
    const urls = files.map((f) => URL.createObjectURL(f));
    const t = setTimeout(() => setPreviews(urls), 0);
    return () => {
      clearTimeout(t);
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [files]);

  function onPickFiles(list: FileList | null) {
    if (!list) return;
    const next = [...files];
    for (const file of Array.from(list)) {
      if (next.length >= 3) break;
      if (!["image/jpeg", "image/jpg", "image/png", "image/webp"].includes(file.type)) {
        toast.error("Faqat JPEG, PNG yoki WebP");
        continue;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error("Rasm 5MB dan oshmasin");
        continue;
      }
      next.push(file);
    }
    setFiles(next.slice(0, 3));
  }

  async function submit() {
    if (!rating) {
      toast.error("Baholashni tanlang");
      return;
    }
    setSubmitting(true);
    try {
      const form = new FormData();
      form.set("rating", String(rating));
      form.set("comment", comment);
      form.set("idempotencyKey", idempotencyKey);
      for (const f of files) form.append("photos", f);
      const res = await fetch(`/api/public/feedback/${token}`, {
        method: "POST",
        body: form,
      });
      const json = (await res.json()) as { success?: boolean; message?: string };
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Yuborilmadi");
      }
      setDone(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Xato");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-[#f4f7fb] px-4">
        <Loader2 className="h-7 w-7 animate-spin text-slate-500" />
      </main>
    );
  }

  if (!view) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-[#f4f7fb] px-4">
        <p className="text-center text-sm text-slate-600">
          Bu QR kod topilmadi yoki faol emas.
        </p>
      </main>
    );
  }

  if (done) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-[#f4f7fb] px-4">
        <div className="w-full max-w-sm rounded-3xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
          <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
          <h1 className="mt-4 text-xl font-semibold text-slate-900">
            Rahmat!
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Fikringiz qabul qilindi. Tozalikni yaxshilashda yordamingiz uchun
            minnatdormiz.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-[#f4f7fb] px-4 py-8">
      <div className="mx-auto w-full max-w-sm">
        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">
            {view.brandName}
          </p>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">
            Tozalikni baholang
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            {view.locationLabel || view.name}
          </p>

          <div className="mt-6 grid grid-cols-5 gap-2">
            {view.ratings
              .slice()
              .sort((a, b) => a.value - b.value)
              .map((r) => {
                const selected = rating === r.value;
                return (
                  <button
                    key={r.key}
                    type="button"
                    onClick={() => setRating(r.value)}
                    className={`flex flex-col items-center rounded-2xl border px-1 py-3 transition ${
                      selected
                        ? "border-sky-500 bg-sky-50 shadow-sm"
                        : "border-slate-200 bg-slate-50 hover:bg-white"
                    }`}
                    aria-label={r.label}
                  >
                    <span className="text-2xl leading-none">{r.emoji}</span>
                    <span className="mt-1 text-[10px] text-slate-500">
                      {r.value}
                    </span>
                  </button>
                );
              })}
          </div>
          {rating ? (
            <p className="mt-2 text-center text-sm font-medium text-slate-700">
              {view.ratings.find((r) => r.value === rating)?.label}
            </p>
          ) : null}

          <label className="mt-6 block text-sm font-medium text-slate-700">
            Izoh (ixtiyoriy)
            <textarea
              className="mt-2 min-h-[96px] w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none ring-sky-500 focus:bg-white focus:ring-2"
              placeholder="Nimani yaxshilash mumkin?"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              maxLength={2000}
            />
          </label>

          <div className="mt-4">
            <p className="text-sm font-medium text-slate-700">
              Foto (ixtiyoriy, max 3)
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Yuklangan rasmlar xodimlar Telegram guruhiga yuborilishi mumkin.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {previews.map((src, i) => (
                <div key={src} className="relative h-16 w-16 overflow-hidden rounded-xl">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt="" className="h-full w-full object-cover" />
                  <button
                    type="button"
                    className="absolute right-0.5 top-0.5 rounded-full bg-black/60 p-0.5 text-white"
                    onClick={() =>
                      setFiles((prev) => prev.filter((_, idx) => idx !== i))
                    }
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              {files.length < 3 ? (
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className="flex h-16 w-16 items-center justify-center rounded-xl border border-dashed border-slate-300 text-slate-500"
                >
                  <Upload className="h-5 w-5" />
                </button>
              ) : null}
            </div>
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className="hidden"
              onChange={(e) => onPickFiles(e.target.files)}
            />
          </div>

          <button
            type="button"
            disabled={submitting || !rating}
            onClick={() => void submit()}
            className="mt-6 flex w-full items-center justify-center rounded-2xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:opacity-50"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Fikrni yuborish"
            )}
          </button>
        </div>
      </div>
    </main>
  );
}
