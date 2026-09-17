"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Loader2, Lock, LogOut, Mail } from "lucide-react";
import { toast } from "sonner";

import { EmailOtpInput } from "@/components/auth/email-otp-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/auth-context";
import { ApiError } from "@/lib/api/client";
import {
  emailOtpSendSchema,
  loginSchema,
  type EmailOtpSendInput,
  type LoginInput,
} from "@/lib/validations";

const fieldClass =
  "border-white/10 bg-white/5 pl-9 text-slate-100 placeholder:text-slate-500 focus-visible:ring-sky-500/40";
const labelClass = "text-slate-300";

function apiMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    if (error.message) return error.message;
    if (error.status === 503) return "Email xizmati vaqtincha mavjud emas.";
    if (error.status === 429) return "Juda ko‘p urinish. Biroz kuting.";
    if (error.status === 401) return "Kod noto‘g‘ri yoki muddati tugagan.";
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

function LoginPageContent() {
  const router = useRouter();
  const {
    login,
    logout,
    sendEmailOtp,
    verifyEmailOtp,
    user,
    demoMode,
  } = useAuth();

  const [step, setStep] = useState<"email" | "otp" | "password">("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [resendSec, setResendSec] = useState(0);

  const emailForm = useForm<EmailOtpSendInput>({
    resolver: zodResolver(emailOtpSendSchema),
    defaultValues: { email: "" },
  });

  const passwordForm = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { identifier: "", password: "" },
  });

  useEffect(() => {
    if (resendSec <= 0) return;
    const t = window.setInterval(() => {
      setResendSec((s) => Math.max(0, s - 1));
    }, 1000);
    return () => window.clearInterval(t);
  }, [resendSec]);

  const onSendCode = async (values: EmailOtpSendInput) => {
    try {
      setSubmitting(true);
      const normalized = values.email.trim().toLowerCase();
      const result = await sendEmailOtp(normalized);
      setEmail(normalized);
      setOtp("");
      setStep("otp");
      setResendSec(result.retryAfterSec ?? 60);
      toast.success("Tasdiqlash kodi yuborildi");
    } catch (error) {
      toast.error(apiMessage(error, "Kod yuborishda xatolik"));
    } finally {
      setSubmitting(false);
    }
  };

  const onResend = useCallback(async () => {
    if (resendSec > 0 || !email) return;
    try {
      setSubmitting(true);
      const result = await sendEmailOtp(email);
      setResendSec(result.retryAfterSec ?? 60);
      toast.success("Kod qayta yuborildi");
    } catch (error) {
      toast.error(apiMessage(error, "Kod yuborishda xatolik"));
    } finally {
      setSubmitting(false);
    }
  }, [email, resendSec, sendEmailOtp]);

  const onVerifyOtp = async () => {
    if (otp.length !== 6) {
      toast.error("6 xonali kod kiriting");
      return;
    }
    try {
      setSubmitting(true);
      await verifyEmailOtp(email, otp);
      toast.success("Xush kelibsiz!");
      router.push("/dashboard");
    } catch (error) {
      toast.error(apiMessage(error, "Kod noto‘g‘ri yoki muddati tugagan."));
    } finally {
      setSubmitting(false);
    }
  };

  const onPasswordLogin = async (values: LoginInput) => {
    try {
      setSubmitting(true);
      await login(values.identifier ?? "", values.password);
      toast.success("Xush kelibsiz!");
      router.push("/dashboard");
    } catch (error) {
      toast.error(apiMessage(error, "Email yoki parol noto‘g‘ri"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="text-slate-100">
      {user && (
        <div className="mb-5 rounded-xl border border-sky-400/20 bg-sky-500/10 p-4 text-sm">
          <p className="font-medium text-sky-100">
            Siz allaqachon tizimdasiz: {user.displayName}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              className="bg-sky-500 text-white hover:bg-sky-400"
              onClick={() =>
                router.push(user.role === "tenant" ? "/portal" : "/dashboard")
              }
            >
              Davom etish
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="border-white/15 bg-white/5 text-slate-100 hover:bg-white/10"
              disabled={loggingOut}
              onClick={async () => {
                setLoggingOut(true);
                await logout();
                setLoggingOut(false);
                toast.success("Tizimdan chiqildi");
              }}
            >
              {loggingOut ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <LogOut className="size-4" />
              )}
              Chiqish
            </Button>
          </div>
        </div>
      )}

      {demoMode && step === "password" && (
        <div className="mb-5 rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-slate-400">
          <p className="font-medium text-slate-200">Demo kirish:</p>
          <p>Email: admin@arendahub.uz · Parol: 123456</p>
        </div>
      )}

      {step === "email" && (
        <>
          <div className="mb-6">
            <h1 className="text-2xl font-semibold tracking-tight text-white">
              Akkauntga kirish
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              Email manzilingizga tasdiqlash kodi yuboramiz
            </p>
          </div>

          <form
            onSubmit={emailForm.handleSubmit(onSendCode)}
            className="space-y-4"
          >
            <div className="space-y-1.5">
              <Label htmlFor="email" className={labelClass}>
                Email manzilingiz
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
                <Input
                  id="email"
                  type="email"
                  placeholder="example@gmail.com"
                  className={fieldClass}
                  autoComplete="email"
                  {...emailForm.register("email")}
                />
              </div>
              {emailForm.formState.errors.email && (
                <p className="text-xs text-rose-300">
                  {emailForm.formState.errors.email.message}
                </p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full bg-sky-500 text-white hover:bg-sky-400"
              disabled={submitting}
            >
              {submitting && <Loader2 className="size-4 animate-spin" />}
              Kodni olish
            </Button>
          </form>

          <p className="mt-4 text-center text-sm text-slate-400">
            <button
              type="button"
              className="text-sky-300 hover:text-sky-200 hover:underline"
              onClick={() => setStep("password")}
            >
              Parol bilan kirish
            </button>
          </p>
        </>
      )}

      {step === "otp" && (
        <>
          <button
            type="button"
            className="mb-4 inline-flex items-center gap-1 text-sm text-slate-400 hover:text-slate-200"
            onClick={() => {
              setStep("email");
              setOtp("");
            }}
          >
            <ArrowLeft className="size-4" />
            Orqaga
          </button>

          <div className="mb-6">
            <h1 className="text-2xl font-semibold tracking-tight text-white">
              Tasdiqlash kodi
            </h1>
            <p className="mt-2 text-sm text-slate-400">
              <span className="text-slate-200">{email}</span> manziliga
              yuborilgan 6 xonali kodni kiriting.
            </p>
          </div>

          <div className="space-y-6">
            <EmailOtpInput
              value={otp}
              onChange={setOtp}
              disabled={submitting}
              autoFocus
            />

            <Button
              type="button"
              className="w-full bg-sky-500 text-white hover:bg-sky-400"
              disabled={submitting || otp.length !== 6}
              onClick={onVerifyOtp}
            >
              {submitting && <Loader2 className="size-4 animate-spin" />}
              Tasdiqlash
            </Button>

            <p className="text-center text-sm text-slate-400">
              {resendSec > 0 ? (
                <>Kodni qayta yuborish — {resendSec} soniya</>
              ) : (
                <button
                  type="button"
                  className="text-sky-300 hover:text-sky-200 hover:underline disabled:opacity-50"
                  disabled={submitting}
                  onClick={onResend}
                >
                  Kodni qayta yuborish
                </button>
              )}
            </p>
          </div>
        </>
      )}

      {step === "password" && (
        <>
          <button
            type="button"
            className="mb-4 inline-flex items-center gap-1 text-sm text-slate-400 hover:text-slate-200"
            onClick={() => setStep("email")}
          >
            <ArrowLeft className="size-4" />
            Email OTP orqali kirish
          </button>

          <div className="mb-6">
            <h1 className="text-2xl font-semibold tracking-tight text-white">
              Parol bilan kirish
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              Mavjud hisob uchun email va parol
            </p>
          </div>

          <form
            onSubmit={passwordForm.handleSubmit(onPasswordLogin)}
            className="space-y-4"
          >
            <div className="space-y-1.5">
              <Label htmlFor="identifier" className={labelClass}>
                Email
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
                <Input
                  id="identifier"
                  type="email"
                  placeholder="siz@example.com"
                  className={fieldClass}
                  autoComplete="username"
                  {...passwordForm.register("identifier")}
                />
              </div>
              {passwordForm.formState.errors.identifier && (
                <p className="text-xs text-rose-300">
                  {passwordForm.formState.errors.identifier.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className={labelClass}>
                  Parol
                </Label>
                <Link
                  href="/forgot-password"
                  className="text-xs text-sky-300 hover:text-sky-200 hover:underline"
                >
                  Parolni unutdingizmi?
                </Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••"
                  className={fieldClass}
                  autoComplete="current-password"
                  {...passwordForm.register("password")}
                />
              </div>
              {passwordForm.formState.errors.password && (
                <p className="text-xs text-rose-300">
                  {passwordForm.formState.errors.password.message}
                </p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full bg-sky-500 text-white hover:bg-sky-400"
              disabled={submitting}
            >
              {submitting && <Loader2 className="size-4 animate-spin" />}
              Kirish
            </Button>
          </form>
        </>
      )}

      {step === "email" && (
        <p className="mt-6 text-center text-sm text-slate-400">
          Hisobingiz yo&apos;qmi?{" "}
          <Link
            href="/login"
            className="font-medium text-sky-300 hover:text-sky-200 hover:underline"
          >
            Email orqali ro&apos;yxatdan o&apos;ting
          </Link>
        </p>
      )}
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={<div className="text-sm text-slate-400">Yuklanmoqda...</div>}
    >
      <LoginPageContent />
    </Suspense>
  );
}
