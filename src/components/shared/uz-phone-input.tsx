"use client";

import { Input } from "@/components/ui/input";
import {
  UZ_PHONE_PREFIX,
  caretAfterDigits,
  formatUzLocal,
  toUzCanonical,
  uzLocalDigits,
  uzLocalFromCanonical,
} from "@/lib/uz-phone";

/** "+998" prefiksli telefon maydoni; qiymat kanonik "+998901234567" ko'rinishida. */
export function UzPhoneInput({
  id,
  value,
  onChange,
  disabled,
}: {
  id?: string;
  value: string;
  onChange: (canonical: string) => void;
  disabled?: boolean;
}) {
  const display = formatUzLocal(uzLocalFromCanonical(value ?? ""));

  const commit = (el: HTMLInputElement, digits: string, digitsBeforeCaret: number) => {
    onChange(toUzCanonical(digits));
    const caret = caretAfterDigits(formatUzLocal(digits), Math.min(digitsBeforeCaret, digits.length));
    requestAnimationFrame(() => {
      if (document.activeElement === el) el.setSelectionRange(caret, caret);
    });
  };

  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
        {UZ_PHONE_PREFIX}
      </span>
      <Input
        id={id}
        type="tel"
        inputMode="numeric"
        autoComplete="tel-national"
        placeholder="90 123 45 67"
        className="pl-14"
        value={display}
        disabled={disabled}
        onChange={(e) => {
          const el = e.target;
          const before = el.value.slice(0, el.selectionStart ?? el.value.length).replace(/\D/g, "").length;
          commit(el, uzLocalDigits(el.value), before);
        }}
        onPaste={(e) => {
          e.preventDefault();
          const digits = uzLocalDigits(e.clipboardData.getData("text"), { pasted: true });
          commit(e.currentTarget, digits, digits.length);
        }}
      />
    </div>
  );
}
