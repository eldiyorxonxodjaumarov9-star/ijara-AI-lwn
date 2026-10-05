"use client";

import { useState } from "react";
import {
  BadgeCheck,
  CalendarDays,
  LogIn,
  LogOut,
  MoreVertical,
  Pencil,
  Plus,
  Trash2,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";

import { BookingDialog } from "@/components/bookings/booking-dialog";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useBookings } from "@/hooks/use-bookings";
import { useCollection } from "@/hooks/use-collection";
import { apiFetch } from "@/lib/api/client";
import {
  availableBookingActions,
  BOOKING_ACTION_STATUS,
  BOOKING_STATUS_LABELS,
  bookingTerms,
  isClosedBooking,
  type Booking,
  type BookingAction,
  type BookingIndustry,
  type BookingStatus,
} from "@/lib/bookings";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Property, Tenant } from "@/types";

const STATUS_VARIANT: Record<BookingStatus, "success" | "secondary" | "warning" | "outline" | "default"> = {
  PENDING: "warning",
  CONFIRMED: "default",
  CHECKED_IN: "success",
  CHECKED_OUT: "secondary",
  CANCELLED: "outline",
};

type ActionKind = BookingAction;

const ACTIONS: Record<ActionKind, { label: string; icon: LucideIcon; title: string; description: string; toast: string }> = {
  confirm: {
    label: "Tasdiqlash",
    icon: BadgeCheck,
    title: "Bronni tasdiqlash",
    description: "Bron tasdiqlangan holatga o‘tadi.",
    toast: "Bron tasdiqlandi",
  },
  checkIn: {
    label: "Check-in",
    icon: LogIn,
    title: "Check-in",
    description: "Mehmon joylashdi deb belgilanadi.",
    toast: "Check-in qilindi",
  },
  checkOut: {
    label: "Check-out",
    icon: LogOut,
    title: "Check-out",
    description: "Mehmon chiqib ketdi deb belgilanadi. Bron yopiladi.",
    toast: "Check-out qilindi",
  },
  cancel: {
    label: "Bekor qilish",
    icon: XCircle,
    title: "Bronni bekor qilish",
    description: "Bron bekor qilinadi va bu sanalar bo‘shaydi.",
    toast: "Bron bekor qilindi",
  },
  delete: {
    label: "O‘chirish",
    icon: Trash2,
    title: "Bronni o‘chirish",
    description: "Bron yozuvi butunlay o‘chiriladi.",
    toast: "Bron o‘chirildi",
  },
};

