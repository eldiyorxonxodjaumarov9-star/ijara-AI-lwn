import {
  AlertTriangle,
  Banknote,
  Bell,
  BookUser,
  Bot,
  Building2,
  FileText,
  LayoutDashboard,
  Receipt,
  Settings,
  Users,
  Wrench,
  PieChart,
  type LucideIcon,
} from "lucide-react";

import type { Role } from "@/types";

import type { TranslationKey } from "@/lib/i18n/translations";

export interface NavItem {
  titleKey: TranslationKey;
  href: string;
  icon: LucideIcon;
  roles?: Role[];
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
      { titleKey: "nav.properties", href: "/properties", icon: Building2 },
      { titleKey: "nav.tenants", href: "/tenants", icon: Users },
      { titleKey: "nav.clients", href: "/clients", icon: BookUser },
      {
        titleKey: "nav.aiAgent",
        href: "/ai-agent",
        icon: Bot,
        roles: ["admin", "manager"],
      },
      { titleKey: "nav.contracts", href: "/contracts", icon: FileText },
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
      { titleKey: "nav.notifications", href: "/notifications", icon: Bell },
      { titleKey: "nav.settings", href: "/settings", icon: Settings },
    ],
  },
];
