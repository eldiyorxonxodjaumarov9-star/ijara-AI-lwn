/**
 * Hisobot davri semantikasi (SoT).
 *
 * - **RENTAL_PERFORMANCE** (`periodMonth` / `paymentBillingPeriod`):
 *   Ijarachilik oylik natijasi — majburiyat qaysi oyga tegishli.
 *   Kech to'lov (Avgust majburiyati, Sentabrda to'langan) Avgust hisobotida qoladi.
 *
 * - **CASH_FLOW** (`payment.date` / expense `date`):
 *   Pul harakati — qachon pul keldi yoki ketdi.
 *   Daromad/xarajat grafigi uchun ishlatiladi.
 */

import type { Payment } from "@/types";
import { paymentBillingPeriod } from "@/lib/debt-calculator";
import { getTashkentDateParts } from "@/lib/payment-due-schedule";

export const REPORT_PERIOD = {
  RENTAL_PERFORMANCE: "rental_performance",
  CASH_FLOW: "cash_flow",
} as const;

export type ReportPeriodKind =
  (typeof REPORT_PERIOD)[keyof typeof REPORT_PERIOD];

export const REPORT_PERIOD_LABELS: Record<ReportPeriodKind, string> = {
  rental_performance: "Hisobot oyi (periodMonth)",
  cash_flow: "To'lov sanasi (pul harakati)",
};

/** To'lov qaysi hisobot oyiga tegishli (periodMonth ustun). */
export function paymentReportPeriod(payment: Payment) {
  return paymentBillingPeriod(payment);
}

/** Pul qachon kelgan (cash-flow / grafik) — faqat payment.date. */
export function paymentCashFlowPeriod(payment: Payment) {
  const p = getTashkentDateParts(payment.date);
  return { year: p.year, month: p.month };
}
