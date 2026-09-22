"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Bot,
  Loader2,
  Play,
  RefreshCw,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/context/auth-context";
import { usePlanFeatures } from "@/hooks/use-plan-features";
import { apiFetch } from "@/lib/api/client";

type DashboardPayload = {
  connection: {
    envEnabled: boolean;
    gatewayConfigured: boolean;
    hermesRuntime: string;
  };
  settings: {
    masterEnabled: boolean;
    managerEnabled: boolean;
    paymentEnabled: boolean;
    analystEnabled: boolean;
    telegramReportsEnabled: boolean;
    dryRunDefault: boolean;
    dailyReportHour: number;
    timezone: string;
  };
  stats: {
    runsToday: number;
    runsMonth: number;
    failedToday: number;
    tokensToday: { input: number; output: number };
    tokensMonth: { input: number; output: number };
  };
  lastSuccessfulRun: {
    id: string;
    agentType: string;
    completedAt: string | null;
    model: string | null;
  } | null;
  lastFailedRun: {
    id: string;
    errorCode: string | null;
    completedAt: string | null;
  } | null;
  nextScheduledRun: {
    timezone: string;
    hour: number;
    date: string;
  };
  audits: Array<{
    id: string;
    agentType: string;
    action: string;
    status: string;
    errorCode: string | null;
    createdAt: string;
    riskLevel: string;
  }>;
};

