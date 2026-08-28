"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, MessageSquare, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  formatPhoneDisplay,
  normalizePhoneDigits,
} from "@/lib/sms-notifications";
import type { SmsLinkedTenant } from "@/types/sms-notifications";

export function SmsComposeDialog({
  open,
  onOpenChange,
  linkedTenants,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  linkedTenants: SmsLinkedTenant[];
}) {
  const [message, setMessage] = useState("");
  const [recipientIds, setRecipientIds] = useState<Set<string>>(new Set());

  const eligible = useMemo(
    () => linkedTenants.filter((t) => t.smsEnabled),
    [linkedTenants]
  );

  useEffect(() => {
    if (!open) return;
    setMessage("");
    setRecipientIds(new Set(eligible.map((t) => t.tenantId)));
  }, [open, eligible]);

  const selected = useMemo(
    () => eligible.filter((t) => recipientIds.has(t.tenantId)),
    [eligible, recipientIds]
  );

  const duplicatePhones = useMemo(() => {
    const seen = new Map<string, string[]>();
    for (const t of selected) {
      const key = normalizePhoneDigits(t.phone);
      const list = seen.get(key) ?? [];
      list.push(t.fullName);
      seen.set(key, list);
    }
    return Array.from(seen.entries()).filter(([, names]) => names.length > 1);
  }, [selected]);

  const previewSample = selected[0];

  const toggleRecipient = (id: string) => {
    setRecipientIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Xabar tayyorlash</DialogTitle>
          <DialogDescription>
            SMS matnini tayyorlang. Yuborish Play Mobile ulangandan keyin
            ishlaydi.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label>Qabul qiluvchilar</Label>
              <Badge variant="secondary">{selected.length} ta</Badge>
            </div>
            {eligible.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                SMS yoqilgan biriktirilgan arendator yo&apos;q.
              </p>
            ) : (
              <ul className="max-h-40 space-y-2 overflow-y-auto rounded-lg border p-3">
                {eligible.map((t) => (
                  <li key={t.tenantId} className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      id={`sms-recipient-${t.tenantId}`}
                      className="mt-1 size-4 shrink-0 rounded border-input accent-primary"
                      checked={recipientIds.has(t.tenantId)}
                      onChange={() => toggleRecipient(t.tenantId)}
                    />
                    <label
                      htmlFor={`sms-recipient-${t.tenantId}`}
                      className="min-w-0 cursor-pointer text-sm"
                    >
                      <span className="font-medium">{t.fullName}</span>
                      <span className="block text-xs text-muted-foreground">
                        {formatPhoneDisplay(t.phone)} · {t.propertyLabel}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sms-message">Xabar matni</Label>
            <Textarea
              id="sms-message"
              placeholder="Arendatorga yuboriladigan matn..."
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              {message.trim().length} belgi
            </p>
          </div>

          {duplicatePhones.length > 0 && (
            <div
              role="alert"
              className="flex gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-200"
            >
              <AlertTriangle className="size-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Takroriy telefon raqamlar</p>
                <ul className="mt-1 list-inside list-disc text-xs">
                  {duplicatePhones.map(([phone, names]) => (
                    <li key={phone}>
                      {formatPhoneDisplay(phone)} — {names.join(", ")}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5">
              <MessageSquare className="size-4" /> Oldindan ko&apos;rinish
            </Label>
            <div className="rounded-lg border bg-muted/40 p-3 text-sm">
              {previewSample ? (
                <>
                  <p className="text-xs text-muted-foreground mb-1">
                    Namuna: {previewSample.fullName}
                  </p>
                  <p className="whitespace-pre-wrap">
                    {message.trim() || "Matn kiritilmagan…"}
                  </p>
                </>
              ) : (
                <p className="text-muted-foreground">
                  Qabul qiluvchi tanlang va matn yozing
                </p>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-col sm:items-stretch">
          <p className="text-center text-xs text-muted-foreground">
            Play Mobile API hali ulanmagan — SMS yuborilmaydi
          </p>
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Yopish
            </Button>
            <Button disabled title="Play Mobile API hali ulanmagan">
              <Send className="size-4" />
              SMS yuborish
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
