"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  ClipboardList,
  Loader2,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Pagination } from "@/components/shared/pagination";
import { TaskDialog } from "@/components/tasks/task-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useCollection } from "@/hooks/use-collection";
import { apiFetch, isApiConfigured } from "@/lib/api/client";
import type { Employee, WorkTask, WorkTaskStatus } from "@/types";

type Stats = {
  byStatus: Partial<Record<WorkTaskStatus, number>>;
  overdue: number;
  total: number;
};

type ListResponse = {
  data: WorkTask[];
  meta: { total: number; page: number; limit: number; totalPages: number };
};

export default function TasksPage() {
  const { data: employees } = useCollection<Employee>("employees");
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<WorkTask[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [unit, setUnit] = useState<"" | "SUNNUR" | "LWN">("");
  const [status, setStatus] = useState<"" | WorkTaskStatus>("");
  const [employeeId, setEmployeeId] = useState("");
  const [priority, setPriority] = useState("");
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selected, setSelected] = useState<WorkTask | null>(null);
  const [returnComment, setReturnComment] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const load = useCallback(async () => {
    if (!isApiConfigured) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: "20",
      });
      if (search.trim()) params.set("search", search.trim());
      if (unit) params.set("unit", unit);
      if (status) params.set("status", status);
      if (employeeId) params.set("employeeId", employeeId);
      if (priority) params.set("priority", priority);
      if (overdueOnly) params.set("overdue", "1");

      const [list, st] = await Promise.all([
        apiFetch<ListResponse>(`/tasks?${params}`),
        apiFetch<Stats>("/tasks?stats=1"),
      ]);
      setTasks(list.data ?? []);
      setTotal(list.meta?.total ?? 0);
      setTotalPages(list.meta?.totalPages ?? 1);
      setStats(st);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Yuklash xatosi");
    } finally {
      setLoading(false);
    }
  }, [page, search, unit, status, employeeId, priority, overdueOnly]);

  useEffect(() => {
    void load();
  }, [load]);

  const activeEmployees = useMemo(
    () => employees.filter((e) => e.active),
    [employees]
  );

  async function runAction(
    taskId: string,
    action: "approve" | "return" | "cancel" | "resend_telegram",
    extra?: { comment?: string; reason?: string }
  ) {
    setActionLoading(true);
    try {
      const res = await apiFetch<WorkTask | { task?: WorkTask }>(
        `/tasks/${taskId}`,
        {
          method: "POST",
          body: JSON.stringify({ action, ...extra }),
        }
      );
      toast.success("Saqlandi");
      setSelected(null);
      setReturnComment("");
      await load();
      void res;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Xatolik");
    } finally {
      setActionLoading(false);
    }
  }

  async function openDetail(id: string) {
    try {
      const task = await apiFetch<WorkTask>(`/tasks/${id}`);
      setSelected(task);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Xatolik");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Vazifalar"
        description="Sunnur/LWN xodimlariga vazifa berish va hisobotlarni kuzatish"
        action={
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Yangi vazifa
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Jami", value: stats?.total ?? 0 },
          { label: "Yangi", value: stats?.byStatus?.NEW ?? 0 },
          { label: "Hisobot", value: stats?.byStatus?.SUBMITTED ?? 0 },
          { label: "Muddati o‘tgan", value: stats?.overdue ?? 0 },
        ].map((c) => (
          <Card key={c.label}>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">{c.label}</p>
              <p className="text-2xl font-semibold">{c.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:flex-wrap md:items-end">
          <div className="relative min-w-[200px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Qidiruv..."
              value={search}
              onChange={(e) => {
                setPage(1);
                setSearch(e.target.value);
              }}
            />
          </div>
          <select
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            value={unit}
            onChange={(e) => {
              setPage(1);
              setUnit(e.target.value as typeof unit);
            }}
          >
            <option value="">Barcha kompaniyalar</option>
            <option value="SUNNUR">Sunnur</option>
            <option value="LWN">LWN</option>
          </select>
          <select
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            value={status}
            onChange={(e) => {
              setPage(1);
              setStatus(e.target.value as typeof status);
            }}
          >
            <option value="">Barcha holatlar</option>
            <option value="NEW">Yangi</option>
            <option value="IN_PROGRESS">Bajarilmoqda</option>
            <option value="SUBMITTED">Hisobot</option>
            <option value="COMPLETED">Bajarildi</option>
            <option value="NOT_COMPLETED">Bajarilmadi</option>
            <option value="CANCELLED">Bekor</option>
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
            {activeEmployees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.fullName}
              </option>
            ))}
          </select>
          <select
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            value={priority}
            onChange={(e) => {
              setPage(1);
              setPriority(e.target.value);
            }}
          >
            <option value="">Ustuvorlik</option>
            <option value="LOW">Past</option>
            <option value="NORMAL">Oddiy</option>
            <option value="HIGH">Yuqori</option>
            <option value="URGENT">Shoshilinch</option>
          </select>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={overdueOnly}
              onChange={(e) => {
                setPage(1);
                setOverdueOnly(e.target.checked);
              }}
            />
            Muddati o‘tgan
          </label>
          <Button variant="outline" size="icon" onClick={() => void load()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </CardContent>
      </Card>

      <Card className="hidden md:block">
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-2 p-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : tasks.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              title="Vazifalar yo‘q"
              description="Yangi vazifa yarating"
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sarlavha</TableHead>
                  <TableHead>Kompaniya</TableHead>
                  <TableHead>Xodim</TableHead>
                  <TableHead>Holat</TableHead>
                  <TableHead>Muddat</TableHead>
                  <TableHead>Telegram</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tasks.map((t) => (
                  <TableRow
                    key={t.id}
                    className="cursor-pointer"
                    onClick={() => void openDetail(t.id)}
                  >
                    <TableCell className="font-medium">{t.title}</TableCell>
                    <TableCell>{t.unitLabel ?? t.unit}</TableCell>
                    <TableCell>{t.employeeName}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{t.statusLabel ?? t.status}</Badge>
                      {t.overdue ? (
                        <Badge variant="destructive" className="ml-1">
                          Muddati o‘tgan
                        </Badge>
                      ) : null}
                    </TableCell>
                    <TableCell>{t.dueAtFormatted ?? "—"}</TableCell>
                    <TableCell>{t.telegramDelivery ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-3 md:hidden">
        {loading ? (
          <Skeleton className="h-24 w-full" />
        ) : tasks.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="Vazifalar yo‘q"
            description="Yangi vazifa yarating"
          />
        ) : (
          tasks.map((t) => (
            <Card
              key={t.id}
              className="cursor-pointer"
              onClick={() => void openDetail(t.id)}
            >
              <CardContent className="space-y-2 p-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium">{t.title}</p>
                  <Badge variant="outline">{t.statusLabel ?? t.status}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {t.unitLabel} · {t.employeeName}
                </p>
                <p className="text-xs text-muted-foreground">
                  Muddat: {t.dueAtFormatted ?? "—"}
                </p>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {totalPages > 1 && (
        <Pagination
          page={page}
          totalPages={totalPages}
          total={total}
          onPageChange={setPage}
        />
      )}

      <TaskDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        employees={activeEmployees}
        onCreated={() => void load()}
      />

      <Dialog
        open={Boolean(selected)}
        onOpenChange={(o) => {
          if (!o) setSelected(null);
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selected ? (
            <>
              <DialogHeader>
                <DialogTitle>{selected.title}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 text-sm">
                <p>{selected.description || "—"}</p>
                <p>
                  <b>Xodim:</b> {selected.employeeName} ({selected.companyName})
                </p>
                <p>
                  <b>Yaratgan:</b> {selected.createdByName} · {selected.source}
                </p>
                <p>
                  <b>Holat:</b> {selected.statusLabel}
                  {selected.overdue ? " · Muddati o‘tgan" : ""}
                </p>
                <p>
                  <b>Muddat:</b> {selected.dueAtFormatted}
                </p>
                {selected.failureReason ? (
                  <p>
                    <b>Sabab:</b> {selected.failureReason}
                  </p>
                ) : null}
                {selected.telegramDelivery === "FAILED" ? (
                  <p className="text-destructive">
                    Telegramga yuborilmadi: {selected.telegramLastError}
                  </p>
                ) : null}

                {selected.reports?.[0] ? (
                  <div className="rounded-md border p-3">
                    <p className="font-medium">Hisobot</p>
                    <p className="mt-1 whitespace-pre-wrap">
                      {selected.reports[0].reportText || "—"}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {selected.reports[0].attachments?.map((a) => (
                        <a
                          key={a.id}
                          href={a.storageUrl.startsWith("data:") ? undefined : a.storageUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary underline"
                          onClick={async (e) => {
                            if (a.storageUrl.startsWith("data:")) {
                              e.preventDefault();
                              toast.message("Fayl data URL (local)");
                              return;
                            }
                            try {
                              const meta = await apiFetch<{ url: string }>(
                                `/tasks/attachments/${a.id}`
                              );
                              window.open(meta.url, "_blank");
                            } catch {
                              window.open(a.storageUrl, "_blank");
                            }
                          }}
                        >
                          {a.originalName || a.type}
                        </a>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="space-y-1">
                  <p className="font-medium">Tarix</p>
                  {(selected.statusEvents ?? []).slice(0, 10).map((ev) => (
                    <p key={ev.id} className="text-xs text-muted-foreground">
                      {ev.fromStatus ?? "—"} → {ev.toStatus}
                      {ev.comment ? ` · ${ev.comment}` : ""} · {ev.source}
                    </p>
                  ))}
                </div>

                {selected.status === "SUBMITTED" ? (
                  <div className="space-y-2">
                    <Textarea
                      placeholder="Qaytarish izohi"
                      value={returnComment}
                      onChange={(e) => setReturnComment(e.target.value)}
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button
                        disabled={actionLoading}
                        onClick={() =>
                          void runAction(selected.id, "approve")
                        }
                      >
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        Tasdiqlash
                      </Button>
                      <Button
                        variant="outline"
                        disabled={actionLoading}
                        onClick={() =>
                          void runAction(selected.id, "return", {
                            comment: returnComment,
                          })
                        }
                      >
                        <RotateCcw className="mr-2 h-4 w-4" />
                        Qaytarish
                      </Button>
                    </div>
                  </div>
                ) : null}

                <DialogFooter className="flex-wrap gap-2 sm:justify-start">
                  {selected.telegramDelivery === "FAILED" ||
                  selected.telegramDelivery === "PENDING" ? (
                    <Button
                      variant="secondary"
                      disabled={actionLoading}
                      onClick={() =>
                        void runAction(selected.id, "resend_telegram")
                      }
                    >
                      <Send className="mr-2 h-4 w-4" />
                      Telegramga qayta yuborish
                    </Button>
                  ) : null}
                  {selected.status !== "COMPLETED" &&
                  selected.status !== "CANCELLED" ? (
                    <Button
                      variant="destructive"
                      disabled={actionLoading}
                      onClick={() => void runAction(selected.id, "cancel")}
                    >
                      {actionLoading ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <XCircle className="mr-2 h-4 w-4" />
                      )}
                      Bekor qilish
                    </Button>
                  ) : null}
                </DialogFooter>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
