"use client";

import { DesktopSidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { DemoModeBanner } from "@/components/demo-mode-banner";
import { TashkentTimeProvider } from "@/context/tashkent-time-context";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <TashkentTimeProvider>
        <div className="flex min-h-screen">
          <DesktopSidebar />
          <div className="flex min-w-0 flex-1 flex-col">
            <Header />
            <DemoModeBanner />
            <main className="flex-1 p-4 lg:p-6">{children}</main>
          </div>
        </div>
      </TashkentTimeProvider>
    </ProtectedRoute>
  );
}
