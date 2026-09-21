"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { useAuth } from "@/context/auth-context";
import { workspaceHasFeature } from "@/hooks/use-plan-features";
import {
  featureForPagePath,
  settingsTabRequiresFeature,
} from "@/lib/plan-features";
import { isApiConfigured } from "@/lib/api/client";

/**
 * Blocks paid page routes for DEMO workspaces (redirect → /dashboard).
 * Complements API-side plan checks — not a substitute for them.
 */
export function FeatureRouteGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, workspace, workspaceLoading } = useAuth();

  const pageFeature = featureForPagePath(pathname);
  const settingsFeature = settingsTabRequiresFeature(searchParams.get("tab"));
  const required = pageFeature ?? settingsFeature;

  const blocked =
    isApiConfigured &&
    Boolean(user) &&
    user?.role !== "tenant" &&
    !workspaceLoading &&
    workspace !== null &&
    required !== null &&
    !workspaceHasFeature(workspace, required);

  useEffect(() => {
    if (!blocked) return;
    router.replace("/dashboard");
  }, [blocked, router]);

  if (blocked) return null;
  return <>{children}</>;
}
