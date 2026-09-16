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
    <div className="app-sidebar flex h-full flex-col">
      <div className="flex h-16 items-center border-b border-white/10 px-6">
        <Link href="/" onClick={onNavigate} title="Asosiy sayt">
          <BrandLogo className="[&_span]:text-slate-50 [&_.text-primary]:text-sky-400 [&_>div]:bg-sky-500 [&_>div]:text-white [&_>div]:shadow-none" />
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
              <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                {t(section.labelKey)}
              </p>
              <ul className="space-y-1">
                {items.map((item) => {
                  const active = isNavActive(item.href, pathname, searchParams);
                  const title = t(item.titleKey);
                  const debtsLabel =
                    item.href === "/debts" && liveDebtCount > 0
                      ? `${title}, ${liveDebtCount} ta`
                      : title;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={onNavigate}
                        aria-label={debtsLabel}
                        title={debtsLabel}
                        className={cn(
                          "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                          active
                            ? "bg-sky-500/15 text-sky-100 shadow-[0_0_24px_rgb(56_189_248_/_0.12)] ring-1 ring-sky-400/30"
                            : "text-slate-400 hover:bg-white/5 hover:text-slate-100"
                        )}
                      >
                        <item.icon
                          className={cn(
                            "size-4 shrink-0 transition-colors",
                            active && "text-sky-300"
                          )}
                        />
                        <span className="min-w-0 flex-1 truncate">{title}</span>
                        {item.href === "/debts" && liveDebtCount > 0 && (
                          <span
                            className="ml-auto flex size-5 shrink-0 items-center justify-center rounded-full bg-rose-500/90 text-[10px] font-bold leading-none text-white"
                            aria-hidden="true"
                          >
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

      <div className="border-t border-white/10 p-4">
        <div className="rounded-xl border border-sky-400/20 bg-sky-500/10 p-3 text-xs text-slate-300">
          <p className="font-semibold text-sky-200">{t("sidebar.pro")}</p>
          <p className="mt-1 text-slate-400">{t("sidebar.proDesc")}</p>
        </div>
      </div>
    </div>
  );
}

export function DesktopSidebar() {
  return (
    <aside className="hidden w-64 shrink-0 border-r border-white/10 lg:block">
      <div className="fixed inset-y-0 left-0 w-64 border-r border-white/10">
        <Suspense fallback={null}>
          <SidebarContent />
        </Suspense>
      </div>
    </aside>
  );
}
