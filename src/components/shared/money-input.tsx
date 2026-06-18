"use client";

import { useEffect, useState } from "react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { formatDigitsWithSpaces, parseDigits } from "@/lib/utils";

export function MoneyInput({
  value,
  onChange,
  placeholder = "0",
  className,
  id,
}: {
  value: number;
  onChange: (value: number) => void;
  placeholder?: string;
  className?: string;
  id?: string;
}) {
  const [display, setDisplay] = useState(() => formatDigitsWithSpaces(value));

  useEffect(() => {
    setDisplay(formatDigitsWithSpaces(value));
  }, [value]);

  return (
    <Input
      id={id}
      inputMode="numeric"
      placeholder={placeholder}
      className={cn(className)}
      value={display}
      onChange={(e) => {
        const raw = e.target.value.replace(/\D/g, "");
        setDisplay(formatDigitsWithSpaces(raw));
        onChange(parseDigits(raw));
      }}
    />
  );
}
