"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown, Globe } from "lucide-react";

import { useLanguage } from "@/context/language-context";
import { useLandingT } from "@/hooks/use-landing-t";
import {
  LANDING_LANG_OPTIONS,
  type LandingLocale,
} from "@/lib/i18n/landing";
import { cn } from "@/lib/utils";
import type { Language } from "@/types";

type SwitcherTone = "dark" | "light";

export function LandingLanguageSwitcher({
  tone = "dark",
  className,
  align = "right",
}: {
  tone?: SwitcherTone;
  className?: string;
  align?: "left" | "right";
}) {
  const { language, setLanguage } = useLanguage();
  const t = useLandingT();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const activeCode: LandingLocale =
    language === "ru" || language === "en" ? language : "uz";
  const activeShort =
    LANDING_LANG_OPTIONS.find((o) => o.code === activeCode)?.short ?? "UZ";

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        return;
      }
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
      event.preventDefault();
      const buttons = rootRef.current?.querySelectorAll<HTMLButtonElement>(
        '[role="option"] button'
      );
      if (!buttons?.length) return;
      const list = Array.from(buttons);
      const index = list.indexOf(document.activeElement as HTMLButtonElement);
      const next =
        event.key === "ArrowDown"
          ? index < 0
            ? 0
            : (index + 1) % list.length
          : index <= 0
            ? list.length - 1
            : index - 1;
      list[next]?.focus();
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const select = (code: LandingLocale) => {
    setLanguage(code as Language);
    setOpen(false);
  };

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        className={cn(
          "inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none",
          tone === "dark"
            ? "text-slate-100 hover:bg-white/10 focus-visible:ring-blue-400"
            : "text-slate-700 hover:bg-slate-100 focus-visible:ring-blue-500"
        )}
        aria-label={t("lang.aria")}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((value) => !value)}
      >
        <Globe className="size-4 shrink-0 opacity-90" aria-hidden />
        <span>{activeShort}</span>
        <ChevronDown
          className={cn(
            "size-3.5 shrink-0 opacity-80 transition-transform duration-200",
            open && "rotate-180"
          )}
          aria-hidden
        />
      </button>

      <div
        id={listId}
        role="listbox"
        aria-label={t("lang.aria")}
        className={cn(
          "absolute top-[calc(100%+0.4rem)] z-[60] min-w-[11.5rem] overflow-hidden rounded-xl border shadow-xl transition-[opacity,transform] duration-200 origin-top",
          align === "right" ? "right-0" : "left-0",
          open
            ? "pointer-events-auto scale-100 opacity-100"
            : "pointer-events-none scale-95 opacity-0",
          tone === "dark"
            ? "border-white/10 bg-[#0b1f3b] text-white"
            : "border-slate-200 bg-white text-slate-900"
        )}
      >
        <ul className="py-1.5">
          {LANDING_LANG_OPTIONS.map((option) => {
            const selected = option.code === activeCode;
            return (
              <li key={option.code} role="option" aria-selected={selected}>
                <button
                  type="button"
                  className={cn(
                    "flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left text-sm transition-colors",
                    tone === "dark"
                      ? selected
                        ? "bg-white/10 text-white"
                        : "text-slate-200 hover:bg-white/5"
                      : selected
                        ? "bg-slate-100 text-slate-900"
                        : "text-slate-700 hover:bg-slate-50"
                  )}
                  onClick={() => select(option.code)}
                >
                  <span className="flex min-w-0 flex-col">
                    <span className="font-semibold tracking-wide">
                      {option.short}
                    </span>
                    <span
                      className={cn(
                        "truncate text-xs",
                        tone === "dark" ? "text-slate-400" : "text-slate-500"
                      )}
                    >
                      {t(option.labelKey)}
                    </span>
                  </span>
                  {selected ? (
                    <Check
                      className={cn(
                        "size-4 shrink-0",
                        tone === "dark" ? "text-cyan-300" : "text-blue-600"
                      )}
                      aria-hidden
                    />
                  ) : (
                    <span className="size-4 shrink-0" aria-hidden />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
