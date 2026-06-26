"use client";

import { useTheme } from "next-themes";
import {
  Bell,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Menu,
  Moon,
  Search,
  Sparkles,
  Sun,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  CRM_NAV,
  CRM_NAV_GROUPS,
  type CrmNavItem,
  type CrmViewId,
} from "@/lib/arenda-crm/constants";
import { isCrmModuleAllowed } from "@/lib/landlord-access";
import type { LandlordProfile } from "@/lib/landlord-profile";
import { cn } from "@/lib/utils";

export function CrmSidebar({
  active,
  onNavigate,
  collapsed,
  mobileOpen,
  onMobileClose,
  profile,
}: {
  active: CrmViewId;
  onNavigate: (id: CrmViewId) => void;
  collapsed: boolean;
  mobileOpen: boolean;
  onMobileClose: () => void;
  profile: LandlordProfile;
}) {
  const groups = Object.entries(CRM_NAV_GROUPS) as [CrmNavItem["group"], string][];

  const content = (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center gap-3 border-b border-white/10 px-4">
        <div className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#2563EB] to-[#38BDF8] text-sm font-bold text-white shadow-lg shadow-[#2563EB]/30">
          A
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-white">Arenda CRM</p>
            <p className="truncate text-xs text-slate-400">AI Rental Management</p>
          </div>
        )}
        <button
          type="button"
          className="ml-auto rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white lg:hidden"
          onClick={onMobileClose}
        >
          <X className="size-4" />
        </button>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto p-3">
        {groups.map(([groupKey, groupLabel]) => {
          const items = CRM_NAV.filter(
            (n) =>
              n.group === groupKey &&
              isCrmModuleAllowed(profile.login, n.id)
          );
          if (!items.length) return null;
          return (
            <div key={groupKey}>
              {!collapsed && (
                <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  {groupLabel}
                </p>
              )}
              <ul className="space-y-0.5">
                {items.map((item) => {
                  const Icon = item.icon;
                  const isActive = active === item.id;
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => {
                          onNavigate(item.id);
                          onMobileClose();
                        }}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
                          isActive
                            ? "bg-gradient-to-r from-[#2563EB] to-[#2563EB]/80 text-white shadow-lg shadow-[#2563EB]/25"
                            : "text-slate-400 hover:bg-white/5 hover:text-white"
                        )}
                      >
                        <Icon className="size-4 shrink-0" />
                        {!collapsed && (
                          <>
                            <span className="truncate">{item.label}</span>
                            {item.badge && (
                              <Badge className="ml-auto border-0 bg-[#38BDF8]/20 text-[10px] text-[#38BDF8]">
                                {item.badge}
                              </Badge>
                            )}
                          </>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>

      {!collapsed && (
        <div className="border-t border-white/10 p-4">
          <div className="rounded-xl bg-gradient-to-br from-[#2563EB]/20 to-[#38BDF8]/10 p-3 ring-1 ring-[#38BDF8]/20">
            <div className="flex items-center gap-2 text-[#38BDF8]">
              <Sparkles className="size-4" />
              <span className="text-xs font-semibold">Arenda AI</span>
            </div>
            <p className="mt-1 text-xs text-slate-400">
              AI broker, narx va reklama generatori tayyor
            </p>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-white/10 text-xs font-bold text-white">
              {profile.fullName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-white">{profile.fullName}</p>
              <p className="truncate text-[10px] text-slate-500">@{profile.login}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <>
      {mobileOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={onMobileClose}
          aria-label="Yopish"
        />
      )}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-white/10 bg-[#0F172A]/95 backdrop-blur-xl transition-transform lg:static lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
          collapsed && "lg:w-20"
        )}
      >
        {content}
      </aside>
    </>
  );
}

export function CrmHeader({
  activeLabel,
  onMenuOpen,
  onToggleCollapse,
  collapsed,
  onLogout,
  profile,
  search,
  onSearchChange,
}: {
  activeLabel: string;
  onMenuOpen: () => void;
  onToggleCollapse: () => void;
  collapsed: boolean;
  onLogout: () => void;
  profile: LandlordProfile;
  search: string;
  onSearchChange: (v: string) => void;
}) {
  const { theme, setTheme } = useTheme();

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-white/10 bg-white/70 px-4 backdrop-blur-xl dark:border-white/10 dark:bg-[#0F172A]/80 sm:px-6">
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        onClick={onMenuOpen}
      >
        <Menu className="size-5" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="hidden lg:flex"
        onClick={onToggleCollapse}
      >
        {collapsed ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
      </Button>

      <div className="min-w-0 flex-1">
        <h1 className="truncate text-lg font-semibold text-[#0F172A] dark:text-white">
          {activeLabel}
        </h1>
        <p className="hidden text-xs text-slate-500 sm:block">
          Arenda CRM · {profile.company || profile.fullName}
        </p>
      </div>

      <div className="relative hidden max-w-xs flex-1 md:block">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
        <Input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Qidirish..."
          className="border-white/10 bg-white/50 pl-9 dark:bg-white/5"
        />
      </div>

      <Button
        variant="ghost"
        size="icon"
        className="relative"
        onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      >
        <Sun className="size-4 rotate-0 scale-100 transition dark:-rotate-90 dark:scale-0" />
        <Moon className="absolute size-4 rotate-90 scale-0 transition dark:rotate-0 dark:scale-100" />
      </Button>

      <Button variant="ghost" size="icon" className="relative">
        <Bell className="size-4" />
        <span className="absolute right-2 top-2 size-2 rounded-full bg-[#38BDF8]" />
      </Button>

      <Button variant="ghost" size="icon" onClick={onLogout} title="Chiqish">
        <LogOut className="size-4" />
      </Button>
    </header>
  );
}
