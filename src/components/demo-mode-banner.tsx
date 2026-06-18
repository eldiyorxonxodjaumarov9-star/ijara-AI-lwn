"use client";

import { Info, Cloud, CloudOff, Server, ServerOff } from "lucide-react";
import { useEffect, useState } from "react";

import { useAuth } from "@/context/auth-context";
import { useLanguage } from "@/context/language-context";
import { isApiConfigured } from "@/lib/api/client";
import {
  checkCloudSyncAvailable,
  getCachedSyncStatus,
  type CloudSyncStatus,
} from "@/lib/cloud/sync-client";

type ServerStatus = "checking" | "online" | "offline";

export function DemoModeBanner() {
  const { demoMode, user } = useAuth();
  const { t } = useLanguage();
  const [syncStatus, setSyncStatus] = useState<CloudSyncStatus>(
    getCachedSyncStatus()
  );
  const [serverStatus, setServerStatus] = useState<ServerStatus>("checking");

  useEffect(() => {
    if (!demoMode || user?.role === "tenant") return;
    void checkCloudSyncAvailable().then((ok) => {
      setSyncStatus(ok ? "active" : "offline");
    });
  }, [demoMode, user?.role]);

  useEffect(() => {
    if (!isApiConfigured || user?.role === "tenant") return;
    void fetch("/api/health", { cache: "no-store" })
      .then((r) => setServerStatus(r.ok ? "online" : "offline"))
      .catch(() => setServerStatus("offline"));
  }, [user?.role]);

  if (isApiConfigured && user?.role !== "tenant") {
    const online = serverStatus === "online";
    return (
      <div
        className={`flex items-center gap-2 border-b px-4 py-2 text-xs lg:px-6 ${
          online
            ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-800 dark:text-emerald-400"
            : "border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-400"
        }`}
      >
        {online ? (
          <Server className="size-3.5 shrink-0" />
        ) : (
          <ServerOff className="size-3.5 shrink-0" />
        )}
        <span>
          {online ? t("server.bannerOnline") : t("server.bannerOffline")}
        </span>
      </div>
    );
  }

  if (!demoMode) return null;

  const syncActive = syncStatus === "active";

  return (
    <div
      className={`flex items-center gap-2 border-b px-4 py-2 text-xs lg:px-6 ${
        syncActive
          ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-800 dark:text-emerald-400"
          : "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-400"
      }`}
    >
      {syncActive ? (
        <Cloud className="size-3.5 shrink-0" />
      ) : (
        <Info className="size-3.5 shrink-0" />
      )}
      <span>
        {syncActive ? t("demo.bannerSync") : t("demo.banner")}
      </span>
      {!syncActive && syncStatus !== "checking" && (
        <CloudOff className="ml-auto size-3.5 shrink-0 opacity-60" />
      )}
    </div>
  );
}
