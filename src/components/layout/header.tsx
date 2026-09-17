"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, LogOut, Menu, Search, Settings, User } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ThemeToggle } from "@/components/theme-toggle";
import { TashkentClock } from "@/components/layout/tashkent-clock";
import { SidebarContent } from "@/components/layout/sidebar";
import { WorkspaceStatusBadge } from "@/components/subscription/workspace-status-badge";
import { useAuth } from "@/context/auth-context";
import { useLanguage } from "@/context/language-context";
import { useCollection } from "@/hooks/use-collection";
import { getInitials } from "@/lib/utils";
import { ROLE_MAP } from "@/lib/constants";
import type { AppNotification } from "@/types";
import { Suspense, useState } from "react";

export function Header() {
  const router = useRouter();
  const { user, logout, workspace } = useAuth();
  const { t } = useLanguage();
  const { data: notifications } = useCollection<AppNotification>("notifications");
  const [mobileOpen, setMobileOpen] = useState(false);
  const unread = notifications.filter((n) => !n.read).length;

  const handleLogout = async () => {
    await logout();
    toast.success(t("common.logoutSuccess"));
    router.push("/login");
  };

  return (
    <header className="app-header sticky top-0 z-30 flex h-16 items-center gap-3 border-b px-4 lg:px-6">
      <Dialog open={mobileOpen} onOpenChange={setMobileOpen}>
        <DialogTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="text-foreground hover:bg-white/10 lg:hidden"
            aria-label="Menyu"
          >
            <Menu className="size-5" />
          </Button>
        </DialogTrigger>
        <DialogContent className="left-0 top-0 h-full max-w-64 translate-x-0 translate-y-0 rounded-none border-r border-white/10 bg-[#071429] p-0 sm:rounded-none">
          <Suspense fallback={null}>
            <SidebarContent onNavigate={() => setMobileOpen(false)} />
          </Suspense>
        </DialogContent>
      </Dialog>

      {workspace && workspace.status === "DEMO" && !workspace.isInternal && (
        <WorkspaceStatusBadge workspace={workspace} compact className="lg:hidden" />
      )}

      <div className="relative hidden max-w-sm flex-1 md:block">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder={t("common.search")}
          className="border-white/10 bg-white/5 pl-9 text-foreground placeholder:text-muted-foreground focus-visible:ring-sky-500/40 dark:border-white/10"
          aria-label={t("common.search")}
        />
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        <TashkentClock />
        <ThemeToggle />

        <Button
          variant="ghost"
          size="icon"
          className="relative hover:bg-white/10"
          asChild
          aria-label="Xabarlar"
        >
          <Link href="/notifications">
            <Bell className="size-4" />
            {unread > 0 && (
              <span className="absolute right-1.5 top-1.5 flex size-4 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white">
                {unread}
              </span>
            )}
          </Link>
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="ml-1 flex items-center gap-2 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-sky-400/50"
              aria-label="Profil menyusi"
            >
              <Avatar className="border border-white/15">
                <AvatarImage src={user?.photoURL} alt={user?.displayName} />
                <AvatarFallback className="bg-sky-500/20 text-sky-100">
                  {getInitials(user?.displayName)}
                </AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-56 border-white/10 bg-[#0d1c34] text-slate-100"
          >
            <DropdownMenuLabel>
              <div className="flex flex-col">
                <span className="font-semibold">{user?.displayName}</span>
                <span className="text-xs font-normal text-slate-400">
                  {user?.email}
                </span>
                <span className="mt-1 text-xs font-normal text-sky-300">
                  {user?.role ? ROLE_MAP[user.role] : ""}
                </span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-white/10" />
            <DropdownMenuItem asChild>
              <Link href="/settings">
                <User className="size-4" /> {t("common.profile")}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/settings">
                <Settings className="size-4" /> {t("nav.settings")}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-white/10" />
            <DropdownMenuItem
              onClick={handleLogout}
              className="text-rose-300 focus:text-rose-200"
            >
              <LogOut className="size-4" /> {t("common.logout")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
