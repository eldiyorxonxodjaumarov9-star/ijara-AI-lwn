"use client";

import {
  useCallback,
  useEffect,
  useRef,
  type ClipboardEvent,
  type KeyboardEvent,
} from "react";

import { cn } from "@/lib/utils";

type EmailOtpInputProps = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
  className?: string;
};

const DIGITS = 6;

export function EmailOtpInput({
  value,
  onChange,
  disabled,
  autoFocus,
  className,
}: EmailOtpInputProps) {
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);
  const digits = value.padEnd(DIGITS, " ").slice(0, DIGITS).split("");

  const setDigitAt = useCallback(
    (index: number, char: string) => {
      const next = value.split("");
      while (next.length < DIGITS) next.push("");
      next[index] = char;
      onChange(next.join("").replace(/\s/g, "").slice(0, DIGITS));
    },
    [onChange, value]
  );

  const focusIndex = (index: number) => {
    const el = inputsRef.current[index];
    el?.focus();
    el?.select();
  };

  useEffect(() => {
    if (autoFocus) focusIndex(0);
  }, [autoFocus]);

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, DIGITS);
    if (!pasted) return;
    onChange(pasted);
    focusIndex(Math.min(pasted.length, DIGITS - 1));
  };

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !digits[index]?.trim() && index > 0) {
      focusIndex(index - 1);
    }
    if (e.key === "ArrowLeft" && index > 0) focusIndex(index - 1);
    if (e.key === "ArrowRight" && index < DIGITS - 1) focusIndex(index + 1);
  };

  const handleChange = (index: number, raw: string) => {
    const cleaned = raw.replace(/\D/g, "");
    if (!cleaned) {
      setDigitAt(index, "");
      return;
    }
    if (cleaned.length > 1) {
      onChange(cleaned.slice(0, DIGITS));
      focusIndex(Math.min(cleaned.length, DIGITS) - 1);
      return;
    }
    setDigitAt(index, cleaned);
    if (index < DIGITS - 1) focusIndex(index + 1);
  };

  return (
    <div className={cn("flex justify-center gap-2 sm:gap-3", className)}>
      {Array.from({ length: DIGITS }).map((_, index) => (
        <input
          key={index}
          ref={(el) => {
            inputsRef.current[index] = el;
          }}
          type="text"
          inputMode="numeric"
          autoComplete={index === 0 ? "one-time-code" : "off"}
          maxLength={1}
          disabled={disabled}
          value={digits[index]?.trim() ?? ""}
          onPaste={handlePaste}
          onKeyDown={(e) => handleKeyDown(index, e)}
          onChange={(e) => handleChange(index, e.target.value)}
          className={cn(
            "size-11 rounded-lg border border-white/15 bg-white/5 text-center text-lg font-semibold text-slate-100",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/50",
            disabled && "opacity-50"
          )}
          aria-label={`Tasdiqlash kodi ${index + 1}`}
        />
      ))}
    </div>
  );
}
