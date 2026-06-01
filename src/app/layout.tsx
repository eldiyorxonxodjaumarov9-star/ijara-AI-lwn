import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import { Providers } from "@/components/providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "ArendaHub — Ko'chmas mulk ijarasi boshqaruvi",
    template: "%s | ArendaHub",
  },
  description:
    "ArendaHub — ko'chmas mulk ijarasini boshqarish uchun zamonaviy SaaS platforma: mulklar, arendatorlar, shartnomalar, to'lovlar va hisobotlar.",
  keywords: [
    "arenda",
    "ko'chmas mulk",
    "ijara boshqaruvi",
    "property management",
    "ArendaHub",
  ],
  authors: [{ name: "ArendaHub" }],
  openGraph: {
    title: "ArendaHub",
    description: "Ko'chmas mulk ijarasi boshqaruv platformasi",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="uz" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-screen antialiased`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
