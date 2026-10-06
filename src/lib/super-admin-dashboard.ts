import { RENTAL_INDUSTRIES, type RentalIndustry } from "@/lib/rental-industry";

export type DashboardPlan = "FREE" | "PRO" | "PREMIUM";

export const SUPER_ADMIN_INDUSTRY_LABELS: Record<RentalIndustry, string> = {
  OFFICE_RENTAL: "Ofis / biznes markazi",
  APARTMENT_RENTAL: "Kvartira / uy",
  HOTEL_HOSTEL: "Mehmonxona / hostel",
  CAR_RENTAL: "Avtomobil ijarasi",
  RETAIL_RENTAL: "Savdo joylari",
  WAREHOUSE_RENTAL: "Ombor",
  VILLA_RENTAL: "Dacha / villa",
  COMMERCIAL_RENTAL: "Tijorat ko‘chmas mulki",
  OTHER: "Boshqa",
};

export const SUPER_ADMIN_PLAN_LABELS: Record<DashboardPlan, string> = {
  FREE: "DEMO / FREE",
  PRO: "PRO",
  PREMIUM: "PREMIUM",
};

export const SUPER_ADMIN_INDUSTRIES = RENTAL_INDUSTRIES;

/** Shared by the desktop table headers and the mobile card labels. */
export const RECENT_REGISTRATION_COLUMNS = [
  { key: "name", label: "Ism" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Telefon" },
  { key: "business", label: "Biznes" },
  { key: "industry", label: "Industry" },
  { key: "plan", label: "Plan" },
  { key: "registeredAt", label: "Ro‘yxatdan o‘tgan vaqt" },
] as const;

export interface PlatformDashboardKpis {
  totalUsers: number;
  totalWorkspaces: number;
  todayRegistrations: number;
  last7DaysRegistrations: number;
  demoWorkspaces: number;
  proWorkspaces: number;
  premiumWorkspaces: number;
  activeWorkspaces: number;
}

export interface PlatformDashboardData {
  generatedAt: string;
  timezone: "Asia/Tashkent";
  kpis: PlatformDashboardKpis;
  planBreakdown: { plan: DashboardPlan; count: number }[];
  industryBreakdown: { industry: RentalIndustry; count: number }[];
  registrationTrend: { date: string; count: number }[];
  workspaceActivity: {
    workspacesCreatedToday: number;
    workspacesCreatedLast7Days: number;
    activeSubscriptions: number;
  };
  recentRegistrations: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    business: string | null;
    industry: RentalIndustry | null;
    plan: DashboardPlan | null;
    registeredAt: string;
  }[];
}

/** Uzbekistan has used a fixed UTC+5 offset with no DST since 1992. */
const TASHKENT_OFFSET_MS = 5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** UTC instant of 00:00 Asia/Tashkent on the day containing `date`. */
export function tashkentDayStart(date: Date): Date {
  const local = date.getTime() + TASHKENT_OFFSET_MS;
  return new Date(Math.floor(local / DAY_MS) * DAY_MS - TASHKENT_OFFSET_MS);
}

/** `YYYY-MM-DD` calendar date in Asia/Tashkent. */
export function tashkentDateKey(date: Date): string {
  return new Date(date.getTime() + TASHKENT_OFFSET_MS).toISOString().slice(0, 10);
}

/** The last `days` Tashkent calendar dates ending today, oldest first. */
export function tashkentLastDays(now: Date, days: number): string[] {
  const today = tashkentDayStart(now).getTime();
  return Array.from({ length: days }, (_, i) => tashkentDateKey(new Date(today - (days - 1 - i) * DAY_MS)));
}

/** `DD.MM.YYYY HH:mm` in Asia/Tashkent, identical on server and client. */
export function formatTashkentDateTime(iso: string): string {
  const shifted = new Date(new Date(iso).getTime() + TASHKENT_OFFSET_MS).toISOString();
  return `${shifted.slice(8, 10)}.${shifted.slice(5, 7)}.${shifted.slice(0, 4)} ${shifted.slice(11, 16)}`;
}

/** `DD.MM` label for a `YYYY-MM-DD` date key. */
export function formatDateKeyShort(key: string): string {
  return `${key.slice(8, 10)}.${key.slice(5, 7)}`;
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}
