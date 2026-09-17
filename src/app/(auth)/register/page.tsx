"use client";

import Link from "next/link";
import { Mail } from "lucide-react";

export default function RegisterPage() {
  return (
    <div className="text-slate-100">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-white">
          Ro&apos;yxatdan o&apos;tish
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          Yangi hisob yaratish uchun email manzilingizga tasdiqlash kodi
          yuboriladi. Parol talab qilinmaydi.
        </p>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 p-5 text-sm text-slate-300">
        <div className="flex items-start gap-3">
          <Mail className="mt-0.5 size-5 shrink-0 text-sky-400" />
          <div>
            <p className="font-medium text-slate-100">Email OTP orqali kirish</p>
            <p className="mt-1 text-slate-400">
              Kirish sahifasida emailingizni kiriting, kodni tasdiqlang — sizga
              avtomatik demo workspace ochiladi.
            </p>
          </div>
        </div>
      </div>

      <Link
        href="/login"
        className="mt-6 inline-flex w-full items-center justify-center rounded-lg bg-sky-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-sky-400"
      >
        Kirish sahifasiga o&apos;tish
      </Link>

      <p className="mt-6 text-center text-sm text-slate-400">
        Hisobingiz bormi?{" "}
        <Link
          href="/login"
          className="font-medium text-sky-300 hover:underline"
        >
          Kirish
        </Link>
      </p>
    </div>
  );
}
