"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { cn } from "@/lib/utils";
import { navigation } from "@/config/navigation";
import { BrandLogo } from "@/components/brand-logo";
import { useAuth } from "@/context/auth-context";
import { useLanguage } from "@/context/language-context";
import { useLiveDebtCount } from "@/hooks/use-live-debt-count";

function isNavActive(
  href: string,
  pathname: string,
  searchParams: URLSearchParams
) {
  const [path, query = ""] = href.split("?");
  if (!path) return false;
  if (pathname !== path && !pathname.startsWith(`${path}/`)) return false;
  if (!query) {
    if (path === "/settings" && searchParams.get("section") === "lessor") {
      return false;
    }
    return pathname === path || pathname.startsWith(`${path}/`);
  }
  const required = new URLSearchParams(query);
  for (const [k, v] of required.entries()) {
    if (searchParams.get(k) !== v) return false;
  }
  return true;
}

export function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const { t } = useLanguage();
  const liveDebtCount = useLiveDebtCount();

  return (
    <div className="flex h-full flex-col bg-sidebar">
      <div className="flex h-16 items-center border-b px-6">
        <Link href="/" onClick={onNavigate} title="Asosiy sayt">
          <BrandLogo />
        </Link>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
        {navigation.map((section) => {
          const items = section.items.filter(
            (item) =>
              !item.roles || (user?.role && item.roles.includes(user.role))
          );
          if (items.length === 0) return null;
          return (
            <div key={section.labelKey}>
              <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t(section.labelKey)}
              </p>
              <ul className="space-y-1">
                {items.map((item) => {
                  const active = isNavActive(item.href, pathname, searchParams);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={onNavigate}
                        className={cn(
                          "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                          active
                            ? "bg-primary text-primary-foreground shadow-sm"
                            : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                        )}
                      >
                        <item.icon className="size-4 shrink-0" />
                        <span className="flex-1">{t(item.titleKey)}</span>
                        {item.href === "/debts" && liveDebtCount > 0 && (
                          <span className="flex size-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
                            {liveDebtCount > 99 ? "99+" : liveDebtCount}
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>

      <div className="border-t p-4">
        <div className="rounded-lg bg-primary/5 p-3 text-xs text-muted-foreground">
          <p className="font-semibold text-foreground">{t("sidebar.pro")}</p>
          <p className="mt-1">{t("sidebar.proDesc")}</p>
        </div>
      </div>
    </div>
  );
}

export function DesktopSidebar() {
  return (
    <aside className="hidden w-64 shrink-0 border-r lg:block">
      <div className="fixed inset-y-0 left-0 w-64 border-r">
        <Suspense fallback={null}>
          <SidebarContent />
        </Suspense>
      </div>
    </aside>
  );
}
