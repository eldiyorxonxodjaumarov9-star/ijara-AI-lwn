import type { WorkspaceSubscriptionView } from "@/types";

export type SubscriptionStatus = WorkspaceSubscriptionView["status"];

export function subscriptionStatusLabel(
  status: SubscriptionStatus
): string {
  switch (status) {
    case "DEMO":
      return "DEMO";
    case "ACTIVE":
      return "Faol";
    case "PAST_DUE":
      return "To'lov kutilmoqda";
    case "CANCELED":
      return "Bekor";
    default:
      return status;
  }
}

export function subscriptionBadgeClassName(
  status: SubscriptionStatus
): string {
  switch (status) {
    case "DEMO":
      return "border-amber-400/25 bg-amber-500/10 text-amber-200";
    case "ACTIVE":
      return "border-emerald-400/25 bg-emerald-500/10 text-emerald-200";
    case "PAST_DUE":
      return "border-orange-400/25 bg-orange-500/10 text-orange-200";
    case "CANCELED":
      return "border-slate-400/25 bg-slate-500/10 text-slate-300";
    default:
      return "border-white/10 bg-white/5 text-slate-300";
  }
}

export function formatSubscriptionDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("uz-UZ", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}
