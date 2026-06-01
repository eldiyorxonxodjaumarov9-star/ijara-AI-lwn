"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, CheckCircle2, Loader2, Mail } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/auth-context";
import {
  forgotPasswordSchema,
} from "@/lib/validations";
import type { z } from "zod";

type ForgotInput = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPasswordPage() {
  const { resetPassword } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotInput>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  const onSubmit = async (values: ForgotInput) => {
    try {
      setSubmitting(true);
      await resetPassword(values.email);
      setSent(true);
      toast.success("Tiklash bo'yicha ko'rsatma yuborildi");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Xatolik yuz berdi"
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (sent) {
    return (
      <div className="text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary/10">
          <CheckCircle2 className="size-7 text-primary" />
        </div>
        <h1 className="mt-4 text-2xl font-bold">Tekshiring</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Parolni tiklash bo&apos;yicha ko&apos;rsatma emailingizga yuborildi.
        </p>
        <Button asChild variant="outline" className="mt-6">
          <Link href="/login">
            <ArrowLeft className="size-4" /> Kirishga qaytish
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Parolni tiklash</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Emailingizni kiriting, biz tiklash havolasini yuboramiz
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="email"
              type="email"
              placeholder="siz@example.com"
              className="pl-9"
              {...register("email")}
            />
          </div>
          {errors.email && (
            <p className="text-xs text-destructive">{errors.email.message}</p>
          )}
        </div>

        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting && <Loader2 className="size-4 animate-spin" />}
          Havolani yuborish
        </Button>
      </form>

      <Button asChild variant="ghost" className="mt-4 w-full">
        <Link href="/login">
          <ArrowLeft className="size-4" /> Kirishga qaytish
        </Link>
      </Button>
    </div>
  );
}
