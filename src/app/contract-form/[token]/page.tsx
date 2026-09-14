"use client";

import { use, useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type FormView = {
  status: string;
  partyCategory: string;
  serviceName: string;
  areaSqm: number;
  ratePerSqm: number;
  monthCount: number;
  monthlyAmount: number;
  totalAmount: number;
  depositAmount: number;
  propertyTitle: string;
  propertyAddress: string;
  readOnly: boolean;
  contractNumber: string | null;
  clientSnapshot: Record<string, string> | null;
};

export default function ContractFormPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const [view, setView] = useState<FormView | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [preview, setPreview] = useState(false);
  const [done, setDone] = useState(false);
  const [fields, setFields] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/public/contract-form/${token}`);
      const json = (await res.json()) as {
        success?: boolean;
        data?: FormView;
        message?: string;
      };
      if (!res.ok || !json.success || !json.data) {
        throw new Error(json.message || "Havola yaroqsiz");
      }
      setView(json.data);
      if (json.data.readOnly || json.data.status === "CREATED") {
        setDone(true);
        if (json.data.clientSnapshot) {
          setFields(json.data.clientSnapshot);
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Xato");
      setView(null);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const isLegal = view?.partyCategory === "LEGAL_ENTITY";

  const submit = async () => {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/public/contract-form/${token}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": crypto.randomUUID(),
        },
        body: JSON.stringify(fields),
      });
      const json = (await res.json()) as {
        success?: boolean;
        message?: string;
        data?: { userMessage?: string };
      };
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Yuborib bo‘lmadi");
      }
      toast.success(json.data?.userMessage ?? "Yuborildi");
      setDone(true);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Xato");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!view) {
    return (
      <div className="mx-auto max-w-md p-6 text-center">
        <h1 className="text-xl font-semibold">Havola yaroqsiz</h1>
        <p className="mt-2 text-muted-foreground">
          Muddati tugagan yoki noto‘g‘ri havola.
        </p>
      </div>
    );
  }

  const individualFields = [
    ["fullName", "F.I.Sh."],
    ["passportOrId", "Pasport yoki ID"],
    ["jshshir", "JSHSHIR (14 raqam)"],
    ["address", "Manzil"],
    ["phone", "Telefon"],
  ] as const;

  const legalFields = [
    ["companyFullName", "Tashkilot to‘liq nomi"],
    ["legalForm", "Tashkiliy-huquqiy shakl"],
    ["directorFullName", "Direktor F.I.Sh."],
    ["authorityBasis", "Faoliyat asosi (ustav/ishonchnoma)"],
    ["legalAddress", "Yuridik manzil"],
    ["stir", "STIR (9 raqam)"],
    ["bankName", "Bank nomi"],
    ["mfo", "MFO (5 raqam)"],
    ["accountNumber", "Hisob raqami"],
    ["phone", "Telefon"],
  ] as const;

  const list = isLegal ? legalFields : individualFields;

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/40 px-4 py-8">
      <div className="mx-auto max-w-lg space-y-4">
        <div>
          <p className="text-sm text-muted-foreground">Arenda AI</p>
          <h1 className="text-2xl font-semibold tracking-tight">
            Shartnoma ma’lumotlari
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {view.propertyTitle} · {view.propertyAddress}
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ijara shartlari</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-1 text-sm">
            <p>Xizmat: {view.serviceName}</p>
            <p>
              Maydon: {view.areaSqm} m² · Tarif:{" "}
              {view.ratePerSqm.toLocaleString("uz-UZ")}
            </p>
            <p>
              Oylar: {view.monthCount} · Oylik:{" "}
              {view.monthlyAmount.toLocaleString("uz-UZ")} so‘m
            </p>
            <p>Jami: {view.totalAmount.toLocaleString("uz-UZ")} so‘m</p>
            <p>Depozit: {view.depositAmount.toLocaleString("uz-UZ")} so‘m</p>
            {view.contractNumber && <p>№ {view.contractNumber}</p>}
          </CardContent>
        </Card>

        {done || view.readOnly ? (
          <Card>
            <CardContent className="space-y-2 p-5 text-sm">
              <p className="font-medium text-green-700 dark:text-green-400">
                Shartnoma yaratildi
              </p>
              <p className="text-muted-foreground">
                Hujjat Telegram bot orqali yuboriladi. Forma qayta
                yuborilmaydi.
              </p>
              {list.map(([key, label]) => (
                <p key={key}>
                  <span className="text-muted-foreground">{label}: </span>
                  {fields[key] || "—"}
                </p>
              ))}
            </CardContent>
          </Card>
        ) : preview ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Tekshiruv</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {list.map(([key, label]) => (
                <p key={key}>
                  <span className="text-muted-foreground">{label}: </span>
                  {fields[key] || "—"}
                </p>
              ))}
              <div className="flex gap-2 pt-2">
                <Button variant="outline" onClick={() => setPreview(false)}>
                  Orqaga
                </Button>
                <Button onClick={() => void submit()} disabled={submitting}>
                  {submitting && <Loader2 className="size-4 animate-spin" />}
                  Tasdiqlash va yuborish
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="space-y-3 p-5">
              {list.map(([key, label]) => (
                <div key={key} className="space-y-1.5">
                  <Label>{label}</Label>
                  <Input
                    value={fields[key] ?? ""}
                    onChange={(e) =>
                      setFields((f) => ({ ...f, [key]: e.target.value }))
                    }
                    autoComplete="off"
                  />
                </div>
              ))}
              <Button className="w-full" onClick={() => setPreview(true)}>
                Ko‘rib chiqish
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
