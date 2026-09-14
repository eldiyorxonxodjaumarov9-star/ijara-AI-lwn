/**
 * Summani o‘zbek kirill yozuvida so‘z bilan.
 * Faqat butun so‘m (tiyin yo‘q).
 */

const ONES = [
  "",
  "бир",
  "икки",
  "уч",
  "тўрт",
  "беш",
  "олти",
  "етти",
  "саккиз",
  "тўққиз",
];
const TENS = [
  "",
  "ўн",
  "йигирма",
  "ўттиз",
  "қирқ",
  "эллик",
  "олтмиш",
  "етмиш",
  "саксон",
  "тўқсон",
];
const HUNDREDS = [
  "",
  "бир юз",
  "икки юз",
  "уч юз",
  "тўрт юз",
  "беш юз",
  "олти юз",
  "етти юз",
  "саккиз юз",
  "тўққиз юз",
];

function tripletToWords(n: number): string {
  const h = Math.floor(n / 100);
  const t = Math.floor((n % 100) / 10);
  const o = n % 10;
  const parts: string[] = [];
  if (h) parts.push(HUNDREDS[h]!);
  if (t) parts.push(TENS[t]!);
  if (o) parts.push(ONES[o]!);
  return parts.join(" ").trim();
}

/**
 * 0 → «нол»; 1_000_000 → «бир миллион»
 */
export function amountToUzCyrillicWords(amount: number): string {
  const n = Math.trunc(amount);
  if (!Number.isFinite(n) || n < 0) {
    throw new Error("Summa noto‘g‘ri");
  }
  if (n === 0) return "нол";

  const groups = [
    { value: 1_000_000_000, one: "миллиард", many: "миллиард" },
    { value: 1_000_000, one: "миллион", many: "миллион" },
    { value: 1_000, one: "минг", many: "минг" },
  ] as const;

  let rest = n;
  const parts: string[] = [];
  for (const g of groups) {
    const q = Math.floor(rest / g.value);
    if (q > 0) {
      parts.push(`${tripletToWords(q)} ${g.one}`);
      rest %= g.value;
    }
  }
  if (rest > 0) parts.push(tripletToWords(rest));
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

export function amountWithSomWords(amount: number): string {
  return `${amountToUzCyrillicWords(amount)} сўм`;
}
