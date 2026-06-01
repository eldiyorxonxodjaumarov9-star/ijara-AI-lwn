import type { ReactNode } from "react";

import { BrandLogo } from "@/components/brand-logo";
import { ThemeToggle } from "@/components/theme-toggle";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-primary p-10 text-primary-foreground lg:flex">
        <div className="absolute -right-24 -top-24 size-72 rounded-full bg-white/10" />
        <div className="absolute -bottom-24 -left-24 size-80 rounded-full bg-white/10" />
        <BrandLogo className="relative text-primary-foreground [&_div]:bg-white [&_div]:text-primary" />
        <div className="relative space-y-4">
          <h2 className="text-3xl font-bold leading-tight">
            Ko&apos;chmas mulk ijarasini bitta joydan boshqaring
          </h2>
          <p className="max-w-md text-primary-foreground/80">
            Mulklar, arendatorlar, shartnomalar, to&apos;lovlar va hisobotlar —
            barchasi zamonaviy va xavfsiz platformada.
          </p>
          <ul className="space-y-2 text-sm text-primary-foreground/90">
            <li>• Real-time statistika va grafiklar</li>
            <li>• Avtomatik qarzdorlik hisoboti</li>
            <li>• PDF va Excel eksport</li>
            <li>• Rollarga asoslangan kirish</li>
          </ul>
        </div>
        <p className="relative text-xs text-primary-foreground/70">
          © {new Date().getFullYear()} ArendaHub. Barcha huquqlar himoyalangan.
        </p>
      </div>

      <div className="relative flex items-center justify-center p-6">
        <div className="absolute right-4 top-4">
          <ThemeToggle />
        </div>
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <BrandLogo />
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