/** HOTEL_HOSTEL and VILLA_RENTAL share this view; only the wording differs. */
export function BookingsView({ industry }: { industry: BookingIndustry }) {
  const terms = bookingTerms(industry);
  const { bookings, loading, error, reload } = useBookings(true);
  const { data: properties } = useCollection<Property>("properties");
  const { data: guests } = useCollection<Tenant>("tenants");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Booking | null>(null);
  const [pending, setPending] = useState<{ booking: Booking; kind: ActionKind } | null>(null);

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const runPending = async () => {
    if (!pending) return;
    const { booking, kind } = pending;
    const action = ACTIONS[kind];
    try {
      if (kind === "delete") {
        await apiFetch(`/bookings/${booking.id}`, { method: "DELETE" });
      } else {
        await apiFetch(`/bookings/${booking.id}`, { method: "PATCH", body: { status: BOOKING_ACTION_STATUS[kind] } });
      }
      toast.success(action.toast);
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Xatolik yuz berdi");
    } finally {
      setPending(null);
    }
  };

  const actions = (booking: Booking) => {
    const kinds = availableBookingActions(booking.status);
    const editable = !isClosedBooking(booking.status);
    if (!editable && kinds.length === 0) return null;
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="icon" variant="ghost" aria-label="Amallar">
            <MoreVertical className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {editable && (
            <DropdownMenuItem
              onClick={() => {
                setEditing(booking);
                setDialogOpen(true);
              }}
            >
              <Pencil className="size-4" /> Tahrirlash
            </DropdownMenuItem>
          )}
          {kinds.map((kind) => {
            const { icon: Icon, label } = ACTIONS[kind];
            return (
              <DropdownMenuItem
                key={kind}
                className={kind === "delete" ? "text-destructive focus:text-destructive" : undefined}
                onClick={() => setPending({ booking, kind })}
              >
                <Icon className="size-4" /> {label}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  const statusBadge = (status: BookingStatus) => (
    <Badge variant={STATUS_VARIANT[status]}>{BOOKING_STATUS_LABELS[status]}</Badge>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bronlar"
        description={terms.subtitle}
        action={
          <Button onClick={openCreate}>
            <Plus className="size-4" /> Bron yaratish
          </Button>
        }
      />

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : bookings.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={CalendarDays}
                title="Hali bron yo‘q"
                description={`${terms.unit} va ${terms.guest.toLowerCase()}ni tanlab birinchi bronni yarating.`}
                action={
                  <Button onClick={openCreate}>
                    <Plus className="size-4" /> Bron yaratish
                  </Button>
                }
              />
            </div>
          ) : (
            <>
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{terms.unit}</TableHead>
                      <TableHead>{terms.guest}</TableHead>
                      <TableHead>Kirish</TableHead>
                      <TableHead>Chiqish</TableHead>
                      <TableHead>Tunlar</TableHead>
                      <TableHead className="hidden lg:table-cell">Tunlik narx</TableHead>
                      <TableHead>Jami</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-12">
                        <span className="sr-only">Amallar</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bookings.map((booking) => (
                      <TableRow key={booking.id}>
                        <TableCell className="font-medium">{booking.propertyName}</TableCell>
                        <TableCell>
                          {booking.guestName}
                          <p className="text-xs text-muted-foreground">{booking.guestCount} kishi</p>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">{formatDate(booking.checkInDate)}</TableCell>
                        <TableCell className="whitespace-nowrap">{formatDate(booking.checkOutDate)}</TableCell>
                        <TableCell>{booking.nights}</TableCell>
                        <TableCell className="hidden whitespace-nowrap lg:table-cell">
                          {formatCurrency(booking.nightlyRate)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap font-medium">
                          {formatCurrency(booking.totalAmount)}
                        </TableCell>
                        <TableCell>{statusBadge(booking.status)}</TableCell>
                        <TableCell>{actions(booking)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <ul className="divide-y divide-border md:hidden">
                {bookings.map((booking) => (
                  <li key={booking.id} className="flex items-start gap-3 p-4">
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate font-medium">{booking.propertyName}</p>
                        {statusBadge(booking.status)}
                      </div>
                      <p className="text-sm">
                        {terms.guest}: {booking.guestName} • {booking.guestCount} kishi
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Kirish {formatDate(booking.checkInDate)} – Chiqish {formatDate(booking.checkOutDate)} •{" "}
                        {booking.nights} tun
                      </p>
                      <p className="text-sm font-medium">
                        {formatCurrency(booking.totalAmount)}{" "}
                        <span className="text-xs font-normal text-muted-foreground">
                          ({formatCurrency(booking.nightlyRate)} / tun)
                        </span>
                      </p>
                    </div>
                    {actions(booking)}
                  </li>
                ))}
              </ul>
            </>
          )}
        </CardContent>
      </Card>

      <BookingDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        booking={editing}
        bookings={bookings}
        properties={properties}
        guests={guests}
        terms={terms}
        onSaved={reload}
      />
      <ConfirmDialog
        open={!!pending}
        onOpenChange={(o) => !o && setPending(null)}
        title={pending ? ACTIONS[pending.kind].title : undefined}
        description={pending ? ACTIONS[pending.kind].description : undefined}
        confirmText={pending ? ACTIONS[pending.kind].label : undefined}
        onConfirm={runPending}
      />
    </div>
  );
}
