import { CalendarDays, Car, Plug, type LucideIcon } from "lucide-react";

import { navigation, type NavItem, type NavSection } from "@/config/navigation";
import { isRentalIndustry, type RentalIndustry } from "@/lib/rental-industry";

const CONTRACT_HREFS = [
  "/contracts",
  "/contract-drafts",
  "/settings?tab=company&section=lessor",
];

export const INTEGRATIONS_HREF = "/settings?tab=integrations";
export const VEHICLES_HREF = "/vehicles";
export const BOOKINGS_HREF = "/bookings";

/** Without `href` the item renders as a disabled "Tez orada" row. */
type ExtraItem = { afterHref: string; label: string; icon: LucideIcon; href?: string };

export type IndustryNavigationConfig = {
  /** Literal label by existing href. Routes are never changed. */
  labels: Partial<Record<string, string>>;
  hidden?: string[];
  extra?: ExtraItem[];
};

const CONFIGS: Record<Exclude<RentalIndustry, "OTHER">, IndustryNavigationConfig> = {
  OFFICE_RENTAL: {
    labels: { "/lwn-rooms": "Xonalar", "/tenants": "Ijarachilar" },
  },
  APARTMENT_RENTAL: {
    labels: { "/lwn-rooms": "Obyektlar", "/tenants": "Ijarachilar" },
  },
  HOTEL_HOSTEL: {
    labels: { "/lwn-rooms": "Xonalar", "/tenants": "Mehmonlar" },
    hidden: CONTRACT_HREFS,
    extra: [{ afterHref: "/tenants", label: "Bronlar", icon: CalendarDays, href: BOOKINGS_HREF }],
  },
  CAR_RENTAL: {
    labels: { "/tenants": "Mijozlar", "/contracts": "Ijaralar" },
    hidden: ["/lwn-rooms"],
    extra: [{ afterHref: "/dashboard", label: "Avtomobillar", icon: Car, href: VEHICLES_HREF }],
  },
  RETAIL_RENTAL: {
    labels: { "/lwn-rooms": "Savdo joylari", "/tenants": "Ijarachilar" },
  },
  WAREHOUSE_RENTAL: {
    labels: { "/lwn-rooms": "Omborlar", "/tenants": "Ijarachilar" },
  },
  VILLA_RENTAL: {
    labels: { "/lwn-rooms": "Dacha / Villalar", "/tenants": "Mijozlar" },
    hidden: CONTRACT_HREFS,
    extra: [{ afterHref: "/tenants", label: "Bronlar", icon: CalendarDays, href: BOOKINGS_HREF }],
  },
  COMMERCIAL_RENTAL: {
    labels: { "/lwn-rooms": "Obyektlar", "/tenants": "Ijarachilar" },
  },
};

export function getIndustryNavigationConfig(
  industry: unknown
): IndustryNavigationConfig | null {
  if (!isRentalIndustry(industry) || industry === "OTHER") return null;
  return CONFIGS[industry];
}

/**
 * Applies labels and normal visibility only. `roles` and `feature` are kept
 * untouched so plan gating stays the single authority.
 */
export function getIndustryNavigation(
  industry: unknown,
  base: NavSection[] = navigation
): NavSection[] {
  const config = getIndustryNavigationConfig(industry);
  if (!config) return base;

  const hidden = new Set(config.hidden ?? []);
  return base.map((section, sectionIndex) => {
    const items: NavItem[] = [];
    for (const item of section.items) {
      if (!hidden.has(item.href)) {
        const label = config.labels[item.href];
        items.push(label ? { ...item, label } : item);
      }
      for (const extra of config.extra ?? []) {
        if (extra.afterHref === item.href) {
          items.push(
            extra.href
              ? { titleKey: "nav.dashboard", href: extra.href, label: extra.label, icon: extra.icon }
              : {
                  titleKey: "nav.dashboard",
                  href: "",
                  label: extra.label,
                  icon: extra.icon,
                  comingSoon: true,
                }
          );
        }
      }
      if (item.href === "/settings" && sectionIndex === base.length - 1) {
        items.splice(items.length - 1, 0, {
          titleKey: "nav.settings",
          href: INTEGRATIONS_HREF,
          label: "Integratsiyalar",
          icon: Plug,
          roles: ["admin", "manager"],
        });
      }
    }
    return { ...section, items };
  });
}
