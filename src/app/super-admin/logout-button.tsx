"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";

export function PlatformAdminLogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function onLogout() {
    setLoading(true);
    try {
      await fetch("/api/super-admin/auth/logout", { method: "POST", credentials: "same-origin" });
    } finally {
      router.replace("/super-admin/login");
      router.refresh();
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={onLogout}
      disabled={loading}
      className="border-white/15 bg-white/5 text-slate-100 hover:bg-white/10 hover:text-white"
    >
      {loading ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : <LogOut className="mr-1.5 size-4" />}
      Chiqish
    </Button>
  );
}
