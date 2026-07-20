export function parseClientNumber(value: string | null | undefined) {
  if (!value) return 0;
  const digits = value.replace(/\D/g, "");
  return digits ? Number(digits) : 0;
}

export function formatClientNumber(n: number) {
  return `K-${String(n).padStart(5, "0")}`;
}
