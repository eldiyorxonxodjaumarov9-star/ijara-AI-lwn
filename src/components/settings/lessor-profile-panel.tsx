"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch, isApiConfigured } from "@/lib/api/client";
import {
  LESSOR_FIELD_LABELS,
  LESSOR_FIELD_PLACEHOLDERS,
  LESSOR_FORM_SECTIONS,
  LESSOR_REQUIRED_FIELDS,
  type LessorField,
} from "@/lib/api-server/contract-draft/validation";

type LessorView = Record<LessorField, string> & { missing: string[] };

function emptyForm(): Record<LessorField, string> {
  return Object.fromEntries(
    LESSOR_REQUIRED_FIELDS.map((k) => [k, ""])
  ) as Record<LessorField, string>;
}

function cloneForm(src: Record<LessorField, string>): Record<LessorField, string> {
  return { ...src };
}

export function LessorProfilePanel() {
  const [form, setForm] = useState<Record<LessorField, string>>(emptyForm);
  const [savedSnapshot, setSavedSnapshot] =
    useState<Record<LessorField, string>>(emptyForm);
  const [missing, setMissing] = useState<string[]>([]);
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<LessorField, string>>
  >({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const dirty = useMemo(
    () => LESSOR_REQUIRED_FIELDS.some((k) => form[k] !== savedSnapshot[k]),
    [form, savedSnapshot]
  );

  useEffect(() => {
    if (!isApiConfigured) {
      setLoading(false);
      return;
    }
    void (async () => {
      try {
        const data = await apiFetch<LessorView>("/company/lessor-profile");
        const next = emptyForm();
        for (const k of LESSOR_REQUIRED_FIELDS) next[k] = data[k] ?? "";
        setForm(next);
        setSavedSnapshot(cloneForm(next));
        setMissing(data.missing ?? []);
        setFieldErrors({});
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Yuklab bo‘lmadi");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const save = async () => {
    const emptyHints: Partial<Record<LessorField, string>> = {};
    for (const k of LESSOR_REQUIRED_FIELDS) {
      if (!form[k].trim()) {
        emptyHints[k] = `${LESSOR_FIELD_LABELS[k]} hali to‘ldirilmagan`;
      }
    }
    setFieldErrors(emptyHints);

    setSaving(true);
    try {
      const body: Partial<Record<LessorField, string>> = {};
      for (const k of LESSOR_REQUIRED_FIELDS) body[k] = form[k];
      const data = await apiFetch<LessorView>("/company/lessor-profile", {
        method: "PUT",
        body,
      });
      const next = emptyForm();
      for (const k of LESSOR_REQUIRED_FIELDS) next[k] = data[k] ?? "";
      setForm(next);
      setSavedSnapshot(cloneForm(next));
      setMissing(data.missing ?? []);
      toast.success("Rekvizitlar saqlandi");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Saqlab bo‘lmadi");
    } finally {
      setSaving(false);
    }
  };

  const cancelEdits = () => {
    setForm(cloneForm(savedSnapshot));
    setFieldErrors({});
    toast.message("O‘zgarishlar bekor qilindi");
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
        Rekvizitlar yuklanmoqda...
      </div>
    );
  }

  return (
    <div id="shartnoma-rekvizitlari" className="scroll-mt-24 space-y-6">
      <div>
        <h3 className="text-base font-semibold tracking-tight sm:text-lg">
          Shartnomada ijaraga beruvchi rekvizitlari
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Ushbu ma’lumotlar shartnoma hujjatlariga avtomatik joylashtiriladi.
        </p>
      </div>

      {missing.length > 0 && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-100">
          Yetishmayotgan maydonlar: {missing.join(", ")}
        </div>
      )}

      {LESSOR_FORM_SECTIONS.map((section) => (
        <section key={section.id} className="space-y-3">
          <h4 className="text-sm font-semibold text-foreground">
            {section.title}
          </h4>
          <div className="grid gap-3 sm:grid-cols-2">
            {section.fields.map((k) => {
              const err = fieldErrors[k];
              return (
                <div
                  key={k}
                  className={
                    k === "lessorAddress" || k === "lessorBankName"
                      ? "space-y-1.5 sm:col-span-2"
                      : "space-y-1.5"
                  }
                >
                  <Label htmlFor={k}>
                    {LESSOR_FIELD_LABELS[k]}{" "}
                    <span className="text-destructive" aria-hidden>
                      *
                    </span>
                  </Label>
                  <Input
                    id={k}
                    name={k}
                    value={form[k]}
                    placeholder={LESSOR_FIELD_PLACEHOLDERS[k]}
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck={false}
                    aria-invalid={Boolean(err)}
                    aria-required
                    onChange={(e) => {
                      const value = e.target.value;
                      setForm((f) => ({ ...f, [k]: value }));
                      if (fieldErrors[k]) {
                        setFieldErrors((prev) => {
                          const next = { ...prev };
                          delete next[k];
                          return next;
                        });
                      }
                    }}
                  />
                  {err && (
                    <p className="text-xs text-destructive" role="alert">
                      {err}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ))}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="outline"
          disabled={saving || !dirty}
          onClick={cancelEdits}
        >
          O‘zgarishlarni bekor qilish
        </Button>
        <Button
          type="button"
          disabled={saving || !dirty}
          onClick={() => void save()}
        >
          {saving && <Loader2 className="size-4 animate-spin" />}
          Saqlash
        </Button>
      </div>
    </div>
  );
}
