"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/context/auth-context";
import { BrandLogo } from "@/components/brand-logo";
import type { Role } from "@/types";

export function ProtectedRoute({
  children,
  roles,
}: {
  children: React.ReactNode;
  roles?: Role[];
}) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
      return;
    }
    // Ijarachi admin panelga kira olmaydi — o'z portaliga yo'naltiramiz
    if (!loading && user?.role === "tenant") {
      router.replace("/portal");
    }
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <BrandLogo showText={false} className="animate-pulse" />
          <p className="text-sm text-muted-foreground">Yuklanmoqda...</p>
        </div>
      </div>
    );
  }

  if (roles && !roles.includes(user.role)) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-2 text-center">
        <h2 className="text-xl font-semibold">Ruxsat yo&apos;q</h2>
        <p className="text-sm text-muted-foreground">
          Ushbu bo&apos;limga kirish uchun yetarli huquqingiz mavjud emas.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
