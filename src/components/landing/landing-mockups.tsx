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
  return (
    <div className="relative mx-auto w-full max-w-[520px] lg:max-w-none">
      <div className="landing-glow pointer-events-none absolute -inset-6 rounded-[2.5rem] bg-[radial-gradient(circle_at_30%_20%,rgba(37,99,235,0.28),transparent_55%)] blur-2xl" />

      <WindowChrome title="Arenda AI · Boshqaruv paneli" className="relative z-10">
        <div className="p-4 sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs text-slate-400">Live Work Network · Avgust 2026</p>
              <p className="text-sm font-medium text-white">Operatsion holat</p>
            </div>
            <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-[11px] text-emerald-300">
              42 / 48 band
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <Stat label="Oylik daromad" value="186.4 mln" hint="+6.1%" tone="good" />
            <Stat label="Xarajat" value="41.2 mln" hint="+12.8%" tone="warn" />
            <Stat label="Qarzdorlar" value="7 ta" hint="19.8 mln" tone="bad" />
            <Stat label="Vazifalar" value="12" hint="4 kutilmoqda" />
          </div>

          <div className="mt-3 grid gap-2.5 sm:grid-cols-[1.3fr_1fr]">
            <div className="rounded-xl border border-white/8 bg-white/[0.03] p-3">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-[11px] text-slate-400 uppercase">To‘lov statuslari</p>
                <TrendingUp className="size-3.5 text-blue-400" aria-hidden />
              </div>
              <div className="space-y-2">
                {[
                  { name: "To‘langan", w: "72%", color: "bg-blue-500" },
                  { name: "Kutilmoqda", w: "18%", color: "bg-amber-400" },
                  { name: "Kechikkan", w: "10%", color: "bg-rose-400" },
                ].map((row) => (
                  <div key={row.name}>
                    <div className="mb-1 flex justify-between text-[11px] text-slate-400">
                      <span>{row.name}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                      <div className={cn("h-full rounded-full", row.color)} style={{ width: row.w }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-blue-400/20 bg-blue-500/10 p-3">
              <div className="mb-2 flex items-center gap-1.5 text-[11px] font-medium text-blue-200">
                <Bot className="size-3.5" aria-hidden />
                AI insight
              </div>
              <p className="text-sm leading-snug text-white">
                Avgust oyida elektr xarajati iyulga nisbatan 18% oshgan.
              </p>
            </div>
          </div>
        </div>
      </WindowChrome>

      <div className="landing-float absolute -left-2 top-[62%] z-20 hidden w-[190px] rounded-2xl border border-white/10 bg-[#0d1c33]/95 p-3 shadow-xl shadow-black/30 backdrop-blur-md xl:block">
        <div className="mb-2 flex items-center gap-2 text-[11px] text-slate-400">
          <Lock className="size-3.5 text-blue-300" aria-hidden />
          Smart Lock
        </div>
        <p className="text-sm font-medium text-white">305-xona · PIN faol</p>
        <p className="mt-1 text-xs text-slate-400">Muddat: 15.09 — 15.10</p>
        <div className="mt-2 flex items-center gap-1.5 text-[11px] text-emerald-300">
          <Wifi className="size-3" aria-hidden />
          Gateway ulangan
        </div>
      </div>

      <div className="landing-float-slow absolute right-0 -bottom-5 z-20 hidden w-[210px] rounded-2xl border border-white/10 bg-[#0d1c33]/95 p-3 shadow-xl shadow-black/30 backdrop-blur-md md:block lg:right-1 xl:-right-1">
        <p className="text-[11px] tracking-wide text-slate-400 uppercase">305-xona · AI tekshiruv</p>
        <p className="mt-1 text-sm font-medium text-white">Holat: tekshirish kerak</p>
        <p className="mt-1 text-xs leading-relaxed text-slate-400">
          2 ta o‘zgarish aniqlandi · stol yuzasida tirnalish
        </p>
      </div>
    </div>
  );
}

export function PropertyPreview() {
  return (
    <WindowChrome title="Mulklar · LWN">
      <div className="space-y-3 p-4">
        {[
          ["305", "Band", "Karimov a.", "30.11.2026"],
          ["307", "Bo‘sh", "—", "—"],
          ["412", "Band", "Saidova N.", "01.03.2027"],
        ].map(([room, status, tenant, until]) => (
          <div
            key={room}
            className="grid grid-cols-4 items-center gap-2 rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2.5 text-xs"
          >
            <span className="font-semibold text-white">{room}-xona</span>
            <span className={status === "Band" ? "text-blue-300" : "text-emerald-300"}>
              {status}
            </span>
            <span className="truncate text-slate-400">{tenant}</span>
            <span className="text-right text-slate-500">{until}</span>
          </div>
        ))}
      </div>
    </WindowChrome>
  );
}

export function FinancePreview() {
  return (
    <WindowChrome title="Moliya · oylararo">
      <div className="p-4">
        <div className="grid grid-cols-2 gap-2">
          <Stat label="Kirim" value="186.4 mln" hint="Avgust" tone="good" />
          <Stat label="Chiqim" value="41.2 mln" hint="Iyul: 36.5" tone="warn" />
        </div>
        <div className="mt-3 rounded-xl border border-white/8 bg-white/[0.03] p-3">
          <p className="text-[11px] text-slate-400">Takroriy xarajatlar</p>
          <ul className="mt-2 space-y-1.5 text-xs text-slate-300">
            <li className="flex justify-between">
              <span>Elektr</span>
              <span>8.4 mln</span>
            </li>
            <li className="flex justify-between">
              <span>Suv</span>
              <span>2.1 mln</span>
            </li>
            <li className="flex justify-between">
              <span>Maosh</span>
              <span>18.0 mln</span>
            </li>
          </ul>
        </div>
      </div>
    </WindowChrome>
  );
}

export function TeamPreview() {
  return (
    <WindowChrome title="Vazifalar · jamoa">
      <div className="space-y-2.5 p-4">
        {[
          ["305-xonani tekshiring", "Bajarildi", "good"],
          ["412 PIN yangilash", "Jarayonda", "warn"],
          ["Qarzdorlarga eslatma", "Kutilmoqda", "neutral"],
        ].map(([task, status, tone]) => (
          <div
            key={task}
            className="flex items-center justify-between gap-3 rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2.5"
          >
            <div className="flex items-center gap-2">
              <ClipboardList className="size-3.5 text-blue-300" />
              <span className="text-xs text-white">{task}</span>
            </div>
            <span
              className={cn(
                "shrink-0 text-[11px]",
                tone === "good" && "text-emerald-300",
                tone === "warn" && "text-amber-300",
                tone === "neutral" && "text-slate-400"
              )}
            >
              {status}
            </span>
          </div>
        ))}
      </div>
    </WindowChrome>
  );
}

export function AccessPreview() {
  return (
    <WindowChrome title="TTLock · kirish">
      <div className="p-4">
        <div className="rounded-xl border border-white/8 bg-white/[0.03] p-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-white">305 · vaqtli PIN</p>
            <KeyRound className="size-4 text-blue-300" />
          </div>
          <p className="mt-2 font-mono text-2xl tracking-[0.3em] text-white">4821</p>
          <p className="mt-2 text-xs text-slate-400">15.09.2026 09:00 — 15.10.2026 18:00</p>
        </div>
        <div className="mt-3 space-y-2 text-xs text-slate-400">
          <div className="flex justify-between rounded-lg bg-white/[0.03] px-3 py-2">
            <span>Huquq</span>
            <span className="text-emerald-300">Faol</span>
          </div>
          <div className="flex justify-between rounded-lg bg-white/[0.03] px-3 py-2">
            <span>Oxirgi kirish</span>
            <span className="text-slate-300">bugun 08:14</span>
          </div>
        </div>
      </div>
    </WindowChrome>
  );
}

export function AnalyticsPreview() {
  return (
    <WindowChrome title="AI tahlil · Avgust / Iyul">
      <div className="p-4 sm:p-5">
        <p className="text-sm text-slate-300">Avgust xarajatlari iyulga nisbatan</p>
        <p className="mt-1 text-4xl font-semibold tracking-tight text-white">+12.8%</p>
        <div className="mt-5 rounded-xl border border-white/8 bg-white/[0.03] p-3">
          <p className="text-[11px] font-medium tracking-wide text-slate-400 uppercase">
            Elektr
          </p>
          <dl className="mt-2 space-y-1.5 text-sm text-slate-200">
            <div className="flex justify-between gap-3">
              <dt className="text-slate-400">Iyul</dt>
              <dd>1 250 000 so‘m</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-slate-400">Avgust</dt>
              <dd>1 550 000 so‘m</dd>
            </div>
            <div className="flex justify-between gap-3 border-t border-white/10 pt-1.5 font-medium text-rose-300">
              <dt>Farq</dt>
              <dd>+300 000 so‘m (+24%)</dd>
            </div>
          </dl>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <div className="rounded-xl border border-rose-400/20 bg-rose-400/10 p-3">
            <p className="text-[11px] text-rose-200">Eng katta o‘sish</p>
            <p className="mt-1 text-sm text-white">Elektr +24%</p>
            <p className="text-sm text-white/80">Ofis jihozlari +11%</p>
          </div>
          <div className="rounded-xl border border-blue-400/20 bg-blue-500/10 p-3">
            <p className="text-[11px] text-blue-200">Tavsiya</p>
            <p className="mt-1 text-sm leading-snug text-white">
              Elektr sarfini 305 va 307-xonalarda tekshiring.
            </p>
          </div>
        </div>
      </div>
    </WindowChrome>
  );
}

export function InspectionPreview() {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: "Kirishda", tone: "from-slate-300 to-slate-500" },
          { label: "Chiqishda", tone: "from-slate-400 to-blue-900" },
        ].map((shot) => (
          <div
            key={shot.label}
            className="relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-100"
          >
            <div className={cn("aspect-[4/5] bg-gradient-to-br", shot.tone)}>
              <div className="absolute inset-6 rounded-lg border border-white/30 bg-white/10" />
              <div className="absolute inset-x-8 top-16 h-24 rounded bg-white/15" />
              <div className="absolute right-8 bottom-10 h-16 w-20 rounded bg-white/20" />
            </div>
            {shot.label === "Chiqishda" ? (
              <div className="landing-scan pointer-events-none absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-blue-400/0 via-blue-300/50 to-blue-400/0" />
            ) : null}
            <p className="absolute top-3 left-3 rounded-full bg-black/50 px-2.5 py-1 text-[11px] font-medium text-white">
              {shot.label}
            </p>
          </div>
        ))}
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold tracking-wide text-blue-700 uppercase">
          305-xona · AI natija
        </p>
        <ul className="mt-4 space-y-3">
          {(
            [
              {
                item: "Devor",
                result: "O‘zgarish yo‘q",
                Icon: CheckCircle2,
                color: "text-emerald-600",
              },
              {
                item: "Mebel",
                result: "Normal",
                Icon: CheckCircle2,
                color: "text-emerald-600",
              },
              {
                item: "Stol",
                result: "Tirnalish aniqlandi",
                Icon: AlertTriangle,
                color: "text-amber-600",
              },
            ] as const
          ).map(({ item, result, Icon, color }) => (
            <li key={item} className="flex items-start justify-between gap-3 text-sm">
              <span className="text-slate-600">{item}</span>
              <span className={cn("inline-flex items-center gap-1.5 font-medium", color)}>
                <Icon className="size-3.5" aria-hidden />
                {result}
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-5 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Umumiy holat: qo‘shimcha tekshiruv tavsiya etiladi
        </div>
      </div>
    </div>
  );
}

export function TelegramPreview() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <WindowChrome title="Dashboard · vazifa" dark={false}>
        <div className="space-y-3 p-4 text-sm">
          <p className="font-medium text-slate-900">Menejer</p>
          <div className="rounded-xl bg-slate-50 px-3 py-2.5 text-slate-700">
            305-xonani tekshiring
          </div>
          <p className="text-xs text-slate-500">Status: yuborildi · Telegramga yetkazildi</p>
        </div>
      </WindowChrome>
      <WindowChrome title="Telegram · xodim">
        <div className="space-y-3 p-4 text-sm">
          <div className="max-w-[90%] rounded-2xl rounded-tl-md bg-white/10 px-3 py-2 text-slate-100">
            305-xonani tekshiring
          </div>
          <div className="ml-auto max-w-[90%] rounded-2xl rounded-tr-md bg-blue-600 px-3 py-2 text-white">
            Bajarildi
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-xs text-slate-300">
            <p className="font-medium text-slate-100">Hisobot</p>
            <p className="mt-1.5">Izoh: Koridor toza, lampa almashtirildi.</p>
            <p className="mt-1">Rasm · 14:22 · Status: bajarildi</p>
          </div>
        </div>
      </WindowChrome>
    </div>
  );
}
