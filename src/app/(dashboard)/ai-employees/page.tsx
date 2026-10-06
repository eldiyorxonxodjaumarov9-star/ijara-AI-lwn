"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Play, RefreshCw, ShieldAlert, Sparkles } from "lucide-react";
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

type AgentKind = "MANAGER" | "PAYMENT" | "ANALYST";

type RunView = {
  id: string;
  status: string;
  triggerType: string;
  createdAt: string;
  completedAt: string | null;
  model: string | null;
  dryRun: boolean;
  dataAsOf: string | null;
  toolsUsed: string[];
  report: string | null;
  errorCode: string | null;
  errorMessage: string | null;
};

type TokenStat = { input: number | null; output: number | null; runsWithUsage: number };

type Settings = {
  masterEnabled: boolean;
  managerEnabled: boolean;
  paymentEnabled: boolean;
  analystEnabled: boolean;
  telegramReportsEnabled: boolean;
  dryRunDefault: boolean;
  dailyReportHour: number;
  timezone: string;
};

type DashboardPayload = {
  provider: { name: string; configured: boolean; model: string | null; missing: string[]; mode: string };
  permissions: { canRun: boolean; canEditSettings: boolean };
  settings: Settings;
  stats: { runsToday: number; runsMonth: number; failedToday: number; tokensToday: TokenStat; tokensMonth: TokenStat };
  agents: { agent: AgentKind; label: string; enabled: boolean; lastRun: RunView | null }[];
  lastDailyReport: RunView | null;
  nextScheduledRun: { timezone: string; hour: number; date: string };
  audits: Array<{ id: string; agentType: string; action: string; status: string; errorCode: string | null; createdAt: string }>;
};

type TriggerResult = {
  report?: string | null;
  dataAsOf?: string | null;
  dryRun?: boolean;
  delivery?: { status: string } | null;
};

function formatAsOf(iso: string | null | undefined) {
  if (!iso) return "—";
  const p = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Tashkent",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(iso));
  const g = (t: string) => p.find((x) => x.type === t)?.value ?? "";
  return `${g("day")}.${g("month")}.${g("year")} ${g("hour")}:${g("minute")}`;
}

const tokenText = (t: TokenStat) =>
  t.input === null ? "mavjud emas" : `in ${t.input.toLocaleString("ru-RU")} / out ${(t.output ?? 0).toLocaleString("ru-RU")}`;

const STATUS_LABEL: Record<string, string> = {
  COMPLETED: "Muvaffaqiyatli",
  FAILED: "Xato",
  RUNNING: "Ishlamoqda",
  PENDING: "Navbatda",
};

