"use client";

import { useMemo, useState } from "react";
import { ScrollText } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { SmartLockAccessLogEntry } from "@/types/smart-lock";
import type { AccessLogFilters } from "@/lib/lwn-room-lock-api";

const ALL_EVENTS = "all";

const DIRECTION_LABELS: Record<
  SmartLockAccessLogEntry["direction"],
  string
> = {
  entry: "Kirish",
  exit: "Chiqish",
  unknown: "Aniqlanmagan",
};

function formatDateTimeTashkent(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("uz-UZ", {
    timeZone: "Asia/Tashkent",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export function LwnRoomAccessLogTab({
  entries,
  hasLockSettings,
  loading,
  onApplyFilters,
}: {
  entries: SmartLockAccessLogEntry[];
  hasLockSettings: boolean;
  loading: boolean;
  onApplyFilters: (filters: AccessLogFilters) => void;
}) {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [eventFilter, setEventFilter] = useState(ALL_EVENTS);

  const eventTypes = useMemo(() => {
    const set = new Set<string>();
    for (const e of entries) {
      if (e.eventType?.trim()) set.add(e.eventType);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "uz"));
  }, [entries]);

  const applyFilters = () => {
    onApplyFilters({
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      eventType: eventFilter !== ALL_EVENTS ? eventFilter : undefined,
    });
  };

  if (entries.length === 0) {
    return (
      <div className="space-y-4">
        <FilterBar
          dateFrom={dateFrom}
          dateTo={dateTo}
          eventFilter={eventFilter}
          eventTypes={eventTypes}
          onDateFromChange={setDateFrom}
          onDateToChange={setDateTo}
          onEventFilterChange={setEventFilter}
          onApply={applyFilters}
        />
        <EmptyState
          icon={ScrollText}
          title="Kirish-chiqish jurnali bo'sh"
          description={
            hasLockSettings
              ? "Qulf sozlamalari saqlangan, lekin qurilmadan hodisalar hali kelmagan."
              : "Qulf ulanmagan. Hodisalar integratsiya yoqilgach ko'rinadi."
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <FilterBar
        dateFrom={dateFrom}
        dateTo={dateTo}
        eventFilter={eventFilter}
        eventTypes={eventTypes}
        onDateFromChange={setDateFrom}
        onDateToChange={setDateTo}
        onEventFilterChange={setEventFilter}
        onApply={applyFilters}
      />
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Sana va vaqt</TableHead>
              <TableHead>Shaxs</TableHead>
              <TableHead>Hodisa</TableHead>
              <TableHead className="hidden md:table-cell">Usul</TableHead>
              <TableHead>Yo&apos;nalish</TableHead>
              <TableHead className="hidden sm:table-cell">Natija</TableHead>
              <TableHead className="hidden lg:table-cell">Manba</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-sm">
                  Yuklanmoqda...
                </TableCell>
              </TableRow>
            ) : (
              entries.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="whitespace-nowrap text-sm">
                    {formatDateTimeTashkent(row.occurredAt)}
                  </TableCell>
                  <TableCell>{row.personLabel ?? "Aniqlanmagan"}</TableCell>
                  <TableCell>{row.eventType}</TableCell>
                  <TableCell className="hidden md:table-cell">
                    {row.method ?? "—"}
                  </TableCell>
                  <TableCell>{DIRECTION_LABELS[row.direction]}</TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {row.result}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    {row.source}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function FilterBar({
  dateFrom,
  dateTo,
  eventFilter,
  eventTypes,
  onDateFromChange,
  onDateToChange,
  onEventFilterChange,
  onApply,
}: {
  dateFrom: string;
  dateTo: string;
  eventFilter: string;
  eventTypes: string[];
  onDateFromChange: (v: string) => void;
  onDateToChange: (v: string) => void;
  onEventFilterChange: (v: string) => void;
  onApply: () => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
      <div className="space-y-1.5">
        <Label htmlFor="log-from">Sanadan</Label>
        <Input
          id="log-from"
          type="date"
          value={dateFrom}
          onChange={(e) => onDateFromChange(e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="log-to">Sanagacha</Label>
        <Input
          id="log-to"
          type="date"
          value={dateTo}
          onChange={(e) => onDateToChange(e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label>Hodisa turi</Label>
        <Select value={eventFilter} onValueChange={onEventFilterChange}>
          <SelectTrigger>
            <SelectValue placeholder="Barchasi" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_EVENTS}>Barchasi</SelectItem>
            {eventTypes.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button type="button" variant="secondary" onClick={onApply}>
        Filtrlash
      </Button>
    </div>
  );
}
