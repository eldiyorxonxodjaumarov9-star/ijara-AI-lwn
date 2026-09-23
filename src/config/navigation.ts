import {
  AlertTriangle,
  Banknote,
  Archive,
  Bell,
  Bot,
  Building2,
  ClipboardList,
  DoorOpen,
  FileText,
  LayoutDashboard,
  MessageSquareText,
  Receipt,
  Settings,
  UserCog,
  Users,
  Wrench,
  PieChart,
  Send,
  Store,
  type LucideIcon,
} from "lucide-react";

import type { Role } from "@/types";

import type { TranslationKey } from "@/lib/i18n/translations";
import type { PaidFeature } from "@/lib/plan-features";

export interface NavItem {
  titleKey: TranslationKey;
  href: string;
  icon: LucideIcon;
  roles?: Role[];
  /** If set, item is hidden unless workspace has this paid feature. */
  feature?: PaidFeature;
}

export interface NavSection {
  labelKey: TranslationKey;
  items: NavItem[];
}

export const navigation: NavSection[] = [
  {
    labelKey: "nav.section.main",
    items: [
      { titleKey: "nav.dashboard", href: "/dashboard", icon: LayoutDashboard },
      { titleKey: "nav.lwnRooms", href: "/lwn-rooms", icon: DoorOpen },
      { titleKey: "nav.tenants", href: "/tenants", icon: Users },
      { titleKey: "nav.clientDatabase", href: "/klient-baza", icon: Archive },
      {
        titleKey: "nav.aiEmployees",
        href: "/ai-employees",
        icon: Bot,
        roles: ["admin"],
        feature: "aiEmployees",
      },
      {
        titleKey: "nav.aiAgent",
        href: "/ai-agent/scripts",
        icon: MessageSquareText,
        roles: ["admin"],
      },
      { titleKey: "nav.contracts", href: "/contracts", icon: FileText },
      { titleKey: "nav.contractDrafts", href: "/contract-drafts", icon: FileText, roles: ["admin", "manager"] },
      {
        titleKey: "nav.contractRequisites",
        href: "/settings?tab=company&section=lessor",
        icon: Building2,
        roles: ["admin", "manager"],
      },
    ],
  },
  {
    labelKey: "nav.section.finance",
    items: [
      { titleKey: "nav.payments", href: "/payments", icon: Banknote },
      { titleKey: "nav.debts", href: "/debts", icon: AlertTriangle },
      { titleKey: "nav.expenses", href: "/expenses", icon: Receipt },
      {
        titleKey: "nav.reports",
        href: "/reports",
        icon: PieChart,
        roles: ["admin", "manager"],
      },
    ],
  },
  {
    labelKey: "nav.section.management",
    items: [
      { titleKey: "nav.maintenance", href: "/maintenance", icon: Wrench },
      {
        titleKey: "nav.employees",
        href: "/employees",
        icon: UserCog,
        roles: ["admin", "manager"],
      },
      {
        titleKey: "nav.tasks",
        href: "/tasks",
        icon: ClipboardList,
        roles: ["admin", "manager"],
      },
      {
        titleKey: "nav.platformRental",
        href: "/platform-rental",
        icon: Store,
        roles: ["admin", "manager"],
      },
      { titleKey: "nav.notifications", href: "/notifications", icon: Bell },
      {
        titleKey: "nav.telegramBotUsers",
        href: "/telegram-bot-users",
        icon: Send,
        roles: ["admin", "manager"],
      },
      { titleKey: "nav.settings", href: "/settings", icon: Settings },
    ],
  },
];
