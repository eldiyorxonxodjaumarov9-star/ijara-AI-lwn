"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch, isApiConfigured } from "@/lib/api/client";
import {
  LESSOR_FIELD_LABELS,
  LESSOR_REQUIRED_FIELDS,
  type LessorField,
} from "@/lib/api-server/contract-draft/validation";

type LessorView = Record<LessorField, string> & { missing: string[] };

export function LessorProfilePanel() {
  const [form, setForm] = useState<Partial<Record<LessorField, string>>>({});
  const [missing, setMissing] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isApiConfigured) return;
    void (async () => {
      try {
        const data = await apiFetch<LessorView>("/company/lessor-profile");
        const next: Partial<Record<LessorField, string>> = {};
        for (const k of LESSOR_REQUIRED_FIELDS) next[k] = data[k] ?? "";
        setForm(next);
        setMissing(data.missing ?? []);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Yuklab bo‘lmadi");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const data = await apiFetch<LessorView>("/company/lessor-profile", {
        method: "PUT",
        body: form,
      });
      setMissing(data.missing ?? []);
      toast.success("Lessor rekvizitlari saqlandi");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Saqlab bo‘lmadi");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <Loader2 className="size-5 animate-spin text-muted-foreground" />;
  }

  return (
    <div className="space-y-4">
      {missing.length > 0 && (
        <p className="text-sm text-amber-700 dark:text-amber-300">
          Yetishmayotgan: {missing.join(", ")}
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        {LESSOR_REQUIRED_FIELDS.map((k) => (
          <div key={k} className="space-y-1.5">
            <Label>{LESSOR_FIELD_LABELS[k]}</Label>
            <Input
              value={form[k] ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))}
              autoComplete="off"
            />
          </div>
        ))}
      </div>
      <Button onClick={() => void save()} disabled={saving}>
        {saving && <Loader2 className="size-4 animate-spin" />}
        Saqlash
      </Button>
    </div>
  );
}
