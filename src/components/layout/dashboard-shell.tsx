"use client";

import { Suspense } from "react";

import { DesktopSidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { SubscriptionGate } from "@/components/auth/subscription-gate";
import { FeatureRouteGate } from "@/components/auth/feature-route-gate";
import { DemoModeBanner } from "@/components/demo-mode-banner";
import { TashkentTimeProvider } from "@/context/tashkent-time-context";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <SubscriptionGate>
        <Suspense fallback={null}>
          <FeatureRouteGate>
            <TashkentTimeProvider>
              <div className="app-shell flex min-h-screen">
                <DesktopSidebar />
                <div className="flex min-w-0 flex-1 flex-col overflow-x-clip">
                  <Header />
                  <DemoModeBanner />
                  <main className="app-shell-main w-full min-w-0 max-w-full flex-1 break-words p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] lg:p-6">
                    {children}
                  </main>
                </div>
              </div>
            </TashkentTimeProvider>
          </FeatureRouteGate>
        </Suspense>
      </SubscriptionGate>
    </ProtectedRoute>
  );
}
