"use client";

import { useCallback, useEffect, useState } from "react";
import { ClipboardCheck, RefreshCw, Search } from "lucide-react";
import { toast } from "sonner";

import {
  AttendanceDetailSheet,
  type AttendanceDetail,
} from "@/components/attendance/attendance-detail-sheet";
import { AttendanceSelfieThumb } from "@/components/attendance/attendance-selfie-thumb";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/pagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { apiFetch, isApiConfigured } from "@/lib/api/client";

type Stats = {
  workDate: string;
  activeEmployees: number;
  presentToday: number;
  absentToday: number;
  leftToday: number;
  tasksCompleted: number;
  tasksOpen: number;
  unverifiedProfiles: number;
};

type Row = {
  id: string;
  workDate: string;
  status: string;
  verificationStatus: string;
  arrivedAt: string | null;
  arrivedTimeDisplay?: string;
  dateDisplay?: string;
  leftAt: string | null;
  leftTimeDisplay?: string | null;
  hasSelfie: boolean;
  selfieUrl: string | null;
  employee: { id: string; fullName: string; active: boolean };
  telegramDisplayName: string | null;
  telegramUsername: string | null;
  profileStatus: string;
  linkId: string;
  tasksTotal: number;
  tasksDone: number;
  tasksOpen: number;
};

type Unverified = {
  linkId: string;
  employeeId: string;
  telegramUserId: string;
  telegramUsername: string | null;
  telegramDisplayName: string | null;
  registeredAt: string;
  lastCheckInId: string | null;
  lastWorkDate: string | null;
  hasSelfie: boolean;
  selfieUrl: string | null;
  autoEmployeeName: string;
};

type EmployeeOpt = { id: string; fullName: string };

