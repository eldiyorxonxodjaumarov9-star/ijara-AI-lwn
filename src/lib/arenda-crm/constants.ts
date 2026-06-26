import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Bot,
  Building2,
  CalendarDays,
  CreditCard,
  LayoutDashboard,
  MapPin,
  Megaphone,
  MessageSquare,
  Package,
  Radio,
  Settings,
  ShieldCheck,
  Users,
} from "lucide-react";

export type CrmViewId =
  | "dashboard"
  | "properties"
  | "clients"
  | "bookings"
  | "ads"
  | "payments"
  | "ai"
  | "messages"
  | "verification"
  | "communication"
  | "regions"
  | "packages"
  | "reports"
  | "settings";

export type CrmNavItem = {
  id: CrmViewId;
  label: string;
  icon: LucideIcon;
  group: "main" | "growth" | "ai" | "system";
  badge?: string;
};

export const CRM_NAV: CrmNavItem[] = [
  { id: "dashboard", label: "Boshqaruv paneli", icon: LayoutDashboard, group: "main" },
  { id: "properties", label: "Mulklar", icon: Building2, group: "main" },
  { id: "clients", label: "Mijozlar CRM", icon: Users, group: "main" },
  { id: "bookings", label: "Bronlash", icon: CalendarDays, group: "main" },
  { id: "ads", label: "Reklama", icon: Megaphone, group: "growth" },
  { id: "payments", label: "To'lovlar", icon: CreditCard, group: "growth" },
  { id: "ai", label: "AI Markaz", icon: Bot, group: "ai", badge: "AI" },
  { id: "messages", label: "Xabarlar", icon: MessageSquare, group: "main" },
  { id: "verification", label: "Tekshirish", icon: ShieldCheck, group: "system" },
  { id: "communication", label: "Aloqa markazi", icon: Radio, group: "growth" },
  { id: "regions", label: "Hududlar", icon: MapPin, group: "growth" },
  { id: "packages", label: "Ijara paketlari", icon: Package, group: "growth" },
  { id: "reports", label: "Hisobotlar", icon: BarChart3, group: "system" },
  { id: "settings", label: "Sozlamalar", icon: Settings, group: "system" },
];

export const CRM_NAV_GROUPS: Record<CrmNavItem["group"], string> = {
  main: "Asosiy",
  growth: "O'sish",
  ai: "Sun'iy intellekt",
  system: "Tizim",
};

export const PROPERTY_CATEGORIES = {
  residential: {
    label: "Turar-joy",
    types: ["Kvartira", "Uy", "Villa"],
  },
  commercial: {
    label: "Tijorat",
    types: ["Ofis", "Do'kon", "Restoran", "Ombor"],
  },
  transport: {
    label: "Transport",
    types: ["Avtomobil", "Yuk mashinasi", "Avtobus"],
  },
  equipment: {
    label: "Jihozlar",
    types: ["Ekskavator", "Kran", "Generator", "Qurilish jihozlari"],
  },
  event: {
    label: "Tadbir jihozlari",
    types: ["LED ekran", "Sahna", "Ovoz uskunalari"],
  },
} as const;

export const CLIENT_PIPELINE = [
  { id: "new", label: "Yangi lid", color: "#38BDF8" },
  { id: "contacted", label: "Bog'lanildi", color: "#2563EB" },
  { id: "negotiation", label: "Muzokara", color: "#8B5CF6" },
  { id: "reserved", label: "Band qilindi", color: "#F59E0B" },
  { id: "contract", label: "Shartnoma", color: "#22C55E" },
  { id: "closed", label: "Yopildi", color: "#10B981" },
  { id: "lost", label: "Yo'qotildi", color: "#EF4444" },
] as const;

export type PipelineStageId = (typeof CLIENT_PIPELINE)[number]["id"];

export const UZ_REGIONS = [
  "Toshkent",
  "Samarqand",
  "Buxoro",
  "Andijon",
  "Namangan",
  "Farg'ona",
  "Xorazm",
  "Nukus",
  "Qashqadaryo",
  "Surxondaryo",
  "Jizzax",
  "Sirdaryo",
  "Navoiy",
] as const;

export const RENTAL_PACKAGES = [
  {
    id: "construction",
    name: "Qurilish paketi",
    items: ["Ekskavator", "Generator", "Konteyner"],
    icon: "🏗️",
  },
  {
    id: "event",
    name: "Tadbir paketi",
    items: ["LED ekran", "Sahna", "Ovoz tizimi"],
    icon: "🎪",
  },
  {
    id: "office",
    name: "Ofis paketi",
    items: ["Stol", "Stul", "Printer"],
    icon: "🏢",
  },
] as const;

export const AI_FEATURES = [
  {
    id: "search",
    title: "AI Qidiruv",
    description: "Tabiiy tilda mulk topish",
    example: "Chilonzorda 2 xonali kvartira 5 mln gacha",
  },
  {
    id: "pricing",
    title: "AI Narx baholash",
    description: "Bozor bo'yicha ijara narxini hisoblash",
    example: "Yunusobod ofis 80 m² uchun taxminiy narx",
  },
  {
    id: "ads",
    title: "AI Reklama generatori",
    description: "OLX, Telegram, Instagram matnlari",
    example: "3 xonali kvartira uchun OLX e'lon matni",
  },
  {
    id: "broker",
    title: "AI Broker",
    description: "Mijozga eng mos mulklarni tavsiya qilish",
    example: "Ofis uchun eng yaxshi 5 ta variant",
  },
  {
    id: "leads",
    title: "AI Lid tahlili",
    description: "Lid sifatini bashorat qilish",
    example: "Bu mijoz shartnoma imkoniyati: 78%",
  },
  {
    id: "contract",
    title: "AI Shartnoma",
    description: "Ijara shartnomasi yaratish",
    example: "1 yillik ofis ijara shartnomasi",
  },
  {
    id: "description",
    title: "AI Tavsif",
    description: "SEO-friendly mulk tavsifi",
    example: "Yangi ta'mirlangan kvartira tavsifi",
  },
] as const;
