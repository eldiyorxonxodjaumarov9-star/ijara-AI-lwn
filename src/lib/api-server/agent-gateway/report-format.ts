import { formatUzs } from "@/lib/payment-reminder-utils";
import type { DailySnapshot } from "@/lib/api-server/agent-gateway/daily-snapshot";
import { MONTHS_UZ_FULL } from "@/lib/analytics";

function monthLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  if (!y || !m) return ym;
  return `${MONTHS_UZ_FULL[m - 1] ?? m} ${y}`;
}

function pctLabel(percent: number | null): string {
  if (percent === null) return "foiz hisoblanmadi (oldingi qiymat 0)";
  const sign = percent > 0 ? "+" : "";
  const hundredths = Math.round(percent * 100) / 100;
  const tenths = Math.round(percent * 10) / 10;
  const text =
    Math.abs(hundredths - tenths) < 1e-9
      ? Number.isInteger(tenths)
        ? String(tenths)
        : tenths.toFixed(1)
      : hundredths.toFixed(2);
  return `${sign}${text}%`;
}

export function formatDailyManagerReportUz(
  snapshot: DailySnapshot,
  recommendations: string[] = []
): string {
  const cur = monthLabel(snapshot.comparison.currentMonth);
  const prev = monthLabel(snapshot.comparison.compareToMonth);
  const inc = snapshot.comparison.income;
  const exp = snapshot.comparison.expenses;

  const lines: string[] = [
    "🏢 IJARA AI — KUNLIK HISOBOT",
    `📅 ${snapshot.date}`,
    "",
    "💰 TO‘LOVLAR",
    `• Bugun to‘lashi kerak: ${snapshot.payments.dueTodayCount} ta`,
    `• Kechikkan to‘lovlar: ${snapshot.payments.overdueCount} ta`,
    `• Jami qarzdorlik: ${formatUzs(snapshot.payments.totalDebt)}`,
    "",
    "🏠 XONALAR",
    `• Band xonalar: ${snapshot.occupancy.occupied} ta`,
    `• Bo‘sh xonalar: ${snapshot.occupancy.vacant} ta`,
    "",
    "📊 OYLIK TAQQOSLASH",
    `• ${cur} kirimi ${prev}dagi ${formatUzs(inc.previous)} dan ${formatUzs(inc.current)} ga o‘zgardi.`,
    `• Farq: ${formatUzs(inc.difference)}. O‘zgarish: ${pctLabel(inc.percent)}.`,
    `• ${cur} chiqimi ${prev}dagi ${formatUzs(exp.previous)} dan ${formatUzs(exp.current)} ga o‘zgardi.`,
    `• Farq: ${formatUzs(exp.difference)}. O‘zgarish: ${pctLabel(exp.percent)}.`,
  ];

  if (snapshot.expenseHighlights.length > 0) {
    lines.push("", "⚡ XARAJATLAR");
    for (const h of snapshot.expenseHighlights.slice(0, 3)) {
      lines.push(
        `• ${h.label}: ${prev}dagi ${formatUzs(h.previous)} dan ${cur}da ${formatUzs(h.current)}.`
      );
      lines.push(
        `  Farq: ${formatUzs(h.difference)} yoki ${pctLabel(h.percent)}.`
      );
    }
  }

  const recs =
    recommendations.length > 0
      ? recommendations
      : buildDefaultRecommendations(snapshot);
  lines.push("", "🧠 AI TAVSIYASI");
  for (const r of recs.slice(0, 5)) {
    lines.push(`• ${r}`);
  }

  return lines.join("\n");
}

export function buildDefaultRecommendations(snapshot: DailySnapshot): string[] {
  const out: string[] = [];
  if (snapshot.payments.overdueCount > 0) {
    out.push(
      `${snapshot.payments.overdueCount} ta kechikkan to‘lov bo‘yicha mas’ul xodim bog‘lansin.`
    );
  }
  if (snapshot.occupancy.vacant > 0) {
    out.push(
      `${snapshot.occupancy.vacant} ta bo‘sh xona uchun e’lon/joylash faollashtirilsin.`
    );
  }
  const top = snapshot.expenseHighlights[0];
  if (top && top.difference > 0) {
    out.push(`${top.label} xarajatining oshish sababi tekshirilsin.`);
  }
  if (out.length === 0) {
    out.push("Bugungi ko‘rsatkichlar barqaror — muntazam monitoring davom ettirilsin.");
  }
  return out;
}
