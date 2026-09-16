"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Lock, LogOut, Mail, User } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/context/auth-context";
import { ApiError } from "@/lib/api/client";
import {
  loginSchema,
  tenantLoginSchema,
  type LoginInput,
  type TenantLoginInput,
} from "@/lib/validations";
import { cn } from "@/lib/utils";

function loginErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === "INVALID_RESPONSE" || error.code === "INVALID_JSON") {
      return "Serverdan noto‘g‘ri javob olindi.";
    }
    if (error.code === "NETWORK" || error.status === 0) {
      return "Server bilan bog‘lanib bo‘lmadi. Qayta urinib ko‘ring.";
    }
    if (error.status === 401 || error.status === 403) {
      return "Email yoki parol noto‘g‘ri.";
    }
    if (error.status >= 500) {
      return "Kirish vaqtida server xatosi yuz berdi.";
    }
    return "Kirishda xatolik yuz berdi";
  }
  if (error instanceof Error && error.message) {
    if (/unexpected token|<!doctype|is not valid json/i.test(error.message)) {
      return "Serverdan noto‘g‘ri javob olindi.";
    }
    return "Kirishda xatolik yuz berdi";
  }
  return "Kirishda xatolik yuz berdi";
}

const fieldClass =
  "border-white/10 bg-white/5 pl-9 text-slate-100 placeholder:text-slate-500 focus-visible:ring-sky-500/40";
const labelClass = "text-slate-300";

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const defaultTab = searchParams.get("tab") === "tenant" ? "tenant" : "owner";
  const { login, loginTenant, logout, user, demoMode } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const ownerForm = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const tenantForm = useForm<TenantLoginInput>({
    resolver: zodResolver(tenantLoginSchema),
    defaultValues: { login: "", password: "" },
  });

  const onOwnerSubmit = async (values: LoginInput) => {
    try {
      setSubmitting(true);
      await login(values.email, values.password);
      toast.success("Xush kelibsiz!");
      router.push("/dashboard");
    } catch (error) {
      toast.error(loginErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const onTenantSubmit = async (values: TenantLoginInput) => {
    try {
      setSubmitting(true);
      await loginTenant(values.login, values.password);
      toast.success("Xush kelibsiz!");
      router.push("/portal");
    } catch (error) {
      toast.error(loginErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="text-slate-100">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-white">
          Tizimga kirish
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Hisobingizga kiring va ishni davom ettiring
        </p>
      </div>

      {user && (
        <div className="mb-5 rounded-xl border border-sky-400/20 bg-sky-500/10 p-4 text-sm">
          <p className="font-medium text-sky-100">
            Siz allaqachon tizimdasiz: {user.displayName}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Boshqa hisob bilan kirish uchun avval chiqing.
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

      <Tabs defaultValue={defaultTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 border border-white/10 bg-white/5 p-1">
          <TabsTrigger
            value="owner"
            className="data-[state=active]:bg-sky-500/20 data-[state=active]:text-sky-100"
          >
            Arenda egasi
          </TabsTrigger>
          <TabsTrigger
            value="tenant"
            className="data-[state=active]:bg-sky-500/20 data-[state=active]:text-sky-100"
          >
            Ijarachi
          </TabsTrigger>
        </TabsList>

        <TabsContent value="owner" className="mt-5">
          {demoMode && (
            <div className="mb-5 rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-slate-400">
              <p className="font-medium text-slate-200">
                Demo kirish ma&apos;lumotlari:
              </p>
              <p>Email: admin@arendahub.uz</p>
              <p>Parol: 123456</p>
            </div>
          )}

          <form
            onSubmit={ownerForm.handleSubmit(onOwnerSubmit)}
            className="space-y-4"
          >
            <div className="space-y-1.5">
              <Label htmlFor="email" className={labelClass}>
                Email
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
                <Input
                  id="email"
                  type="email"
                  placeholder="siz@example.com"
                  className={fieldClass}
                  autoComplete="email"
                  {...ownerForm.register("email")}
                />
              </div>
              {ownerForm.formState.errors.email && (
                <p className="text-xs text-rose-300">
                  {ownerForm.formState.errors.email.message}
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
                  {...ownerForm.register("password")}
                />
              </div>
              {ownerForm.formState.errors.password && (
                <p className="text-xs text-rose-300">
                  {ownerForm.formState.errors.password.message}
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

          <p className="mt-6 text-center text-sm text-slate-400">
            Hisobingiz yo&apos;qmi?{" "}
            <Link
              href="/register"
              className="font-medium text-sky-300 hover:text-sky-200 hover:underline"
            >
              Ro&apos;yxatdan o&apos;tish
            </Link>
          </p>
        </TabsContent>

        <TabsContent value="tenant" className="mt-5">
          <div className="mb-5 rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-slate-400">
            Arenda egasi bergan login va parol orqali kiring.
          </div>

          <form
            onSubmit={tenantForm.handleSubmit(onTenantSubmit)}
            className="space-y-4"
          >
            <div className="space-y-1.5">
              <Label htmlFor="tenantLogin" className={labelClass}>
                Login
              </Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
                <Input
                  id="tenantLogin"
                  placeholder="user901234567"
                  className={fieldClass}
                  autoComplete="username"
                  {...tenantForm.register("login")}
                />
              </div>
              {tenantForm.formState.errors.login && (
                <p className="text-xs text-rose-300">
                  {tenantForm.formState.errors.login.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="tenantPassword" className={labelClass}>
                Parol
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
                <Input
                  id="tenantPassword"
                  type="password"
                  placeholder="••••••"
                  className={fieldClass}
                  autoComplete="current-password"
                  {...tenantForm.register("password")}
                />
              </div>
              {tenantForm.formState.errors.password && (
                <p className="text-xs text-rose-300">
                  {tenantForm.formState.errors.password.message}
                </p>
              )}
            </div>

            <Button
              type="submit"
              className={cn(
                "w-full bg-sky-500 text-white hover:bg-sky-400"
              )}
              disabled={submitting}
            >
              {submitting && <Loader2 className="size-4 animate-spin" />}
              Kirish
            </Button>
          </form>
        </TabsContent>
      </Tabs>
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
