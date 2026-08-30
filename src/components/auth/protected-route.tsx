"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
      // Soft navigation ba'zan Chrome'da qotadi — hard redirect
      const hard = window.setTimeout(() => {
        if (window.location.pathname !== "/login") {
          window.location.replace("/login");
        }
      }, 1500);
      return () => window.clearTimeout(hard);
    }
    // Ijarachi admin panelga kira olmaydi — o'z portaliga yo'naltiramiz
    if (!loading && user?.role === "tenant") {
      router.replace("/portal");
    }
  }, [loading, user, router]);

  useEffect(() => {
    if (!loading && user) {
      setStuck(false);
      return;
    }
    const timer = window.setTimeout(() => setStuck(true), 4000);
    return () => window.clearTimeout(timer);
  }, [loading, user]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <BrandLogo showText={false} className="animate-pulse" />
          <p className="text-sm text-muted-foreground">Yuklanmoqda...</p>
          {stuck && (
            <div className="mt-2 max-w-xs space-y-2 text-center">
              <p className="text-xs text-muted-foreground">
                Sessiya topilmadi yoki yuklash uzoq davom etmoqda.
              </p>
              <Link
                href="/login"
                className="inline-flex text-sm font-medium text-primary underline-offset-4 hover:underline"
              >
                Kirish sahifasiga o&apos;tish
              </Link>
            </div>
          )}
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
