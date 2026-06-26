/** Kiritilgan qiymatni to'g'ridan-to'g'ri so'm sifatida qaytaradi */
export function parseSumma(value: string): number | undefined {
  const cleaned = value.replace(/\s/g, "").replace(/,/g, "");
  if (!cleaned) return undefined;
  const n = Number(cleaned);
  if (Number.isNaN(n) || n <= 0) return undefined;
  return n;
}

/** Inputda ko'rinish uchun: minglik ajratuvchi bilan (1 000 000) */
export function formatSummaInput(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}
