export const UZ_PHONE_PREFIX = "+998";
export const UZ_LOCAL_DIGITS = 9;
export const UZ_PHONE_PATTERN = /^\+998\d{9}$/;

/**
 * Local 9 digits from any typed/pasted text. A leading 998 country code is
 * stripped for pastes with extra digits, and for typed text only when the full
 * international number is present, so a local number that starts with 998
 * still types normally.
 */
export function uzLocalDigits(raw: string, opts: { pasted?: boolean } = {}): string {
  let digits = raw.replace(/\D/g, "");
  const minWithCode = opts.pasted ? UZ_LOCAL_DIGITS + 1 : UZ_LOCAL_DIGITS + 3;
  if (digits.startsWith("998") && digits.length >= minWithCode) digits = digits.slice(3);
  return digits.slice(0, UZ_LOCAL_DIGITS);
}

/** "901234567" → "90 123 45 67" (partial input is grouped as far as it goes). */
export function formatUzLocal(digits: string): string {
  const d = digits.slice(0, UZ_LOCAL_DIGITS);
  return [d.slice(0, 2), d.slice(2, 5), d.slice(5, 7), d.slice(7, 9)].filter(Boolean).join(" ");
}

export function toUzCanonical(digits: string): string {
  return digits ? `${UZ_PHONE_PREFIX}${digits}` : "";
}

export function uzLocalFromCanonical(value: string): string {
  return value.startsWith(UZ_PHONE_PREFIX) ? value.slice(UZ_PHONE_PREFIX.length) : uzLocalDigits(value);
}

/** Caret index in `formatted` right after the `digitCount`-th digit. */
export function caretAfterDigits(formatted: string, digitCount: number): number {
  if (digitCount <= 0) return 0;
  let seen = 0;
  for (let i = 0; i < formatted.length; i++) {
    if (/\d/.test(formatted[i]) && ++seen === digitCount) return i + 1;
  }
  return formatted.length;
}
