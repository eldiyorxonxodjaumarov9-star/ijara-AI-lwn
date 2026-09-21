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
                <div className="flex min-w-0 flex-1 flex-col">
                  <Header />
                  <DemoModeBanner />
                  <main className="app-shell-main flex-1 p-4 lg:p-6">
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
