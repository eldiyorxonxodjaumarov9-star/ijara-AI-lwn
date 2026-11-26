"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Bot, Loader2, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { displayValue } from "@/lib/robotrent/format";

interface CatalogRobot {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  highlights: unknown;
}

function toHighlights(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((v) => (typeof v === "string" ? v : v == null ? "" : String(v)))
      .map((v) => v.trim())
      .filter(Boolean);
  }
  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v != null && String(v).trim() !== "")
      .map(([k, v]) => `${k}: ${String(v)}`);
  }
  return [];
}

export function RobotRentCatalog() {
  const [robots, setRobots] = useState<CatalogRobot[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/public/robotrent/robots", {
        cache: "no-store",
      });
      const json = (await res.json().catch(() => null)) as {
        data?: CatalogRobot[];
        message?: string;
      } | null;
      if (!res.ok || !Array.isArray(json?.data)) {
        setError(json?.message || "Katalogni yuklab bo‘lmadi.");
        setRobots(null);
        return;
      }
      setRobots(json.data);
    } catch {
      setError("Server bilan bog‘lanib bo‘lmadi.");
      setRobots(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-20 text-slate-400">
        <Loader2 className="size-5 animate-spin" />
        Yuklanmoqda…
      </div>
    );
  }

  if (error) {
    return (
      <div className="robotrent-card p-8 text-center">
        <p className="text-slate-300">{error}</p>
        <Button
          variant="outline"
          className="mt-4 border-white/25 bg-transparent text-white hover:bg-white/10 hover:text-white"
          onClick={() => void load()}
        >
          <RefreshCw />
          Qayta urinish
        </Button>
      </div>
    );
  }

  if (!robots || robots.length === 0) {
    return (
      <div className="robotrent-card p-8 text-center text-slate-300">
        Hozircha katalogda robot modellari yo‘q.
      </div>
    );
  }

  return (
    <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {robots.map((r) => {
        const highlights = toHighlights(r.highlights);
        return (
          <li key={r.id} className="robotrent-card flex flex-col overflow-hidden">
            <div className="flex aspect-[16/10] items-center justify-center bg-gradient-to-br from-cyan-400/10 to-blue-500/10">
              {r.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={r.imageUrl}
                  alt={r.name}
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              ) : (
                <Bot className="size-16 text-cyan-300/70" aria-hidden="true" />
              )}
            </div>
            <div className="flex flex-1 flex-col p-5">
              <h3 className="text-lg font-semibold text-white">{r.name}</h3>
              <p className="mt-2 text-sm text-slate-400">
                {displayValue(r.description)}
              </p>
              {highlights.length > 0 ? (
                <ul className="mt-3 space-y-1 text-sm text-slate-300">
                  {highlights.map((h) => (
                    <li key={h} className="flex gap-2">
                      <span className="mt-2 size-1.5 shrink-0 rounded-full bg-cyan-300" />
                      {h}
                    </li>
                  ))}
                </ul>
              ) : null}
              <div className="mt-auto pt-5">
                <Button
                  asChild
                  className="w-full bg-cyan-400 text-[#071429] hover:bg-cyan-300"
                >
                  <Link
                    href={`/robotrent/mijoz?robot=${encodeURIComponent(r.slug)}`}
                  >
                    Sinab ko‘rish
                    <ArrowRight />
                  </Link>
                </Button>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