export default function AttendancePage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [items, setItems] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [workDate, setWorkDate] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [presence, setPresence] = useState("");
  const [verification, setVerification] = useState("");
  const [taskFilter, setTaskFilter] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [employees, setEmployees] = useState<EmployeeOpt[]>([]);
  const [unverified, setUnverified] = useState<Unverified[]>([]);
  const [detail, setDetail] = useState<AttendanceDetail | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const limit = 20;

  const load = useCallback(async () => {
    if (!isApiConfigured) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(limit));
      if (workDate) params.set("workDate", workDate);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      if (search.trim()) params.set("search", search.trim());
      if (presence) params.set("presence", presence);
      if (verification) params.set("verification", verification);
      if (taskFilter) params.set("taskFilter", taskFilter);
      if (employeeId) params.set("employeeId", employeeId);

      const [listRes, uvRes] = await Promise.all([
        apiFetch<{
          items: Row[];
          total: number;
          stats: Stats;
        }>(`/attendance?${params.toString()}`),
        apiFetch<{ profiles: Unverified[] }>("/attendance?view=unverified"),
      ]);
      setItems(listRes.items ?? []);
      setTotal(listRes.total ?? 0);
      setStats(listRes.stats ?? null);
      setUnverified(uvRes.profiles ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Yuklash xatosi");
    } finally {
      setLoading(false);
    }
  }, [
    page,
    workDate,
    dateFrom,
    dateTo,
    search,
    presence,
    verification,
    taskFilter,
    employeeId,
  ]);

  useEffect(() => {
    void load();
  }, [load]);

  // Soft auto-refresh every 45s
  useEffect(() => {
    const t = window.setInterval(() => {
      void load();
    }, 45_000);
    return () => window.clearInterval(t);
  }, [load]);

  useEffect(() => {
    if (!isApiConfigured) return;
    void (async () => {
      try {
        const res = await apiFetch<{ data?: EmployeeOpt[] } | EmployeeOpt[]>(
          "/employees?active=1&limit=200"
        );
        const list = Array.isArray(res)
          ? res
          : Array.isArray((res as { data?: EmployeeOpt[] }).data)
            ? (res as { data: EmployeeOpt[] }).data
            : [];
        setEmployees(
          list.map((e) => ({ id: e.id, fullName: e.fullName }))
        );
      } catch {
        /* ignore */
      }
    })();
  }, []);

  async function openDetail(id: string) {
    if (id.startsWith("absent-")) {
      toast.message("Kelmagan xodim — selfi yo‘q");
      return;
    }
    setDetailLoading(true);
    setDetailOpen(true);
    try {
      const d = await apiFetch<AttendanceDetail>(`/attendance/${id}`);
      setDetail(d);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Xatolik");
      setDetailOpen(false);
    } finally {
      setDetailLoading(false);
    }
  }

  async function profileAction(
    linkId: string,
    action: "verify" | "merge" | "reject",
    extra?: { fullName?: string; targetEmployeeId?: string; reason?: string }
  ) {
    try {
      await apiFetch(`/attendance/profiles/${linkId}`, {
        method: "POST",
        body: JSON.stringify({ action, ...extra }),
      });
      toast.success(
        action === "verify"
          ? "Profil tasdiqlandi"
          : action === "merge"
            ? "Xodim bilan birlashtirildi"
            : "Profil rad etildi"
      );
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Xatolik");
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / limit));

  const statCards = [
    { label: "Jami faol xodimlar", value: stats?.activeEmployees ?? 0 },
    { label: "Bugun kelganlar", value: stats?.presentToday ?? 0 },
    { label: "Bugun kelmaganlar", value: stats?.absentToday ?? 0 },
    { label: "Ishdan ketganlar", value: stats?.leftToday ?? 0 },
    { label: "Bajarilgan vazifalar", value: stats?.tasksCompleted ?? 0 },
    { label: "Bajarilmagan vazifalar", value: stats?.tasksOpen ?? 0 },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Davomat"
        description="Telegram guruh selfilari, kelish vaqti va vazifalar (Asia/Tashkent)"
        action={
          <Button variant="outline" onClick={() => void load()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Yangilash
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {statCards.map((c) => (
          <Card key={c.label}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground sm:text-sm">{c.label}</p>
              {loading && !stats ? (
                <Skeleton className="mt-2 h-8 w-16" />
              ) : (
                <p className="text-2xl font-semibold">{c.value}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {unverified.length > 0 ? (
        <Card>
          <CardContent className="space-y-3 p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="font-medium">
                Tasdiqlanmagan profillar ({unverified.length})
              </p>
              <p className="text-xs text-muted-foreground">
                Telegram ismi ishonchli identifikatsiya emas
              </p>
            </div>
            <div className="space-y-3">
              {unverified.map((p) => (
                <div
                  key={p.linkId}
                  className="flex flex-col gap-3 rounded-md border p-3 md:flex-row md:items-center md:justify-between"
                >
                  <div className="flex items-center gap-3">
                    <AttendanceSelfieThumb
                      checkInId={p.lastCheckInId}
                      hasSelfie={p.hasSelfie}
                      size="sm"
                    />
                    <div>
                      <p className="font-medium">
                        {p.telegramDisplayName || p.autoEmployeeName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {p.telegramUsername ? `@${p.telegramUsername} · ` : ""}
                        TG {p.telegramUserId}
                        {p.lastWorkDate ? ` · ${p.lastWorkDate}` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      onClick={() =>
                        void profileAction(p.linkId, "verify", {
                          fullName: p.telegramDisplayName || undefined,
                        })
                      }
                    >
                      Tasdiqlash
                    </Button>
                    <select
                      className="h-9 max-w-[180px] rounded-md border border-input bg-background px-2 text-sm"
                      defaultValue=""
                      onChange={(e) => {
                        const targetEmployeeId = e.target.value;
                        if (!targetEmployeeId) return;
                        void profileAction(p.linkId, "merge", {
                          targetEmployeeId,
                        });
                        e.target.value = "";
                      }}
                    >
                      <option value="">Xodimga bog‘lash…</option>
                      {employees.map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.fullName}
                        </option>
                      ))}
                    </select>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() =>
                        void profileAction(p.linkId, "reject", {
                          reason: "Admin rad etdi",
                        })
                      }
                    >
                      Rad etish
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:flex-wrap md:items-end">
          <div className="relative min-w-[180px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Xodim / Telegram qidiruv…"
              value={search}
              onChange={(e) => {
                setPage(1);
                setSearch(e.target.value);
              }}
            />
          </div>
          <Input
            type="date"
            className="w-auto"
            value={workDate}
            onChange={(e) => {
              setPage(1);
              setWorkDate(e.target.value);
            }}
            title="Sana"
          />
          <Input
            type="date"
            className="w-auto"
            value={dateFrom}
            onChange={(e) => {
              setPage(1);
              setDateFrom(e.target.value);
            }}
            title="Dan"
          />
          <Input
            type="date"
            className="w-auto"
            value={dateTo}
            onChange={(e) => {
              setPage(1);
              setDateTo(e.target.value);
            }}
            title="Gacha"
          />
          <select
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            value={presence}
            onChange={(e) => {
              setPage(1);
              setPresence(e.target.value);
            }}
          >
            <option value="">Kelganlar / hammasi</option>
            <option value="present">Kelganlar</option>
            <option value="absent">Kelmaganlar</option>
          </select>
          <select
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            value={verification}
            onChange={(e) => {
              setPage(1);
              setVerification(e.target.value);
            }}
          >
            <option value="">Tasdiq holati</option>
            <option value="VERIFIED">Tasdiqlangan</option>
            <option value="UNVERIFIED">Tasdiqlanmagan</option>
            <option value="REJECTED">Rad etilgan</option>
          </select>
          <select
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            value={taskFilter}
            onChange={(e) => {
              setPage(1);
              setTaskFilter(e.target.value);
            }}
          >
            <option value="">Vazifalar</option>
            <option value="done">Bajarilgan bor</option>
            <option value="open">Bajarilmagan bor</option>
          </select>
          <select
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            value={employeeId}
            onChange={(e) => {
              setPage(1);
              setEmployeeId(e.target.value);
            }}
          >
            <option value="">Barcha xodimlar</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.fullName}
              </option>
            ))}
          </select>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loading && items.length === 0 ? (
            <div className="space-y-2 p-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : items.length === 0 ? (
            <EmptyState
              icon={ClipboardCheck}
              title="Davomat yozuvi yo‘q"
              description="Guruhga selfi yuborilganda shu yerda paydo bo‘ladi"
            />
          ) : (
            <>
              <div className="hidden overflow-x-auto md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Selfi</TableHead>
                      <TableHead>Xodim</TableHead>
                      <TableHead>Telegram</TableHead>
                      <TableHead>Sana</TableHead>
                      <TableHead>Keldi</TableHead>
                      <TableHead>Ketdi</TableHead>
                      <TableHead>Holat</TableHead>
                      <TableHead>Tasdiq</TableHead>
                      <TableHead>Vazifalar</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((row) => (
                      <TableRow
                        key={row.id}
                        className="cursor-pointer"
                        onClick={() => void openDetail(row.id)}
                      >
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <AttendanceSelfieThumb
                            checkInId={
                              row.id.startsWith("absent-") ? null : row.id
                            }
                            hasSelfie={row.hasSelfie}
                            size="sm"
                          />
                        </TableCell>
                        <TableCell className="font-medium">
                          {row.employee.fullName}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {row.telegramDisplayName || "—"}
                          {row.telegramUsername
                            ? ` · @${row.telegramUsername}`
                            : ""}
                        </TableCell>
                        <TableCell>
                          {row.dateDisplay || row.workDate}
                        </TableCell>
                        <TableCell>
                          {row.arrivedTimeDisplay || "—"}
                        </TableCell>
                        <TableCell>
                          {row.leftTimeDisplay || "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{row.status}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              row.verificationStatus === "VERIFIED"
                                ? "default"
                                : "outline"
                            }
                          >
                            {row.verificationStatus === "VERIFIED"
                              ? "Tasdiqlangan"
                              : row.verificationStatus === "REJECTED"
                                ? "Rad"
                                : "Tasdiqlanmagan"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          {row.tasksTotal} / ✅{row.tasksDone} / ⏳
                          {row.tasksOpen}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="space-y-3 p-3 md:hidden">
                {items.map((row) => (
                  <button
                    key={row.id}
                    type="button"
                    className="flex w-full gap-3 rounded-md border p-3 text-left"
                    onClick={() => void openDetail(row.id)}
                  >
                    <AttendanceSelfieThumb
                      checkInId={row.id.startsWith("absent-") ? null : row.id}
                      hasSelfie={row.hasSelfie}
                      size="md"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">
                        {row.employee.fullName}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {row.telegramDisplayName}
                        {row.telegramUsername
                          ? ` · @${row.telegramUsername}`
                          : ""}
                      </p>
                      <p className="mt-1 text-sm">
                        {row.dateDisplay || row.workDate} ·{" "}
                        {row.arrivedTimeDisplay || "—"}
                      </p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        <Badge variant="secondary">{row.status}</Badge>
                        <Badge variant="outline">
                          {row.verificationStatus === "VERIFIED"
                            ? "Tasdiqlangan"
                            : "Tasdiqlanmagan"}
                        </Badge>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {totalPages > 1 ? (
        <Pagination
          page={page}
          totalPages={totalPages}
          total={total}
          onPageChange={setPage}
        />
      ) : null}

      <AttendanceDetailSheet
        open={detailOpen}
        onOpenChange={setDetailOpen}
        detail={detail}
        loading={detailLoading}
      />
    </div>
  );
}
