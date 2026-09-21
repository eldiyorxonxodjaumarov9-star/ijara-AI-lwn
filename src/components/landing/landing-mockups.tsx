"use client";

import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  ClipboardList,
  KeyRound,
  Lock,
  TrendingUp,
  Wifi,
} from "lucide-react";

import { useLandingT } from "@/hooks/use-landing-t";
import { formatLandingMessage } from "@/lib/i18n/landing";
import { cn } from "@/lib/utils";

function WindowChrome({
  title,
  children,
  className,
  dark = true,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
  dark?: boolean;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border shadow-2xl",
        dark
          ? "border-white/10 bg-[#0b1729] shadow-blue-950/40"
          : "border-slate-200 bg-white shadow-slate-900/10",
        className
      )}
    >
      <div
        className={cn(
          "flex items-center gap-2 border-b px-4 py-3",
          dark ? "border-white/10" : "border-slate-100"
        )}
      >
        <span className="size-2.5 rounded-full bg-[#ff5f57]" />
        <span className="size-2.5 rounded-full bg-[#febc2e]" />
        <span className="size-2.5 rounded-full bg-[#28c840]" />
        <span
          className={cn(
            "ml-2 truncate text-xs font-medium",
            dark ? "text-slate-400" : "text-slate-500"
          )}
        >
          {title}
        </span>
      </div>
      {children}
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "neutral" | "good" | "warn" | "bad";
}) {
  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.04] p-3">
      <p className="text-[11px] tracking-wide text-slate-400 uppercase">{label}</p>
      <p className="mt-1 text-lg font-semibold tracking-tight text-white">{value}</p>
      {hint ? (
        <p
          className={cn(
            "mt-1 text-[11px]",
            tone === "good" && "text-emerald-400",
            tone === "warn" && "text-amber-300",
            tone === "bad" && "text-rose-300",
            tone === "neutral" && "text-slate-500"
          )}
        >
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function HeroProductVisual() {
  const t = useLandingT();

  const paymentRows = [
    {
      nameKey: "mockups.hero.payment.paid" as const,
      w: "72%",
      color: "bg-blue-500",
    },
    {
      nameKey: "mockups.hero.payment.pending" as const,
      w: "18%",
      color: "bg-amber-400",
    },
    {
      nameKey: "mockups.hero.payment.overdue" as const,
      w: "10%",
      color: "bg-rose-400",
    },
  ];

  return (
    <div className="relative mx-auto w-full max-w-[520px] lg:max-w-none">
      <div className="landing-glow pointer-events-none absolute -inset-6 rounded-[2.5rem] bg-[radial-gradient(circle_at_30%_20%,rgba(37,99,235,0.28),transparent_55%)] blur-2xl" />

      <WindowChrome title={t("mockups.hero.windowTitle")} className="relative z-10">
        <div className="p-4 sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs text-slate-400">{t("mockups.hero.network")}</p>
              <p className="text-sm font-medium text-white">
                {t("mockups.hero.statusTitle")}
              </p>
            </div>
            <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-[11px] text-emerald-300">
              {t("mockups.hero.occupancy")}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <Stat
              label={t("mockups.hero.stat.revenue.label")}
              value={t("mockups.hero.stat.revenue.value")}
              hint={t("mockups.hero.stat.revenue.hint")}
              tone="good"
            />
            <Stat
              label={t("mockups.hero.stat.expense.label")}
              value={t("mockups.hero.stat.expense.value")}
              hint={t("mockups.hero.stat.expense.hint")}
              tone="warn"
            />
            <Stat
              label={t("mockups.hero.stat.debtors.label")}
              value={t("mockups.hero.stat.debtors.value")}
              hint={t("mockups.hero.stat.debtors.hint")}
              tone="bad"
            />
            <Stat
              label={t("mockups.hero.stat.tasks.label")}
              value={t("mockups.hero.stat.tasks.value")}
              hint={t("mockups.hero.stat.tasks.hint")}
            />
          </div>

          <div className="mt-3 grid gap-2.5 sm:grid-cols-[1.3fr_1fr]">
            <div className="rounded-xl border border-white/8 bg-white/[0.03] p-3">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-[11px] text-slate-400 uppercase">
                  {t("mockups.hero.paymentsTitle")}
                </p>
                <TrendingUp className="size-3.5 text-blue-400" aria-hidden />
              </div>
              <div className="space-y-2">
                {paymentRows.map((row) => (
                  <div key={row.nameKey}>
                    <div className="mb-1 flex justify-between text-[11px] text-slate-400">
                      <span>{t(row.nameKey)}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                      <div
                        className={cn("h-full rounded-full", row.color)}
                        style={{ width: row.w }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-blue-400/20 bg-blue-500/10 p-3">
              <div className="mb-2 flex items-center gap-1.5 text-[11px] font-medium text-blue-200">
                <Bot className="size-3.5" aria-hidden />
                {t("mockups.hero.aiInsightLabel")}
              </div>
              <p className="text-sm leading-snug text-white">
                {t("mockups.hero.aiInsightText")}
              </p>
            </div>
          </div>
        </div>
      </WindowChrome>

      <div className="landing-float absolute -left-2 top-[62%] z-20 hidden w-[190px] rounded-2xl border border-white/10 bg-[#0d1c33]/95 p-3 shadow-xl shadow-black/30 backdrop-blur-md xl:block">
        <div className="mb-2 flex items-center gap-2 text-[11px] text-slate-400">
          <Lock className="size-3.5 text-blue-300" aria-hidden />
          {t("mockups.hero.lockLabel")}
        </div>
        <p className="text-sm font-medium text-white">{t("mockups.hero.lockRoom")}</p>
        <p className="mt-1 text-xs text-slate-400">{t("mockups.hero.lockPeriod")}</p>
        <div className="mt-2 flex items-center gap-1.5 text-[11px] text-emerald-300">
          <Wifi className="size-3" aria-hidden />
          {t("mockups.hero.lockGateway")}
        </div>
      </div>

      <div className="landing-float-slow absolute right-0 -bottom-5 z-20 hidden w-[210px] rounded-2xl border border-white/10 bg-[#0d1c33]/95 p-3 shadow-xl shadow-black/30 backdrop-blur-md md:block lg:right-1 xl:-right-1">
        <p className="text-[11px] tracking-wide text-slate-400 uppercase">
          {t("mockups.hero.inspectionLabel")}
        </p>
        <p className="mt-1 text-sm font-medium text-white">
          {t("mockups.hero.inspectionStatus")}
        </p>
        <p className="mt-1 text-xs leading-relaxed text-slate-400">
          {t("mockups.hero.inspectionDetail")}
        </p>
      </div>
    </div>
  );
}

export function PropertyPreview() {
  const t = useLandingT();

  const rows = [
    {
      roomKey: "mockups.property.row.1.room" as const,
      status: "occupied" as const,
      tenantKey: "mockups.property.row.1.tenant" as const,
      untilKey: "mockups.property.row.1.until" as const,
    },
    {
      roomKey: "mockups.property.row.2.room" as const,
      status: "vacant" as const,
      tenantKey: "mockups.property.row.2.tenant" as const,
      untilKey: "mockups.property.row.2.until" as const,
    },
    {
      roomKey: "mockups.property.row.3.room" as const,
      status: "occupied" as const,
      tenantKey: "mockups.property.row.3.tenant" as const,
      untilKey: "mockups.property.row.3.until" as const,
    },
  ];

  return (
    <WindowChrome title={t("mockups.property.windowTitle")}>
      <div className="space-y-3 p-4">
        {rows.map((row) => (
          <div
            key={row.roomKey}
            className="grid grid-cols-4 items-center gap-2 rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2.5 text-xs"
          >
            <span className="font-semibold text-white">
              {formatLandingMessage(t("mockups.property.roomSuffix"), {
                n: t(row.roomKey),
              })}
            </span>
            <span
              className={
                row.status === "occupied" ? "text-blue-300" : "text-emerald-300"
              }
            >
              {t(
                row.status === "occupied"
                  ? "mockups.property.status.occupied"
                  : "mockups.property.status.vacant"
              )}
            </span>
            <span className="truncate text-slate-400">{t(row.tenantKey)}</span>
            <span className="text-right text-slate-500">{t(row.untilKey)}</span>
          </div>
        ))}
      </div>
    </WindowChrome>
  );
}

export function FinancePreview() {
  const t = useLandingT();

  return (
    <WindowChrome title={t("mockups.finance.windowTitle")}>
      <div className="p-4">
        <div className="grid grid-cols-2 gap-2">
          <Stat
            label={t("mockups.finance.income.label")}
            value={t("mockups.finance.income.value")}
            hint={t("mockups.finance.income.hint")}
            tone="good"
          />
          <Stat
            label={t("mockups.finance.expense.label")}
            value={t("mockups.finance.expense.value")}
            hint={t("mockups.finance.expense.hint")}
            tone="warn"
          />
        </div>
        <div className="mt-3 rounded-xl border border-white/8 bg-white/[0.03] p-3">
          <p className="text-[11px] text-slate-400">
            {t("mockups.finance.recurringTitle")}
          </p>
          <ul className="mt-2 space-y-1.5 text-xs text-slate-300">
            <li className="flex justify-between">
              <span>{t("mockups.finance.item.electric")}</span>
              <span>{t("mockups.finance.item.electricValue")}</span>
            </li>
            <li className="flex justify-between">
              <span>{t("mockups.finance.item.water")}</span>
              <span>{t("mockups.finance.item.waterValue")}</span>
            </li>
            <li className="flex justify-between">
              <span>{t("mockups.finance.item.salary")}</span>
              <span>{t("mockups.finance.item.salaryValue")}</span>
            </li>
          </ul>
        </div>
      </div>
    </WindowChrome>
  );
}

export function TeamPreview() {
  const t = useLandingT();

  const tasks = [
    {
      taskKey: "mockups.team.task.1" as const,
      statusKey: "mockups.team.status.done" as const,
      tone: "good" as const,
    },
    {
      taskKey: "mockups.team.task.2" as const,
      statusKey: "mockups.team.status.inProgress" as const,
      tone: "warn" as const,
    },
    {
      taskKey: "mockups.team.task.3" as const,
      statusKey: "mockups.team.status.waiting" as const,
      tone: "neutral" as const,
    },
  ];

  return (
    <WindowChrome title={t("mockups.team.windowTitle")}>
      <div className="space-y-2.5 p-4">
        {tasks.map((item) => (
          <div
            key={item.taskKey}
            className="flex items-center justify-between gap-3 rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2.5"
          >
            <div className="flex items-center gap-2">
              <ClipboardList className="size-3.5 text-blue-300" />
              <span className="text-xs text-white">{t(item.taskKey)}</span>
            </div>
            <span
              className={cn(
                "shrink-0 text-[11px]",
                item.tone === "good" && "text-emerald-300",
                item.tone === "warn" && "text-amber-300",
                item.tone === "neutral" && "text-slate-400"
              )}
            >
              {t(item.statusKey)}
            </span>
          </div>
        ))}
      </div>
    </WindowChrome>
  );
}

export function AccessPreview() {
  const t = useLandingT();

  return (
    <WindowChrome title={t("mockups.access.windowTitle")}>
      <div className="p-4">
        <div className="rounded-xl border border-white/8 bg-white/[0.03] p-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-white">
              {t("mockups.access.pinTitle")}
            </p>
            <KeyRound className="size-4 text-blue-300" />
          </div>
          <p className="mt-2 font-mono text-2xl tracking-[0.3em] text-white">
            {t("mockups.access.pinValue")}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            {t("mockups.access.pinDisclaimer")}
          </p>
          <p className="mt-2 text-xs text-slate-400">
            {t("mockups.access.pinWindow")}
          </p>
        </div>
        <div className="mt-3 space-y-2 text-xs text-slate-400">
          <div className="flex justify-between rounded-lg bg-white/[0.03] px-3 py-2">
            <span>{t("mockups.access.rightsLabel")}</span>
            <span className="text-amber-300">{t("mockups.access.rightsValue")}</span>
          </div>
          <div className="flex justify-between rounded-lg bg-white/[0.03] px-3 py-2">
            <span>{t("mockups.access.lastEntryLabel")}</span>
            <span className="text-slate-300">
              {t("mockups.access.lastEntryValue")}
            </span>
          </div>
        </div>
      </div>
    </WindowChrome>
  );
}

export function AnalyticsPreview() {
  const t = useLandingT();

  return (
    <WindowChrome title={t("mockups.analytics.windowTitle")}>
      <div className="p-4 sm:p-5">
        <p className="text-sm text-slate-300">{t("mockups.analytics.summary")}</p>
        <p className="mt-1 text-4xl font-semibold tracking-tight text-white">
          {t("mockups.analytics.delta")}
        </p>
        <div className="mt-5 rounded-xl border border-white/8 bg-white/[0.03] p-3">
          <p className="text-[11px] font-medium tracking-wide text-slate-400 uppercase">
            {t("mockups.analytics.electricLabel")}
          </p>
          <dl className="mt-2 space-y-1.5 text-sm text-slate-200">
            <div className="flex justify-between gap-3">
              <dt className="text-slate-400">{t("mockups.analytics.julyLabel")}</dt>
              <dd>{t("mockups.analytics.julyValue")}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-slate-400">{t("mockups.analytics.augustLabel")}</dt>
              <dd>{t("mockups.analytics.augustValue")}</dd>
            </div>
            <div className="flex justify-between gap-3 border-t border-white/10 pt-1.5 font-medium text-rose-300">
              <dt>{t("mockups.analytics.diffLabel")}</dt>
              <dd>{t("mockups.analytics.diffValue")}</dd>
            </div>
          </dl>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <div className="rounded-xl border border-rose-400/20 bg-rose-400/10 p-3">
            <p className="text-[11px] text-rose-200">
              {t("mockups.analytics.growthLabel")}
            </p>
            <p className="mt-1 text-sm text-white">
              {t("mockups.analytics.growth.electric")}
            </p>
            <p className="text-sm text-white/80">
              {t("mockups.analytics.growth.office")}
            </p>
          </div>
          <div className="rounded-xl border border-blue-400/20 bg-blue-500/10 p-3">
            <p className="text-[11px] text-blue-200">
              {t("mockups.analytics.recoLabel")}
            </p>
            <p className="mt-1 text-sm leading-snug text-white">
              {t("mockups.analytics.recoText")}
            </p>
          </div>
        </div>
      </div>
    </WindowChrome>
  );
}

export function InspectionPreview() {
  const t = useLandingT();

  const shots = [
    {
      id: "checkIn",
      labelKey: "mockups.inspection.shot.checkIn" as const,
      tone: "from-slate-300 to-slate-500",
      showScan: false,
    },
    {
      id: "checkOut",
      labelKey: "mockups.inspection.shot.checkOut" as const,
      tone: "from-slate-400 to-blue-900",
      showScan: true,
    },
  ];

  const findings = [
    {
      itemKey: "mockups.inspection.item.wall" as const,
      resultKey: "mockups.inspection.result.wall" as const,
      Icon: CheckCircle2,
      color: "text-emerald-600",
    },
    {
      itemKey: "mockups.inspection.item.furniture" as const,
      resultKey: "mockups.inspection.result.furniture" as const,
      Icon: CheckCircle2,
      color: "text-emerald-600",
    },
    {
      itemKey: "mockups.inspection.item.table" as const,
      resultKey: "mockups.inspection.result.table" as const,
      Icon: AlertTriangle,
      color: "text-amber-600",
    },
  ];

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="grid grid-cols-2 gap-3">
        {shots.map((shot) => (
          <div
            key={shot.id}
            className="relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-100"
          >
            <div className={cn("aspect-[4/5] bg-gradient-to-br", shot.tone)}>
              <div className="absolute inset-6 rounded-lg border border-white/30 bg-white/10" />
              <div className="absolute inset-x-8 top-16 h-24 rounded bg-white/15" />
              <div className="absolute right-8 bottom-10 h-16 w-20 rounded bg-white/20" />
            </div>
            {shot.showScan ? (
              <div className="landing-scan pointer-events-none absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-blue-400/0 via-blue-300/50 to-blue-400/0" />
            ) : null}
            <p className="absolute top-3 left-3 rounded-full bg-black/50 px-2.5 py-1 text-[11px] font-medium text-white">
              {t(shot.labelKey)}
            </p>
          </div>
        ))}
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold tracking-wide text-blue-700 uppercase">
          {t("mockups.inspection.resultTitle")}
        </p>
        <ul className="mt-4 space-y-3">
          {findings.map(({ itemKey, resultKey, Icon, color }) => (
            <li key={itemKey} className="flex items-start justify-between gap-3 text-sm">
              <span className="text-slate-600">{t(itemKey)}</span>
              <span className={cn("inline-flex items-center gap-1.5 font-medium", color)}>
                <Icon className="size-3.5" aria-hidden />
                {t(resultKey)}
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-5 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {t("mockups.inspection.overall")}
        </div>
      </div>
    </div>
  );
}

export function TelegramPreview() {
  const t = useLandingT();

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <WindowChrome title={t("mockups.telegram.dashWindowTitle")} dark={false}>
        <div className="space-y-3 p-4 text-sm">
          <p className="font-medium text-slate-900">{t("mockups.telegram.manager")}</p>
          <div className="rounded-xl bg-slate-50 px-3 py-2.5 text-slate-700">
            {t("mockups.telegram.taskText")}
          </div>
          <p className="text-xs text-slate-500">{t("mockups.telegram.dashStatus")}</p>
        </div>
      </WindowChrome>
      <WindowChrome title={t("mockups.telegram.tgWindowTitle")}>
        <div className="space-y-3 p-4 text-sm">
          <div className="max-w-[90%] rounded-2xl rounded-tl-md bg-white/10 px-3 py-2 text-slate-100">
            {t("mockups.telegram.taskText")}
          </div>
          <div className="ml-auto max-w-[90%] rounded-2xl rounded-tr-md bg-blue-600 px-3 py-2 text-white">
            {t("mockups.telegram.reply")}
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-xs text-slate-300">
            <p className="font-medium text-slate-100">
              {t("mockups.telegram.reportTitle")}
            </p>
            <p className="mt-1.5">{t("mockups.telegram.reportNote")}</p>
            <p className="mt-1">{t("mockups.telegram.reportMeta")}</p>
          </div>
        </div>
      </WindowChrome>
    </div>
  );
}
