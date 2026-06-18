"use client";

import { useEffect } from "react";

import { useAuth } from "@/context/auth-context";
import { refreshFromCloud } from "@/lib/cloud/sync-client";

/** Tab ochilganda bulutdan yangi ma'lumotlarni tortadi */
export function CloudSyncProvider({ children }: { children: React.ReactNode }) {
  const { user, demoMode } = useAuth();

  useEffect(() => {
    if (!demoMode || !user?.email || user.role === "tenant") return;

    const email = user.email;

    const onFocus = () => {
      void refreshFromCloud(email);
    };

    const onSyncApplied = () => {
      window.location.reload();
    };

    window.addEventListener("focus", onFocus);
    window.addEventListener("arendahub:sync-applied", onSyncApplied);

    const interval = setInterval(() => {
      void refreshFromCloud(email);
    }, 30_000);

    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("arendahub:sync-applied", onSyncApplied);
      clearInterval(interval);
    };
  }, [demoMode, user?.email, user?.role]);

  return children;
}
