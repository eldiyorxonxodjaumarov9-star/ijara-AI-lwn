export const DEBT_WRITE_OFF_REASON_CHECKOUT = "TENANT_CHECKOUT";

/** Contract include: faqat write-off summalari (to'lov emas). */
export const WRITE_OFF_AMOUNTS = {
  where: { type: "WRITE_OFF" as const },
  select: { amount: true },
};

/** `debtAdjustments` ro'yxatini `writtenOffAmount` jamiga aylantiradi. */
export function withWrittenOff<T extends { debtAdjustments?: { amount: number }[] }>(
  row: T
): Omit<T, "debtAdjustments"> & { writtenOffAmount: number } {
  const { debtAdjustments, ...rest } = row;
  return {
    ...rest,
    writtenOffAmount: (debtAdjustments ?? []).reduce((sum, a) => sum + a.amount, 0),
  };
}
