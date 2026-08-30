/** «Qarzga» biriktirilganda — to'lov kiritilmaguncha qarzdorlar ro'yxatida */
export const OPEN_DEBT_MARKER = "[qarzga]";

export function contractHasOpenDebtMarker(notes?: string | null) {
  return (notes ?? "").includes(OPEN_DEBT_MARKER);
}

export function withOpenDebtMarker(notes?: string | null) {
  const base = (notes ?? "").replaceAll(OPEN_DEBT_MARKER, "").trim();
  return base ? `${base} ${OPEN_DEBT_MARKER}` : OPEN_DEBT_MARKER;
}

export function withoutOpenDebtMarker(notes?: string | null) {
  return (notes ?? "").replaceAll(OPEN_DEBT_MARKER, "").trim() || undefined;
}
