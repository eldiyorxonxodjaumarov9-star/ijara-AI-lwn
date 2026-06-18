"use client";

import type { ReactNode } from "react";

import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider } from "@/context/auth-context";
import { LanguageProvider } from "@/context/language-context";
import { CloudSyncProvider } from "@/components/cloud-sync-provider";
import { Toaster } from "@/components/ui/sonner";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem
      disableTransitionOnChange
    >
      <AuthProvider>
        <LanguageProvider>
          <CloudSyncProvider>
            {children}
            <Toaster />
          </CloudSyncProvider>
        </LanguageProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
