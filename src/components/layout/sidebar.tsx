"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import { navigation } from "@/config/navigation";
import { BrandLogo } from "@/components/brand-logo";
import { useAuth } from "@/context/auth-context";

export function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { user } = useAuth();

  return (
    <div className="flex h-full flex-col bg-sidebar">
      <div className="flex h-16 items-center border-b px-6">
        <Link href="/dashboard" onClick={onNavigate}>
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
            <div key={section.label}>
              <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {section.label}
              </p>
              <ul className="space-y-1">
                {items.map((item) => {
                  const active =
                    pathname === item.href ||
                    pathname.startsWith(item.href + "/");
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
                        {item.title}
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
          <p className="font-semibold text-foreground">ArendaHub Pro</p>
          <p className="mt-1">Barcha modullar faollashtirilgan.</p>
        </div>
      </div>
    </div>
  );
}

export function DesktopSidebar() {
  return (
    <aside className="hidden w-64 shrink-0 border-r lg:block">
      <div className="fixed inset-y-0 left-0 w-64 border-r">
        <SidebarContent />
      </div>
    </aside>
  );
}
