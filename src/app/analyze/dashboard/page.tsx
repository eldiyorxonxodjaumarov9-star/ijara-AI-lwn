"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Bot,
  ExternalLink,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";

import { BrandLogo } from "@/components/brand-logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { loadDemoAnalysis, type StoredDemoAnalysis } from "@/lib/ai/demo-session";
import { ANALYSIS_LEVEL_MAP } from "@/lib/constants";
import { formatDate } from "@/lib/utils";

function LevelBadge({
  level,
}: {
  level: StoredDemoAnalysis["rentalFit"];
}) {
  const cfg = ANALYSIS_LEVEL_MAP[level];
  return <Badge variant={cfg?.variant}>{cfg?.label}</Badge>;
}

export default function AnalyzeDashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<StoredDemoAnalysis | null>(null);

  useEffect(() => {
    const stored = loadDemoAnalysis();
    if (!stored) {
      router.replace("/login?tab=analyze");
      return;
    }
    setData(stored);
  }, [router]);

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">Yuklanmoqda...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-4">
          <BrandLogo />
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-6 p-4 pb-12">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/login">
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-xl font-bold">Biznes tahlil dashboardi</h1>
            <p className="text-sm text-muted-foreground">
              Demo · {formatDate(data.createdAt)}
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-primary/25 bg-primary/5 px-4 py-3 text-sm">
          <p className="flex items-center gap-2 font-medium text-primary">
            <Zap className="size-4" />
            AI Agent demo natijasi
          </p>
          <p className="mt-1 text-muted-foreground">
            Instagram profili asosida arenda mosligi va mijoz oqimi baholandi.
          </p>
        </div>

        <Card>
          <CardHeader className="flex-row items-start justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Bot className="size-5 text-primary" />
                {data.businessName ?? `@${data.username}`}
              </CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                {data.businessType} ·{" "}
                <a
                  href={data.instagramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  @{data.username}
                  <ExternalLink className="size-3" />
                </a>
              </p>
            </div>
            <Badge variant="outline">
              {Math.round(data.confidence * 100)}% ishonch
            </Badge>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed">{data.summary}</p>
            {data.rawBio && (
              <p className="mt-3 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
                {data.rawBio}
              </p>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingUp className="size-4 text-primary" />
                Arenda mosligi
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <LevelBadge level={data.rentalFit} />
              <p className="text-sm text-muted-foreground">{data.rentalFitReason}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="size-4 text-primary" />
                Mijoz oqimi
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <LevelBadge level={data.footTraffic} />
              <p className="text-sm text-muted-foreground">
                {data.footTrafficReason}
              </p>
            </CardContent>
          </Card>
        </div>

        {data.recommendations.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Tavsiyalar</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-inside list-disc space-y-2 text-sm text-muted-foreground">
                {data.recommendations.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        <div className="flex flex-wrap gap-3">
          <Button asChild variant="outline">
            <Link href="/login?tab=analyze">Boshqa profil tahlil qilish</Link>
          </Button>
          <Button asChild>
            <Link href="/login">Arenda egasi sifatida kirish</Link>
          </Button>
        </div>
      </main>
    </div>
  );
}
