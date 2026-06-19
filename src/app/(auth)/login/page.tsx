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
import {
  loginSchema,
  tenantLoginSchema,
  type LoginInput,
  type TenantLoginInput,
} from "@/lib/validations";

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
      toast.error(
        error instanceof Error ? error.message : "Kirishda xatolik yuz berdi"
      );
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
      toast.error(
        error instanceof Error ? error.message : "Kirishda xatolik yuz berdi"
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Tizimga kirish</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Hisobingizga kiring va ishni davom ettiring
        </p>
      </div>

      {user && (
        <div className="mb-5 rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm">
          <p className="font-medium">
            Siz allaqachon tizimdasiz: {user.displayName}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Boshqa hisob bilan kirish uchun avval chiqing.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
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
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="owner">Arenda egasi</TabsTrigger>
          <TabsTrigger value="tenant">Ijarachi</TabsTrigger>
        </TabsList>

        {/* ===== Arenda egasi ===== */}
        <TabsContent value="owner">
          {demoMode && (
            <div className="mb-5 rounded-lg border bg-muted/50 p-3 text-xs text-muted-foreground">
              <p className="font-medium text-foreground">
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
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="siz@example.com"
                  className="pl-9"
                  {...ownerForm.register("email")}
                />
              </div>
              {ownerForm.formState.errors.email && (
                <p className="text-xs text-destructive">
                  {ownerForm.formState.errors.email.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Parol</Label>
                <Link
                  href="/forgot-password"
                  className="text-xs text-primary hover:underline"
                >
                  Parolni unutdingizmi?
                </Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••"
                  className="pl-9"
                  {...ownerForm.register("password")}
                />
              </div>
              {ownerForm.formState.errors.password && (
                <p className="text-xs text-destructive">
                  {ownerForm.formState.errors.password.message}
                </p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting && <Loader2 className="size-4 animate-spin" />}
              Kirish
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Hisobingiz yo&apos;qmi?{" "}
            <Link
              href="/register"
              className="font-medium text-primary hover:underline"
            >
              Ro&apos;yxatdan o&apos;tish
            </Link>
          </p>
        </TabsContent>

        {/* ===== Arenda turgan odam ===== */}
        <TabsContent value="tenant">
          <div className="mb-5 rounded-lg border bg-muted/50 p-3 text-xs text-muted-foreground">
            Arenda egasi bergan login va parol orqali kiring.
          </div>

          <form
            onSubmit={tenantForm.handleSubmit(onTenantSubmit)}
            className="space-y-4"
          >
            <div className="space-y-1.5">
              <Label htmlFor="tenantLogin">Login</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="tenantLogin"
                  placeholder="user901234567"
                  className="pl-9"
                  {...tenantForm.register("login")}
                />
              </div>
              {tenantForm.formState.errors.login && (
                <p className="text-xs text-destructive">
                  {tenantForm.formState.errors.login.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="tenantPassword">Parol</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="tenantPassword"
                  type="password"
                  placeholder="••••••"
                  className="pl-9"
                  {...tenantForm.register("password")}
                />
              </div>
              {tenantForm.formState.errors.password && (
                <p className="text-xs text-destructive">
                  {tenantForm.formState.errors.password.message}
                </p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={submitting}>
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
    <Suspense fallback={<div className="text-sm text-muted-foreground">Yuklanmoqda...</div>}>
      <LoginPageContent />
    </Suspense>
  );
}
