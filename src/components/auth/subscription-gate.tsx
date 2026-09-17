"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

import { useAuth } from "@/context/auth-context";
import { isApiConfigured } from "@/lib/api/client";

const ALLOWED_PREFIXES = [
  "/settings",
  "/login",
  "/logout",
  "/register",
  "/forgot-password",
];

function isAllowedPath(pathname: string): boolean {
  return ALLOWED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export function SubscriptionGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, workspace, workspaceLoading } = useAuth();

  const shouldGate =
    isApiConfigured &&
    Boolean(user) &&
    user?.role !== "tenant" &&
    !workspaceLoading &&
    workspace !== null &&
    !workspace.isInternal &&
    !workspace.hasAccess;

  const allowed = isAllowedPath(pathname);

  useEffect(() => {
    if (!shouldGate || allowed) return;
    router.replace("/settings?tab=subscription");
  }, [shouldGate, allowed, router]);

  if (shouldGate && !allowed) {
    return null;
  }

  return <>{children}</>;
}
