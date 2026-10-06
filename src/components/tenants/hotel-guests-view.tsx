"use client";

import { useMemo, useState } from "react";
import {
  BedDouble,
  CalendarClock,
  LogIn,
  LogOut,
  MoreVertical,
  Pencil,
  Plus,
  Search,
  UserCheck,
  UserX,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";

import { SourcePaymentDialog } from "@/components/payments/source-payment-dialog";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { HotelArrivalDialog } from "@/components/tenants/hotel-arrival-dialog";
import { HotelGuestDialog } from "@/components/tenants/hotel-guest-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { useAuth } from "@/context/auth-context";
import { useTashkentNow } from "@/context/tashkent-time-context";
import { useBookings } from "@/hooks/use-bookings";
import { useCollection } from "@/hooks/use-collection";
import { useHotelGuests } from "@/hooks/use-hotel-guests";
import { apiFetch } from "@/lib/api/client";
import {
  ARRIVAL_STATUS_LABELS,
  BOOKING_STATUS_LABELS,
  canTransition,
  isClosedBooking,
  selectExpectedArrivals,
  selectOverdueArrivals,
  tashkentToday,
  type BookingStatus,
} from "@/lib/bookings";
import type { HotelGuestRow } from "@/lib/hotel-guests";
import { sourcePaymentTerms, type SourceBalance } from "@/lib/source-payments";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Property } from "@/types";

const STATUS_VARIANT: Record<BookingStatus, "success" | "secondary" | "warning" | "outline" | "default"> = {
  PENDING: "warning",
  CONFIRMED: "default",
  CHECKED_IN: "success",
  CHECKED_OUT: "secondary",
  CANCELLED: "outline",
};

type StatusAction = "checkIn" | "checkOut";

const STATUS_ACTIONS: Record<
  StatusAction,
  { label: string; icon: LucideIcon; status: BookingStatus; title: string; description: string; toast: string }
> = {
  checkIn: {
    label: "Check-in",
    icon: LogIn,
    status: "CHECKED_IN",
    title: "Check-in",
    description: "Mehmon xonaga joylashdi deb belgilanadi.",
    toast: "Check-in qilindi",
  },
  checkOut: {
    label: "Check-out",
    icon: LogOut,
    status: "CHECKED_OUT",
    title: "Check-out",
    description: "Mehmon chiqib ketdi. Xona bo‘shaydi, bron va to‘lov tarixi saqlanadi.",
    toast: "Check-out qilindi",
  },
};

const toBalance = (row: HotelGuestRow): SourceBalance => ({
  total: row.totalAmount,
  paid: row.paid,
  remaining: row.remaining,
  status: row.paymentStatus,
  sourceType: "BOOKING",
  sourceId: row.bookingId,
  sourceStatus: row.status,
  customerName: row.fullName,
  unitName: row.propertyName,
  startDate: row.checkInDate,
  endDate: row.checkOutDate,
  lastPaymentDate: row.lastPaymentDate,
  paymentCount: row.paymentCount,
});

type Tab = "inHouse" | "history";

/**
 * HOTEL_HOSTEL guests. Reservations arriving today wait for "Keldi" / "Kelmadi";
 * only arrived guests (CHECKED_IN) are listed as placed. One row per stay.
 */
