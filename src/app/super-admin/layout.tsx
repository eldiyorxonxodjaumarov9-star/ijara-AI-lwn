import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Platform Admin",
  robots: { index: false, follow: false },
};

export default function SuperAdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="app-auth-shell relative min-h-screen w-full overflow-x-hidden">
      <div className="app-auth-grid absolute inset-0" aria-hidden />
      <div
        className="pointer-events-none absolute -left-24 top-10 size-72 rounded-full bg-blue-600/25 blur-[100px]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute bottom-0 right-0 size-80 rounded-full bg-cyan-400/15 blur-[110px]"
        aria-hidden
      />
      <div className="relative z-10">{children}</div>
    </div>
  );
}
