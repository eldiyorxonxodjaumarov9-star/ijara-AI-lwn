"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2, Lock, Mail, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const fieldClass =
  "border-white/10 bg-white/5 pl-9 text-slate-100 placeholder:text-slate-500 focus-visible:ring-sky-500/40";

export function PlatformAdminLoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!email.trim() || !password) {
      setError("Email va parolni kiriting");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/super-admin/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: string } | null;
        setError(body?.message ?? "Email yoki parol noto‘g‘ri");
        return;
      }
      setPassword("");
      router.replace("/super-admin");
      router.refresh();
    } catch {
      setError("Tarmoq xatosi. Qayta urinib ko‘ring.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <div className="space-y-2">
        <span className="inline-flex size-10 items-center justify-center rounded-xl bg-sky-500/15 text-sky-300">
          <ShieldCheck className="size-5" aria-hidden />
        </span>
        <h1 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">Ijara AI Platform Admin</h1>
        <p className="text-sm text-slate-400">Platformani boshqarish uchun tizimga kiring</p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="admin-email" className="text-slate-300">
          Email
        </Label>
        <div className="relative">
          <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" aria-hidden />
          <Input
            id="admin-email"
            type="email"
            autoComplete="username"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={fieldClass}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="admin-password" className="text-slate-300">
          Parol
        </Label>
        <div className="relative">
          <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" aria-hidden />
          <Input
            id="admin-password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={`${fieldClass} pr-10`}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Parolni yashirish" : "Parolni ko‘rsatish"}
            aria-controls="admin-password"
            aria-pressed={showPassword}
            className="absolute right-2 top-1/2 inline-flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/40"
          >
            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
      </div>

      {error && (
        <p role="alert" className="text-sm text-rose-300">
          {error}
        </p>
      )}

      <Button type="submit" disabled={loading} className="w-full bg-sky-500 text-white hover:bg-sky-400">
        {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
        Kirish
      </Button>
    </form>
  );
}
