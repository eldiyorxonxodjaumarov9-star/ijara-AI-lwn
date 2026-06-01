import {
  AlertTriangle,
  Banknote,
  Bell,
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

export interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
  roles?: Role[];
}

export interface NavSection {
  label: string;
  items: NavItem[];
}

export const navigation: NavSection[] = [
  {
    label: "Asosiy",
    items: [
      { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      { title: "Aktivlar", href: "/properties", icon: Building2 },
      { title: "Arendatorlar", href: "/tenants", icon: Users },
      { title: "Shartnomalar", href: "/contracts", icon: FileText },
    ],
  },
  {
    label: "Moliya",
    items: [
      { title: "To'lovlar", href: "/payments", icon: Banknote },
      { title: "Qarzdorliklar", href: "/debts", icon: AlertTriangle },
      { title: "Xarajatlar", href: "/expenses", icon: Receipt },
      {
        title: "Hisobotlar",
        href: "/reports",
        icon: PieChart,
        roles: ["admin", "manager"],
      },
    ],
  },
  {
    label: "Boshqaruv",
    items: [
      { title: "Ta'mirlash", href: "/maintenance", icon: Wrench },
      { title: "Xabarlar", href: "/notifications", icon: Bell },
      { title: "Sozlamalar", href: "/settings", icon: Settings },
    ],
  },
];
