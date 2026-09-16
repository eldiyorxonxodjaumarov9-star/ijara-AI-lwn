"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function DashboardPanel({
  title,
  description,
  actionHref,
  actionLabel,
  children,
  className,
  delayMs = 0,
}: {
  title: string;
  description?: string;
  actionHref?: string;
  actionLabel?: string;
  children: ReactNode;
  className?: string;
  delayMs?: number;
}) {
  return (
    <section
      className={cn("app-panel app-reveal p-4 sm:p-5", className)}
      style={{ animationDelay: `${delayMs}ms` }}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold tracking-tight text-foreground">
            {title}
          </h2>
          {description && (
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        {actionHref && actionLabel && (
          <Button
            asChild
            size="sm"
            variant="outline"
            className="shrink-0 border-border bg-white/5 hover:bg-white/10"
          >
            <Link href={actionHref}>{actionLabel}</Link>
          </Button>
        )}
      </div>
      {children}
    </section>
  );
}