export function HotelGuestsView() {
  const { user } = useAuth();
  const canPay = user?.role !== "employee";
  const today = tashkentToday(useTashkentNow());
  const { list, loading, error, reload } = useHotelGuests(true);
  const { bookings, reload: reloadBookings } = useBookings(true);
  const { data: properties } = useCollection<Property>("properties");

  const [tab, setTab] = useState<Tab>("inHouse");
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<HotelGuestRow | null>(null);
  const [pending, setPending] = useState<{ row: HotelGuestRow; kind: StatusAction } | null>(null);
  const [paying, setPaying] = useState<HotelGuestRow | null>(null);
  const [arriving, setArriving] = useState<HotelGuestRow | null>(null);
  const [noShow, setNoShow] = useState<HotelGuestRow | null>(null);

  const refresh = async () => {
    await Promise.all([reload(), reloadBookings()]);
  };

  const expected = useMemo(() => selectExpectedArrivals(list.rows, today), [list.rows, today]);
  const overdue = useMemo(() => selectOverdueArrivals(list.rows, today), [list.rows, today]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return list.rows.filter((r) => {
      const inTab = tab === "inHouse" ? r.status === "CHECKED_IN" : isClosedBooking(r.status);
      if (!inTab) return false;
      if (!q) return true;
      return [r.fullName, r.phone, r.propertyName].some((v) => v.toLowerCase().includes(q));
    });
  }, [list.rows, search, tab]);

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const runPending = async () => {
    if (!pending) return;
    const action = STATUS_ACTIONS[pending.kind];
    try {
      await apiFetch(`/bookings/${pending.row.bookingId}`, { method: "PATCH", body: { status: action.status } });
      toast.success(action.toast);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Xatolik yuz berdi");
    } finally {
      setPending(null);
    }
  };

  const runNoShow = async () => {
    if (!noShow) return;
    try {
      await apiFetch(`/hotel-guests/${noShow.bookingId}/no-show`, { method: "POST", body: {} });
      toast.success("Mehmon kelmadi deb belgilandi");
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Xatolik yuz berdi");
    } finally {
      setNoShow(null);
    }
  };

  const statusActions = (row: HotelGuestRow): StatusAction[] => {
    const out: StatusAction[] = [];
    if (row.tenantId && canTransition(row.status, "CHECKED_IN") && row.checkInDate <= today) out.push("checkIn");
    if (canTransition(row.status, "CHECKED_OUT")) out.push("checkOut");
    return out;
  };

  const actions = (row: HotelGuestRow) => {
    const kinds = statusActions(row);
    const editable = !isClosedBooking(row.status);
    const payable = canPay && row.status !== "CANCELLED" && row.remaining > 0;
    if (!editable && !payable && kinds.length === 0) return null;
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="icon" variant="ghost" aria-label="Amallar">
            <MoreVertical className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {kinds.map((kind) => {
            const { icon: Icon, label } = STATUS_ACTIONS[kind];
            return (
              <DropdownMenuItem key={kind} onClick={() => setPending({ row, kind })}>
                <Icon className="size-4" /> {label}
              </DropdownMenuItem>
            );
          })}
          {payable && (
            <DropdownMenuItem onClick={() => setPaying(row)}>
              <Wallet className="size-4" /> To‘lov qo‘shish
            </DropdownMenuItem>
          )}
          {editable && (
            <DropdownMenuItem
              onClick={() => {
                setEditing(row);
                setDialogOpen(true);
              }}
            >
              <Pencil className="size-4" /> Tahrirlash
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  const statusBadge = (row: HotelGuestRow) =>
    row.arrivalStatus === "NO_SHOW" ? (
      <Badge variant="destructive">{ARRIVAL_STATUS_LABELS.NO_SHOW}</Badge>
    ) : (
      <Badge variant={STATUS_VARIANT[row.status]}>{BOOKING_STATUS_LABELS[row.status]}</Badge>
    );

  const arrivalCard = (row: HotelGuestRow, late: boolean) => (
    <li key={row.bookingId} className="flex flex-col gap-3 rounded-xl border border-border bg-card/60 p-4">
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate font-semibold">{row.fullName}</p>
          {late && <Badge variant="warning">Kelmadi belgilanmagan</Badge>}
        </div>
        {row.phone && <p className="text-xs text-muted-foreground">{row.phone}</p>}
        <p className="text-sm">
          {row.propertyName} • {row.guestCount} kishi
        </p>
        <p className="text-xs text-muted-foreground">
          {formatDate(row.checkInDate)} → {formatDate(row.checkOutDate)} • {row.nights} tun
        </p>
        <p className="text-sm">
          Jami <span className="font-semibold">{formatCurrency(row.totalAmount)}</span>
          {row.paid > 0 && <span className="text-xs text-muted-foreground"> · oldin to‘langan {formatCurrency(row.paid)}</span>}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Button onClick={() => setArriving(row)}>
          <UserCheck className="size-4" /> Keldi
        </Button>
        <Button variant="outline" className="text-destructive hover:text-destructive" onClick={() => setNoShow(row)}>
          <UserX className="size-4" /> Kelmadi
        </Button>
      </div>
    </li>
  );

  const paidCell = (row: HotelGuestRow) => <span className="text-emerald-400">{formatCurrency(row.paid)}</span>;
  const remainingCell = (row: HotelGuestRow) => (
    <span className={row.remaining > 0 ? "text-amber-400" : "text-muted-foreground"}>{formatCurrency(row.remaining)}</span>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mehmonlar"
        description="Bugun keladigan bronlar va joylashgan mehmonlar. Check-out qilinganda xona bo‘shaydi, tarix saqlanadi."
        action={
          <Button onClick={openCreate}>
            <Plus className="size-4" /> Mehmon qo&apos;shish
          </Button>
        }
      />

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <section className="space-y-3" aria-labelledby="expected-arrivals">
        <h2 id="expected-arrivals" className="flex items-center gap-2 text-base font-semibold">
          <CalendarClock className="size-4 text-sky-400" /> Bugun kutilayotgan mehmonlar
          <Badge variant="secondary">{expected.length}</Badge>
        </h2>
        {loading && list.rows.length === 0 ? (
          <Skeleton className="h-32 w-full" />
        ) : expected.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
            Bugun kutilayotgan mehmon yo‘q.
          </p>
        ) : (
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {expected.map((row) => arrivalCard(row, false))}
          </ul>
        )}
      </section>

      {overdue.length > 0 && (
        <section className="space-y-3" aria-labelledby="overdue-arrivals">
          <h2 id="overdue-arrivals" className="flex items-center gap-2 text-base font-semibold">
            Kechikkan kelishlar <Badge variant="warning">{overdue.length}</Badge>
          </h2>
          <p className="text-xs text-muted-foreground">Kelish kuni o‘tgan, lekin «Keldi» yoki «Kelmadi» belgilanmagan bronlar.</p>
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {overdue.map((row) => arrivalCard(row, true))}
          </ul>
        </section>
      )}

      <section className="space-y-3" aria-labelledby="in-house-guests">
        <h2 id="in-house-guests" className="text-base font-semibold">
          Joylashgan mehmonlar
        </h2>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="inline-flex rounded-lg border border-border p-1" role="tablist" aria-label="Mehmonlar filtri">
            {(
              [
                ["inHouse", "Joylashgan"],
                ["history", "Tarix"],
              ] as const
            ).map(([value, label]) => (
              <Button
                key={value}
                type="button"
                role="tab"
                aria-selected={tab === value}
                size="sm"
                variant={tab === value ? "default" : "ghost"}
                onClick={() => setTab(value)}
              >
                {label}
              </Button>
            ))}
          </div>
          <div className="relative w-full sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Ism, telefon yoki xona bo'yicha..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <Card>
          <CardContent className="p-0">
            {loading && list.rows.length === 0 ? (
              <div className="space-y-2 p-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : rows.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  icon={BedDouble}
                  title={tab === "inHouse" ? "Joylashgan mehmon yo‘q" : "Tarix bo‘sh"}
                  description={
                    tab === "inHouse"
                      ? "Bron qilingan mehmon kelganda «Keldi» tugmasini bosing."
                      : "Check-out qilingan va kelmagan mehmonlar shu yerda ko‘rinadi."
                  }
                />
              </div>
            ) : (
              <>
                <div className="hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>F.I.O</TableHead>
                        <TableHead>Telefon</TableHead>
                        <TableHead>Xona</TableHead>
                        <TableHead>Odam soni</TableHead>
                        <TableHead>Kirish</TableHead>
                        <TableHead>Chiqish</TableHead>
                        <TableHead className="text-right">Jami</TableHead>
                        <TableHead className="text-right">To‘langan</TableHead>
                        <TableHead className="text-right">Qolgan</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="w-12">
                          <span className="sr-only">Amallar</span>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((row) => (
                        <TableRow key={row.bookingId}>
                          <TableCell className="font-medium">{row.fullName}</TableCell>
                          <TableCell className="whitespace-nowrap text-sm text-muted-foreground">{row.phone || "—"}</TableCell>
                          <TableCell>
                            <Badge variant="secondary">{row.propertyName}</Badge>
                          </TableCell>
                          <TableCell>{row.guestCount} kishi</TableCell>
                          <TableCell className="whitespace-nowrap">{formatDate(row.checkInDate)}</TableCell>
                          <TableCell className="whitespace-nowrap">
                            {formatDate(row.checkOutDate)}
                            <p className="text-xs text-muted-foreground">{row.nights} tun</p>
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-right">{formatCurrency(row.totalAmount)}</TableCell>
                          <TableCell className="whitespace-nowrap text-right">{paidCell(row)}</TableCell>
                          <TableCell className="whitespace-nowrap text-right">{remainingCell(row)}</TableCell>
                          <TableCell>{statusBadge(row)}</TableCell>
                          <TableCell>{actions(row)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <ul className="divide-y divide-border md:hidden">
                  {rows.map((row) => (
                    <li key={row.bookingId} className="flex items-start gap-3 p-4">
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate font-medium">{row.fullName}</p>
                          {statusBadge(row)}
                        </div>
                        {row.phone && <p className="text-xs text-muted-foreground">{row.phone}</p>}
                        <p className="text-sm">
                          {row.propertyName} • {row.guestCount} kishi
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Kirish {formatDate(row.checkInDate)} – Chiqish {formatDate(row.checkOutDate)} • {row.nights} tun
                        </p>
                        <p className="text-sm">
                          <span className="text-xs text-muted-foreground">Jami </span>
                          {formatCurrency(row.totalAmount)}
                          <span className="text-xs text-muted-foreground"> · To‘langan </span>
                          {paidCell(row)}
                          <span className="text-xs text-muted-foreground"> · Qolgan </span>
                          {remainingCell(row)}
                        </p>
                      </div>
                      {actions(row)}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </CardContent>
        </Card>
      </section>

      {list.unplaced.length > 0 && (
        <Card>
          <CardContent className="space-y-2 p-4">
            <p className="text-sm font-medium">Xonaga joylashtirilmagan mehmonlar</p>
            <p className="text-xs text-muted-foreground">
              Eski yozuvlar: bronga bog‘lanmagan. Klient bazasida saqlanadi.
            </p>
            <ul className="flex flex-wrap gap-2">
              {list.unplaced.map((g) => (
                <li key={g.tenantId}>
                  <Badge variant="outline">
                    {g.fullName}
                    {g.phone ? ` · ${g.phone}` : ""}
                  </Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <HotelGuestDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        row={editing}
        properties={properties}
        bookings={bookings}
        canPay={canPay}
        onSaved={refresh}
      />
      <HotelArrivalDialog
        row={arriving}
        canPay={canPay}
        onOpenChange={(o) => !o && setArriving(null)}
        onSaved={refresh}
      />
      <SourcePaymentDialog
        open={!!paying}
        onOpenChange={(o) => !o && setPaying(null)}
        balances={paying ? [toBalance(paying)] : []}
        initialSourceId={paying?.bookingId ?? null}
        terms={sourcePaymentTerms("HOTEL_HOSTEL")}
        onSaved={refresh}
      />
      <ConfirmDialog
        open={!!pending}
        onOpenChange={(o) => !o && setPending(null)}
        title={pending ? STATUS_ACTIONS[pending.kind].title : undefined}
        description={pending ? STATUS_ACTIONS[pending.kind].description : undefined}
        confirmText={pending ? STATUS_ACTIONS[pending.kind].label : undefined}
        onConfirm={runPending}
      />
      <ConfirmDialog
        open={!!noShow}
        onOpenChange={(o) => !o && setNoShow(null)}
        title="Mehmon kelmadi deb belgilaysizmi?"
        description="Bron bekor qilinadi va xona bu sanalar uchun bo‘shaydi. Mehmon yozuvi va to‘lov yaratilmaydi, tarix saqlanadi."
        confirmText="Kelmadi"
        onConfirm={runNoShow}
      />
    </div>
  );
}
