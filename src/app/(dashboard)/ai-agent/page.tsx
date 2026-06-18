"use client";

import { useState } from "react";
import {
  Bot,
  ExternalLink,
  Loader2,
  Sparkles,
  Trash2,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useCollection, useCollectionActions } from "@/hooks/use-collection";
import {
  DEMO_QUICK_PICKS,
  runDemoAnalysis,
  simulateDemoDelay,
} from "@/lib/ai/demo";
import { ANALYSIS_LEVEL_MAP } from "@/lib/constants";
import { formatDate } from "@/lib/utils";
import type { BusinessAnalysis } from "@/types";

function LevelBadge({ level }: { level: BusinessAnalysis["rentalFit"] }) {
  const cfg = ANALYSIS_LEVEL_MAP[level];
  return <Badge variant={cfg?.variant}>{cfg?.label}</Badge>;
}

export default function AiAgentPage() {
  const { data: history, loading } = useCollection<BusinessAnalysis>("analyses");
  const { create, remove } = useCollectionActions<BusinessAnalysis>("analyses");

  const [instagramUrl, setInstagramUrl] = useState("");
  const [extraContext, setExtraContext] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [latest, setLatest] = useState<BusinessAnalysis | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [progress, setProgress] = useState("");

  const saveResult = async (
    result: ReturnType<typeof runDemoAnalysis> & { error?: never }
  ) => {
    if ("error" in result) return;

    const id = await create({
      instagramUrl: result.instagramUrl,
      username: result.username,
      businessName: result.businessName,
      businessType: result.businessType,
      summary: result.summary,
      rentalFit: result.rentalFit,
      rentalFitReason: result.rentalFitReason,
      footTraffic: result.footTraffic,
      footTrafficReason: result.footTrafficReason,
      recommendations: result.recommendations,
      confidence: result.confidence,
      source: result.source,
      rawBio: result.rawBio,
    });

    setLatest({ ...result, id, createdAt: new Date().toISOString() });
  };

  const runAnalysis = async (url?: string) => {
    const target = url ?? instagramUrl;
    if (!target.trim()) {
      toast.error("Instagram havolasini kiriting");
      return;
    }

    try {
      setAnalyzing(true);
      setProgress("Instagram profili o'qilmoqda...");
      await simulateDemoDelay();
      setProgress("Biznes tahlil qilinmoqda...");
      await new Promise((r) => setTimeout(r, 600));

      const result = runDemoAnalysis(target, extraContext);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }

      await saveResult(result);
      toast.success("Demo tahlil tayyor!");
    } finally {
      setAnalyzing(false);
      setProgress("");
    }
  };

  const pickDemo = (username: string) => {
    const url = `https://instagram.com/${username}`;
    setInstagramUrl(url);
    void runAnalysis(url);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await remove(deleteId);
    if (latest?.id === deleteId) setLatest(null);
    setDeleteId(null);
    toast.success("O'chirildi");
  };

  const show = latest ?? history[0] ?? null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI Agent"
        description="Instagram biznesini tahlil qilib, arenda mosligini baholaydi."
      />

      <div className="rounded-lg border border-primary/25 bg-primary/5 px-4 py-3 text-sm">
        <p className="flex items-center gap-2 font-medium text-primary">
          <Zap className="size-4" />
          Demo rejim faol
        </p>
        <p className="mt-1 text-muted-foreground">
          Haqiqiy Instagram ulanishi yo&apos;q. Tayyor namuna profillar va aqlli
          demo tahlil ishlatiladi — sinab ko&apos;rish uchun yetarli.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="size-5 text-primary" />
            Instagram tahlili
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              Tez sinov (bosing):
            </p>
            <div className="flex flex-wrap gap-2">
              {DEMO_QUICK_PICKS.map((p) => (
                <Button
                  key={p.username}
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={analyzing}
                  onClick={() => pickDemo(p.username)}
                >
                  {p.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Instagram havolasi</Label>
            <Input
              placeholder="instagram.com/toshkent_kafe yoki @username"
              value={instagramUrl}
              onChange={(e) => setInstagramUrl(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Qo&apos;shimcha ma&apos;lumot (ixtiyoriy)</Label>
            <Textarea
              placeholder="Masalan: kafe, do'kon, onlayn..."
              rows={2}
              value={extraContext}
              onChange={(e) => setExtraContext(e.target.value)}
            />
          </div>
          <Button onClick={() => runAnalysis()} disabled={analyzing}>
            {analyzing ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Bot className="size-4" />
            )}
            {analyzing ? "Tahlil qilinmoqda..." : "Tahlil qilish"}
          </Button>
          {progress && (
            <p className="text-xs text-primary animate-pulse">{progress}</p>
          )}
        </CardContent>
      </Card>

      {show && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="lg:col-span-2">
            <CardHeader className="flex-row items-start justify-between gap-2">
              <div>
                <CardTitle>{show.businessName ?? `@${show.username}`}</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  {show.businessType} ·{" "}
                  <a
                    href={show.instagramUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-primary hover:underline"
                  >
                    @{show.username}
                    <ExternalLink className="size-3" />
                  </a>
                </p>
              </div>
              <Badge variant="outline" className="shrink-0">
                Demo · {Math.round(show.confidence * 100)}% ishonch
              </Badge>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed">{show.summary}</p>
              {show.rawBio && (
                <p className="mt-3 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
                  {show.rawBio}
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingUp className="size-4" />
                Arenda mosligi
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <LevelBadge level={show.rentalFit} />
              <p className="text-sm text-muted-foreground">{show.rentalFitReason}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="size-4" />
                Mijoz oqimi
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <LevelBadge level={show.footTraffic} />
              <p className="text-sm text-muted-foreground">{show.footTrafficReason}</p>
            </CardContent>
          </Card>

          {show.recommendations.length > 0 && (
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">Tavsiyalar</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
                  {show.recommendations.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Tahlillar tarixi</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {loading ? (
            <p className="text-sm text-muted-foreground">Yuklanmoqda...</p>
          ) : history.length === 0 ? (
            <EmptyState
              icon={Bot}
              title="Tahlillar yo'q"
              description="Yuqoridagi demo tugmalardan birini bosing."
            />
          ) : (
            history.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm"
              >
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left hover:opacity-80"
                  onClick={() => setLatest(item)}
                >
                  <p className="truncate font-medium">
                    {item.businessName ?? `@${item.username}`}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {item.businessType} · {formatDate(item.createdAt)}
                  </p>
                </button>
                <div className="flex shrink-0 items-center gap-2">
                  <LevelBadge level={item.rentalFit} />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setDeleteId(item.id)}
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(o) => !o && setDeleteId(null)}
        title="Tahlilni o'chirish"
        description="Bu tahlil tarixdan o'chiriladi."
        onConfirm={handleDelete}
      />
    </div>
  );
}