export default function AiEmployeesPage() {
  const { user } = useAuth();
  const { hasFeature } = usePlanFeatures();
  const canAiEmployees = hasFeature("aiEmployees");
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  const isAdmin = user?.role === "admin";

  const load = useCallback(async () => {
    if (!isAdmin || !canAiEmployees) {
      setLoading(false);
      setData(null);
      return;
    }
    setLoading(true);
    try {
      const body = await apiFetch<DashboardPayload>("/ai-employees");
      setData(body);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Yuklash xatosi");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [isAdmin, canAiEmployees]);

  useEffect(() => {
    void load();
  }, [load]);

  const patchSetting = async (
    patch: Partial<DashboardPayload["settings"]>
  ) => {
    if (!canAiEmployees) return;
    setBusy(true);
    try {
      await apiFetch("/ai-employees", {
        method: "PATCH",
        body: patch,
      });
      toast.success("Sozlama yangilandi");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Saqlash xatosi");
    } finally {
      setBusy(false);
    }
  };

  const trigger = async (mode: "test" | "daily") => {
    if (busy || !canAiEmployees) return;
    setBusy(true);
    try {
      const body = await apiFetch<{
        preview?: string;
        status?: string;
      }>("/ai-employees/trigger", {
        method: "POST",
        body: { mode, dryRun: true },
      });
      if (body?.preview) setPreview(body.preview);
      toast.success(
        mode === "test"
          ? "Test hisobot (dry-run) tayyor"
          : "Kunlik hisobot ishga tushdi (dry-run)"
      );
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Trigger xatosi");
    } finally {
      setBusy(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="AI xodimlar"
          description="Faqat administrator uchun"
        />
        <Card>
          <CardContent className="flex items-center gap-3 py-8 text-muted-foreground">
            <ShieldAlert className="h-5 w-5" />
            Bu sahifaga kirish huquqingiz yo‘q.
          </CardContent>
        </Card>
      </div>
    );
  }

  const s = data?.settings;

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI xodimlar"
        description="Hermes Agent — Manager, Payment, Analyst (read-only)"
        action={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void load()}
              disabled={loading || busy}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Yangilash
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void trigger("test")}
              disabled={busy || !data?.connection.gatewayConfigured}
            >
              {busy ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-2 h-4 w-4" />
              )}
              Test hisobot yaratish
            </Button>
            <Button
              size="sm"
              onClick={() => void trigger("daily")}
              disabled={busy || !s?.masterEnabled}
            >
              <Play className="mr-2 h-4 w-4" />
              Bugungi hisobotni ishga tushirish
            </Button>
          </div>
        }
      />

      {loading && !data ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Yuklanmoqda…
        </div>
      ) : null}

      {data ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Ulanish</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span>Env</span>
                  <Badge
                    variant={
                      data.connection.envEnabled ? "default" : "destructive"
                    }
                  >
                    {data.connection.envEnabled ? "ON" : "OFF"}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>Gateway</span>
                  <Badge
                    variant={
                      data.connection.gatewayConfigured
                        ? "default"
                        : "secondary"
                    }
                  >
                    {data.connection.gatewayConfigured
                      ? "sozlangan"
                      : "yo‘q"}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Bot className="h-4 w-4" />
                  Hermes: alohida runtime
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Tokenlar</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                <p>
                  Bugun: in {data.stats.tokensToday.input} / out{" "}
                  {data.stats.tokensToday.output}
                </p>
                <p>
                  Oy: in {data.stats.tokensMonth.input} / out{" "}
                  {data.stats.tokensMonth.output}
                </p>
                <p>
                  Runlar: {data.stats.runsToday} (bugun),{" "}
                  {data.stats.failedToday} failed
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Oxirgi run</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                {data.lastSuccessfulRun ? (
                  <p>
                    OK: {data.lastSuccessfulRun.agentType}
                    {data.lastSuccessfulRun.model
                      ? ` · ${data.lastSuccessfulRun.model}`
                      : ""}
                  </p>
                ) : (
                  <p className="text-muted-foreground">
                    Hali muvaffaqiyatli run yo‘q
                  </p>
                )}
                {data.lastFailedRun ? (
                  <p className="text-destructive">
                    Xato: {data.lastFailedRun.errorCode ?? "FAILED"}
                  </p>
                ) : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Jadval</CardTitle>
              </CardHeader>
              <CardContent className="text-sm">
                <p>
                  Keyingi: {data.nextScheduledRun.date}{" "}
                  {String(data.nextScheduledRun.hour).padStart(2, "0")}:00
                </p>
                <p className="text-muted-foreground">
                  {data.nextScheduledRun.timezone}
                </p>
                <p className="mt-2">
                  Dry-run:{" "}
                  <Badge variant={s?.dryRunDefault ? "secondary" : "default"}>
                    {s?.dryRunDefault ? "default ON" : "OFF"}
                  </Badge>
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Kill switch va agentlar</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {(
                [
                  ["masterEnabled", "Master ON/OFF"],
                  ["managerEnabled", "Manager"],
                  ["paymentEnabled", "Payment"],
                  ["analystEnabled", "Analyst"],
                  ["telegramReportsEnabled", "Telegram hisobot"],
                  ["dryRunDefault", "Dry-run default"],
                ] as const
              ).map(([key, label]) => (
                <div
                  key={key}
                  className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2"
                >
                  <Label htmlFor={key}>{label}</Label>
                  <Switch
                    id={key}
                    checked={Boolean(s?.[key])}
                    disabled={busy}
                    onCheckedChange={(v) => void patchSetting({ [key]: v })}
                  />
                </div>
              ))}
            </CardContent>
          </Card>

          {preview ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Hisobot preview (dry-run)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="whitespace-pre-wrap rounded-md bg-muted p-4 text-sm">
                  {preview}
                </pre>
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Audit (oxirgi 30)</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="py-2 pr-2">Vaqt</th>
                    <th className="py-2 pr-2">Agent</th>
                    <th className="py-2 pr-2">Action</th>
                    <th className="py-2 pr-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.audits.map((a) => (
                    <tr key={a.id} className="border-b border-border/50">
                      <td className="py-2 pr-2 whitespace-nowrap">
                        {new Date(a.createdAt).toLocaleString("uz-UZ")}
                      </td>
                      <td className="py-2 pr-2">{a.agentType}</td>
                      <td className="py-2 pr-2">{a.action}</td>
                      <td className="py-2 pr-2">
                        {a.status}
                        {a.errorCode ? ` (${a.errorCode})` : ""}
                      </td>
                    </tr>
                  ))}
                  {data.audits.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-4 text-muted-foreground">
                        Audit yozuvlari yo‘q
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
