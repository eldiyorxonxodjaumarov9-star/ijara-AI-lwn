"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Building2, Loader2, Lock, Mail, Phone, User } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/auth-context";
import { ApiError } from "@/lib/api/client";
import {
  RENTAL_INDUSTRIES,
  RENTAL_INDUSTRY_LABELS,
  type RentalIndustry,
} from "@/lib/rental-industry";
import { registerSchema, type RegisterInput } from "@/lib/validations";

const detailsSchema = registerSchema.omit({ industry: true });
type DetailsInput = Omit<RegisterInput, "industry">;

const fieldClass =
  "border-white/10 bg-white/5 pl-9 text-slate-100 placeholder:text-slate-500 focus-visible:ring-sky-500/40";
const labelClass = "text-slate-300";

function apiMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError && error.message) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

export default function RegisterPage() {
  const router = useRouter();
  const { register: registerAccount } = useAuth();
  const [step, setStep] = useState<"details" | "industry">("details");
  const [industry, setIndustry] = useState<RentalIndustry | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<DetailsInput>({
    resolver: zodResolver(detailsSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      phone: "",
      email: "",
      password: "",
      company: "",
    },
  });

  const onContinue = form.handleSubmit(() => {
    setStep("industry");
  });

  const onSubmit = async () => {
    const values = form.getValues();
    const parsed = registerSchema.safeParse({ ...values, industry });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Ma'lumotlar noto'g'ri");
      if (!industry) setStep("industry");
      return;
    }

    try {
      setSubmitting(true);
      await registerAccount(parsed.data);
      toast.success("Hisob yaratildi");
      router.push("/dashboard");
    } catch (error) {
      toast.error(apiMessage(error, "Ro'yxatdan o'tishda xatolik"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="text-slate-100">
      {step === "details" ? (
        <>
          <div className="mb-6">
            <p className="text-xs font-medium uppercase tracking-wide text-sky-300">
              1 / 2
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white">
              Ro&apos;yxatdan o&apos;tish
            </h1>
            <p className="mt-2 text-sm text-slate-400">
              Hisob va biznes ma&apos;lumotlarini kiriting. Yangi workspace demo
              rejimda ochiladi.
            </p>
          </div>

          <form onSubmit={onContinue} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field
                id="firstName"
                label="Ism"
                icon={<User className="size-4" />}
                error={form.formState.errors.firstName?.message}
                input={
                  <Input
                    id="firstName"
                    autoComplete="given-name"
                    placeholder="Ali"
                    className={fieldClass}
                    {...form.register("firstName")}
                  />
                }
              />
              <Field
                id="lastName"
                label="Familiya"
                icon={<User className="size-4" />}
                error={form.formState.errors.lastName?.message}
                input={
                  <Input
                    id="lastName"
                    autoComplete="family-name"
                    placeholder="Karimov"
                    className={fieldClass}
                    {...form.register("lastName")}
                  />
                }
              />
            </div>

            <Field
              id="phone"
              label="Telefon"
              icon={<Phone className="size-4" />}
              error={form.formState.errors.phone?.message}
              input={
                <Input
                  id="phone"
                  type="tel"
                  autoComplete="tel"
                  placeholder="+998 90 123 45 67"
                  className={fieldClass}
                  {...form.register("phone")}
                />
              }
            />

            <Field
              id="email"
              label="Email"
              icon={<Mail className="size-4" />}
              error={form.formState.errors.email?.message}
              input={
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="siz@example.com"
                  className={fieldClass}
                  {...form.register("email")}
                />
              }
            />

            <Field
              id="password"
              label="Parol"
              icon={<Lock className="size-4" />}
              error={form.formState.errors.password?.message}
              input={
                <Input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Kamida 6 ta belgi"
                  className={fieldClass}
                  {...form.register("password")}
                />
              }
            />

            <Field
              id="company"
              label="Biznes nomi"
              icon={<Building2 className="size-4" />}
              error={form.formState.errors.company?.message}
              input={
                <Input
                  id="company"
                  autoComplete="organization"
                  placeholder="Karimov Biznes Markazi"
                  className={fieldClass}
                  {...form.register("company")}
                />
              }
            />

            <Button
              type="submit"
              className="w-full bg-sky-500 text-white hover:bg-sky-400"
            >
              Davom etish
            </Button>
          </form>
        </>
      ) : (
        <>
          <button
            type="button"
            className="mb-4 text-sm text-slate-400 hover:text-slate-200"
            onClick={() => setStep("details")}
          >
            Orqaga
          </button>
          <div className="mb-5">
            <p className="text-xs font-medium uppercase tracking-wide text-sky-300">
              2 / 2
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white">
              Siz qaysi ijara biznesini boshqarasiz?
            </h1>
            <p className="mt-2 text-sm text-slate-400">
              Tanlangan soha workspace bilan birga saqlanadi.
            </p>
          </div>

          <fieldset className="min-w-0">
            <legend className="sr-only">Ijara sohasi</legend>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {RENTAL_INDUSTRIES.map((value) => {
                const selected = industry === value;
                return (
                  <label
                    key={value}
                    className={`flex cursor-pointer items-start gap-2 rounded-xl border px-3 py-3 text-sm transition ${
                      selected
                        ? "border-sky-400 bg-sky-500/15 text-white ring-1 ring-sky-400"
                        : "border-white/10 bg-white/5 text-slate-200 hover:border-white/20 hover:bg-white/10"
                    }`}
                  >
                    <input
                      type="radio"
                      name="industry"
                      value={value}
                      checked={selected}
                      onChange={() => setIndustry(value)}
                      className="mt-0.5 accent-sky-400"
                    />
                    <span>
                      <span className="block font-medium leading-snug">
                        {RENTAL_INDUSTRY_LABELS[value]}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          <Button
            type="button"
            className="mt-5 w-full bg-sky-500 text-white hover:bg-sky-400"
            disabled={submitting || !industry}
            onClick={onSubmit}
          >
            {submitting && <Loader2 className="size-4 animate-spin" />}
            Ro&apos;yxatdan o&apos;tish
          </Button>
        </>
      )}

      <p className="mt-6 text-center text-sm text-slate-400">
        Hisobingiz bormi?{" "}
        <Link
          href="/login"
          className="font-medium text-sky-300 hover:text-sky-200 hover:underline"
        >
          Kirish
        </Link>
      </p>
    </div>
  );
}

function Field({
  id,
  label,
  icon,
  error,
  input,
}: {
  id: string;
  label: string;
  icon: ReactNode;
  error?: string;
  input: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className={labelClass}>
        {label}
      </Label>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
          {icon}
        </span>
        {input}
      </div>
      {error && <p className="text-xs text-rose-300">{error}</p>}
    </div>
  );
}