export default function AiEmployeesPage() {
  const { user } = useAuth();
  const { hasFeature } = usePlanFeatures();
  const canAiEmployees = hasFeature("aiEmployees");
  const canView = user?.role === "admin" || user?.role === "manager";
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ title: string; text: string; dataAsOf: string | null } | null>(null);

  const load = useCallback(async () => {
    if (!canView || !canAiEmployees) {
      setLoading(false);
      setData(null);
      return;
    }
    setLoading(true);
    try {
      setData(await apiFetch<DashboardPayload>("/ai-employees"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Yuklash xatosi");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [canView, canAiEmployees]);

  useEffect(() => {
    void load();
  }, [load]);

  const patchSetting = async (patch: Partial<Settings>) => {
    if (!data?.permissions.canEditSettings) return;
    setBusy("settings");
    try {
      await apiFetch("/ai-employees", { method: "PATCH", body: patch });
      toast.success("Sozlama yangilandi");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Saqlash xatosi");
    } finally {
      setBusy(null);
    }
  };

  const trigger = async (key: string, title: string, body: Record<string, unknown>) => {
    if (busy) return;
    setBusy(key);
    setPreview(null);
    try {
      const res = await apiFetch<TriggerResult>("/ai-employees/trigger", { method: "POST", body });
      if (res?.report) setPreview({ title, text: res.report, dataAsOf: res.dataAsOf ?? null });
      const sent = res?.delivery?.status === "sent";
      toast.success(sent ? `${title}: tayyor, Telegramga yuborildi` : `${title}: tayyor`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "DeepSeek vaqtincha mavjud emas");
    } finally {
      setBusy(null);
      await load();
    }
  };

  if (!canView) {
    return (
      <div className="space-y-6">
        <PageHeader title="AI xodimlar" description="Faqat administrator va menejer uchun" />
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
  const connected = Boolean(data?.provider.configured);
  const canRun = Boolean(data?.permissions.canRun) && connected;
  const canEdit = Boolean(data?.permissions.canEditSettings);
  const spin = (key: string) =>
    busy === key ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI xodimlar"
        description="DeepSeek AI Agents — Manager, Payment, Analyst"
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading || Boolean(busy)}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Yangilash
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void trigger("test", "Test hisobot", { mode: "test" })}
              disabled={Boolean(busy) || !canRun}
            >
              {spin("test") ?? <Sparkles className="mr-2 h-4 w-4" />}
              Test hisobot yaratish
            </Button>
            <Button
              size="sm"
              onClick={() => void trigger("daily", "Bugungi hisobot", { mode: "daily" })}
              disabled={Boolean(busy) || !canRun || !s?.masterEnabled}
            >
              {spin("daily") ?? <Play className="mr-2 h-4 w-4" />}
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
          {!connected ? (
            <Card className="border-destructive/50">
              <CardContent className="flex items-center gap-3 py-4 text-sm text-destructive">
                <ShieldAlert className="h-5 w-5" />
                DeepSeek ulanmagan — agentlar ishga tushmaydi.
              </CardContent>
            </Card>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Ulanish</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span>Provider</span>
                  <span className="font-medium">{data.provider.name}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>API</span>
                  <Badge variant={connected ? "default" : "destructive"}>{connected ? "Ulangan" : "Ulanmagan"}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>Mode</span>
                  <Badge variant="secondary">Read-only</Badge>
                </div>
                {data.provider.model ? (
                  <p className="text-xs text-muted-foreground">Model: {data.provider.model}</p>
                ) : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Tokenlar (DeepSeek)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                <p>Bugun: {tokenText(data.stats.tokensToday)}</p>
                <p>Oy: {tokenText(data.stats.tokensMonth)}</p>
                <p>
                  Runlar: {data.stats.runsToday} (bugun), {data.stats.runsMonth} (oy), {data.stats.failedToday} failed
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Oxirgi kunlik hisobot</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                {data.lastDailyReport ? (
                  <>
                    <p>
                      {STATUS_LABEL[data.lastDailyReport.status] ?? data.lastDailyReport.status}
                      {data.lastDailyReport.dryRun ? " · dry-run" : ""}
                    </p>
                    <p className="text-muted-foreground">
                      {formatAsOf(data.lastDailyReport.completedAt ?? data.lastDailyReport.createdAt)}
                    </p>
                    {data.lastDailyReport.errorMessage ? (
                      <p className="text-destructive">{data.lastDailyReport.errorMessage}</p>
                    ) : null}
                  </>
                ) : (
                  <p className="text-muted-foreground">Hali hisobot yo‘q</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Jadval</CardTitle>
              </CardHeader>
              <CardContent className="text-sm">
                <p>
                  Keyingi: {data.nextScheduledRun.date} {String(data.nextScheduledRun.hour).padStart(2, "0")}:00
                </p>
                <p className="text-muted-foreground">{data.nextScheduledRun.timezone}</p>
                <p className="mt-2">
                  Dry-run:{" "}
                  <Badge variant={s?.dryRunDefault ? "secondary" : "default"}>{s?.dryRunDefault ? "default ON" : "OFF"}</Badge>
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            {data.agents.map((a) => {
              const run = a.lastRun;
              return (
                <Card key={a.agent}>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-semibold tracking-wide">{a.agent}</CardTitle>
                    <Badge variant={a.enabled ? "default" : "secondary"}>{a.enabled ? "ON" : "OFF"}</Badge>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div>
                      <p className="text-muted-foreground">Oxirgi run</p>
                      {run ? (
                        <p>
                          {STATUS_LABEL[run.status] ?? run.status} · {formatAsOf(run.completedAt ?? run.createdAt)}
                          {run.dryRun ? " · dry-run" : ""}
                        </p>
                      ) : (
                        <p className="text-muted-foreground">Hali ishga tushmagan</p>
                      )}
                    </div>
                    <div>
                      <p className="text-muted-foreground">Oxirgi natija</p>
                      {run?.status === "FAILED" ? (
                        <p className="text-destructive">{run.errorMessage ?? "Xato"}</p>
                      ) : run?.report ? (
                        <>
                          <pre className="max-h-48 overflow-y-auto whitespace-pre-wrap rounded-md bg-muted p-2 text-xs">
                            {run.report}
                          </pre>
                          <p className="mt-1 text-xs text-muted-foreground">Ma’lumot vaqti: {formatAsOf(run.dataAsOf)}</p>
                        </>
                      ) : (
                        <p className="text-muted-foreground">—</p>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full"
                      disabled={Boolean(busy) || !canRun || !a.enabled || !s?.masterEnabled}
                      onClick={() => void trigger(a.agent, a.label, { mode: "agent", agent: a.agent })}
                    >
                      {spin(a.agent) ?? <Play className="mr-2 h-4 w-4" />}
                      {a.label}ni ishga tushirish
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
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
                <div key={key} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
                  <Label htmlFor={key}>{label}</Label>
                  <Switch
                    id={key}
                    checked={Boolean(s?.[key])}
                    disabled={Boolean(busy) || !canEdit}
                    onCheckedChange={(v) => void patchSetting({ [key]: v })}
                  />
                </div>
              ))}
            </CardContent>
          </Card>

          {preview ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{preview.title}</CardTitle>
                <p className="text-xs text-muted-foreground">Ma’lumot vaqti: {formatAsOf(preview.dataAsOf)}</p>
              </CardHeader>
              <CardContent>
                <pre className="whitespace-pre-wrap rounded-md bg-muted p-4 text-sm">{preview.text}</pre>
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
                      <td className="whitespace-nowrap py-2 pr-2">{formatAsOf(a.createdAt)}</td>
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
