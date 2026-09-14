/**
 * Butun so‘m hisobi — floating point yo‘q.
 */

export function computeMonthlyAmount(areaSqm: number, ratePerSqm: number): number {
  const area = Math.trunc(areaSqm);
  const rate = Math.trunc(ratePerSqm);
  if (!Number.isFinite(area) || !Number.isFinite(rate) || area < 0 || rate < 0) {
    throw new Error("Maydon yoki tarif noto‘g‘ri");
  }
  return area * rate;
}

export function computeTotalAmount(monthlyAmount: number, monthCount: number): number {
  const monthly = Math.trunc(monthlyAmount);
  const months = Math.trunc(monthCount);
  if (!Number.isFinite(monthly) || !Number.isFinite(months) || monthly < 0 || months < 1) {
    throw new Error("Oylik summa yoki oylar soni noto‘g‘ri");
  }
  return monthly * months;
}

export function formatSomGrouped(amount: number): string {
  const n = Math.trunc(amount);
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}
