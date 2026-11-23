"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { AttendanceSelfieThumb } from "@/components/attendance/attendance-selfie-thumb";
import { TASK_STATUS_LABELS } from "@/lib/tasks/task-shared";

export type AttendanceDetail = {
  id: string;
  workDate: string;
  status: string;
  verificationStatus: string;
  arrivedTimeDisplay: string;
  dateDisplay: string;
  leftTimeDisplay: string | null;
  hasSelfie: boolean;
  selfieMissing: boolean;
  displayName: string;
  employee: {
    id: string;
    fullName: string;
    active: boolean;
    phone: string | null;
    position: string | null;
  };
  link: {
    id: string;
    telegramUserId: string;
    telegramUsername: string | null;
    telegramDisplayName: string | null;
    profileStatus: string;
    verifiedAt: string | null;
    registeredAt: string;
  };
  history: Array<{
    id: string;
    workDate: string;
    status: string;
    arrivedTimeDisplay: string;
    leftTimeDisplay: string | null;
    verificationStatus: string;
    hasSelfie: boolean;
  }>;
  tasks: Array<{
    id: string;
    title: string;
    status: string;
    completedTimeDisplay: string | null;
  }>;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  detail: AttendanceDetail | null;
  loading?: boolean;
};

export function AttendanceDetailSheet({
  open,
  onOpenChange,
  detail,
  loading,
}: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Davomat tafsiloti</SheetTitle>
        </SheetHeader>
        {loading || !detail ? (
          <p className="mt-6 text-sm text-muted-foreground">Yuklanmoqda…</p>
        ) : (
          <div className="mt-4 space-y-5">
            <div className="flex items-start gap-4">
              <AttendanceSelfieThumb
                checkInId={detail.id}
                hasSelfie={!detail.selfieMissing}
                size="lg"
              />
              <div className="space-y-1">
                <p className="text-lg font-semibold">{detail.displayName}</p>
                <p className="text-sm text-muted-foreground">
                  Employee: {detail.employee.fullName}
                </p>
                <div className="flex flex-wrap gap-1">
                  <Badge variant="secondary">{detail.status}</Badge>
                  <Badge
                    variant={
                      detail.verificationStatus === "VERIFIED"
                        ? "default"
                        : "outline"
                    }
                  >
                    {detail.verificationStatus === "VERIFIED"
                      ? "Tasdiqlangan"
                      : detail.verificationStatus === "REJECTED"
                        ? "Rad etilgan"
                        : "Tasdiqlanmagan"}
                  </Badge>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-muted-foreground">Sana</p>
                <p className="font-medium">{detail.dateDisplay}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Kelgan vaqt</p>
                <p className="font-medium">{detail.arrivedTimeDisplay}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Ketgan vaqt</p>
                <p className="font-medium">
                  {detail.leftTimeDisplay ?? "—"}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Lavozim</p>
                <p className="font-medium">{detail.employee.position ?? "—"}</p>
              </div>
            </div>

            <div className="rounded-md border p-3 text-sm">
              <p className="font-medium">Telegram bog‘lanish</p>
              <p className="mt-1 text-muted-foreground">
                {detail.link.telegramDisplayName || "—"}
                {detail.link.telegramUsername
                  ? ` · @${detail.link.telegramUsername}`
                  : ""}
              </p>
              <p className="text-xs text-muted-foreground">
                ID: {detail.link.telegramUserId} · Holat:{" "}
                {detail.link.profileStatus}
              </p>
              <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                Telegram ismi ishonchli shaxs identifikatsiyasi emas.
              </p>
            </div>

            <div>
              <p className="mb-2 font-medium">O‘sha kundagi vazifalar</p>
              {detail.tasks.length === 0 ? (
                <p className="text-sm text-muted-foreground">Vazifa yo‘q</p>
              ) : (
                <ul className="space-y-2">
                  {detail.tasks.map((t) => (
                    <li
                      key={t.id}
                      className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm"
                    >
                      <div>
                        <Link
                          href="/tasks"
                          className="font-medium text-primary hover:underline"
                        >
                          {t.title}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {TASK_STATUS_LABELS[
                            t.status as keyof typeof TASK_STATUS_LABELS
                          ] ?? t.status}
                          {t.completedTimeDisplay
                            ? ` · ${t.completedTimeDisplay}`
                            : ""}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <p className="mb-2 font-medium">Davomat tarixi</p>
              <ul className="space-y-1 text-sm">
                {detail.history.map((h) => (
                  <li
                    key={h.id}
                    className="flex justify-between border-b py-1 text-muted-foreground"
                  >
                    <span>{h.workDate}</span>
                    <span>
                      {h.status} · {h.arrivedTimeDisplay}
                      {h.leftTimeDisplay ? ` → ${h.leftTimeDisplay}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
