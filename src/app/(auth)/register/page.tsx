"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/auth-context";
import { registerSchema, type RegisterInput } from "@/lib/validations";
import { zResolver } from "@/lib/form";
export default function RegisterPage() {
  const router = useRouter();
  const { register: registerUser } = useAuth();
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterInput>({
    resolver: zResolver<RegisterInput>(registerSchema),
    defaultValues: { displayName: "", email: "", password: "", confirmPassword: "" },
  });

  const onSubmit = async (values: RegisterInput) => {
    try {
      setSubmitting(true);
      await registerUser({
        displayName: values.displayName ?? values.fullName ?? "",
        email: values.email,
        password: values.password,
        company: values.company,
      });
      toast.success("Hisob yaratildi!");
      router.push("/dashboard");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Ro'yxatdan o'tishda xatolik"
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight text-white">
            Ro&apos;yxatdan o&apos;tish
          </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Yangi hisob yarating va platformadan foydalaning
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="displayName">To&apos;liq ism</Label>
          <Input id="displayName" placeholder="Ismingiz" {...register("displayName")} />
          {errors.displayName && (
            <p className="text-xs text-destructive">
              {errors.displayName.message}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="company">Kompaniya (ixtiyoriy)</Label>
          <Input id="company" placeholder="Kompaniya nomi" {...register("company")} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" placeholder="email" {...register("email")} />
          {errors.email && (
            <p className="text-xs text-destructive">{errors.email.message}</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="password">Parol</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••"
              {...register("password")}
            />
            {errors.password && (
              <p className="text-xs text-destructive">
                {errors.password.message}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirmPassword">Parolni tasdiqlang</Label>
            <Input
              id="confirmPassword"
              type="password"
              placeholder="••••••"
              {...register("confirmPassword")}
            />
            {errors.confirmPassword && (
              <p className="text-xs text-destructive">
                {errors.confirmPassword.message}
              </p>
            )}
          </div>
        </div>

        <Button
          type="submit"
          className="w-full bg-sky-500 text-white hover:bg-sky-400"
          disabled={submitting}
        >
          {submitting && <Loader2 className="size-4 animate-spin" />}
          Ro&apos;yxatdan o&apos;tish
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Hisobingiz bormi?{" "}
        <Link href="/login" className="font-medium text-sky-300 hover:underline">
          Kirish
        </Link>
      </p>
    </div>
  );
}
