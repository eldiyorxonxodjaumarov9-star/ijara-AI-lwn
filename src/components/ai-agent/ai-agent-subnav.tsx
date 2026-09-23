"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  Contact,
  ImageIcon,
  MapPin,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

const ITEMS: Array<{ href: string; label: string; icon: LucideIcon }> = [
  { href: "/ai-agent/scripts", label: "Scripts", icon: BookOpen },
  { href: "/ai-agent/locations", label: "Locations", icon: MapPin },
  { href: "/ai-agent/contacts", label: "Contacts", icon: Contact },
  { href: "/ai-agent/media", label: "Media Library", icon: ImageIcon },
];

export function AiAgentSubnav() {
  const pathname = usePathname();
  return (
    <div className="mb-6 flex flex-wrap gap-2">
      {ITEMS.map((item) => {
        const active =
          pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors",
              active
                ? "border-primary bg-primary/10 text-primary"
                : "hover:bg-muted"
            )}
          >
            <Icon className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}
