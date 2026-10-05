"use client";

import { useState } from "react";
import { Banknote, CalendarDays, MoreVertical, Plus, Trash2, Wallet } from "lucide-react";
import { toast } from "sonner";

import { SourcePaymentDialog } from "@/components/payments/source-payment-dialog";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { useSourcePayments } from "@/hooks/use-source-payments";
import { apiFetch } from "@/lib/api/client";
import { BOOKING_STATUS_LABELS, type BookingStatus } from "@/lib/bookings";
import { PAYMENT_METHOD_MAP } from "@/lib/constants";
import {
  isPayableSource,
  PAYMENT_SUMMARY_LABELS,
  sourcePaymentTerms,
  type PaymentSummaryStatus,
  type SourceBalance,
} from "@/lib/source-payments";
import { formatCurrency, formatDate } from "@/lib/utils";
import { VEHICLE_RENTAL_STATUS_LABELS, type VehicleRentalStatus } from "@/lib/vehicle-rentals";
import type { PaymentMethod } from "@/types";

const STATUS_VARIANT: Record<PaymentSummaryStatus, "success" | "warning" | "outline"> = {
  PAID: "success",
  PARTIAL: "warning",
  UNPAID: "outline",
};

/** Payment status is separate from rental/booking status (a CONFIRMED booking may be unpaid). */
function sourceStatusLabel(b: SourceBalance) {
  return b.sourceType === "VEHICLE_RENTAL"
    ? VEHICLE_RENTAL_STATUS_LABELS[b.sourceStatus as VehicleRentalStatus]
    : BOOKING_STATUS_LABELS[b.sourceStatus as BookingStatus];
}

/** CAR_RENTAL, HOTEL_HOSTEL and VILLA_RENTAL; property industries keep the contract payments page. */
export function SourcePaymentsView({ industry }: { industry: string }) {
  const terms = sourcePaymentTerms(industry);
  const isCar = industry === "CAR_RENTAL";
  const { data, loading, error, reload } = useSourcePayments(true);
  const balances = data?.balances ?? [];
  const payments = data?.payments ?? [];

  const [dialogOpen, setDialogOpen] = useState(false);
  const [initialSourceId, setInitialSourceId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const openCreate = (sourceId: string | null = null) => {
    setInitialSourceId(sourceId);
    setDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    try {
      await apiFetch(`/source-payments/${deleteId}`, { method: "DELETE" });
      toast.success("To‘lov o‘chirildi");
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Xatolik yuz berdi");
    } finally {
      setDeleteId(null);
    }
  };

  const totalRemaining = balances
    .filter((b) => b.sourceStatus !== "CANCELLED")
    .reduce((s, b) => s + b.remaining, 0);

  const statusBadge = (status: PaymentSummaryStatus) => (
    <Badge variant={STATUS_VARIANT[status]}>{PAYMENT_SUMMARY_LABELS[status]}</Badge>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={terms.title}
        description={terms.subtitle}
        action={
          <Button onClick={() => openCreate()}>
            <Plus className="size-4" /> To‘lov qo‘shish
          </Button>
        }
      />

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          title="Bugungi tushum"
          value={formatCurrency(data?.income.today ?? 0)}
          icon={Banknote}
          tone="primary"
          loading={loading}
        />
        <StatCard
          title="Oylik tushum"
          value={formatCurrency(data?.income.month ?? 0)}
          icon={Banknote}
          tone="blue"
          loading={loading}
          index={1}
        />
        <StatCard
          title="Jami qolgan"
          value={formatCurrency(totalRemaining)}
          icon={Wallet}
          tone="rose"
          loading={loading}
          index={2}
        />
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : balances.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={CalendarDays}
                title={`Hali ${terms.source.toLowerCase()} yo‘q`}
                description={`To‘lov qabul qilish uchun avval ${terms.source.toLowerCase()} yarating.`}
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{terms.customer}</TableHead>
                    <TableHead>{terms.unit}</TableHead>
                    <TableHead>{terms.period}</TableHead>
                    <TableHead>{terms.total}</TableHead>
                    <TableHead>To‘langan</TableHead>
                    <TableHead>Qolgan</TableHead>
                    {isCar && <TableHead className="hidden lg:table-cell">Oxirgi to‘lov</TableHead>}
                    <TableHead>Holat</TableHead>
                    <TableHead className="w-12">
                      {isCar ? "Amallar" : <span className="sr-only">Amallar</span>}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {balances.map((b) => (
                    <TableRow key={b.sourceId}>
                      <TableCell className="font-medium">{b.customerName}</TableCell>
                      <TableCell>{b.unitName}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        {formatDate(b.startDate)} – {formatDate(b.endDate)}
                        <p className="text-xs text-muted-foreground">{sourceStatusLabel(b)}</p>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{formatCurrency(b.total)}</TableCell>
                      <TableCell className="whitespace-nowrap">{formatCurrency(b.paid)}</TableCell>
                      <TableCell className="whitespace-nowrap font-medium">{formatCurrency(b.remaining)}</TableCell>
                      {isCar && (
                        <TableCell className="hidden whitespace-nowrap lg:table-cell">
                          {b.lastPaymentDate ? formatDate(b.lastPaymentDate) : "—"}
                        </TableCell>
                      )}
                      <TableCell>{statusBadge(b.status)}</TableCell>
                      <TableCell>
                        {isPayableSource(b.sourceStatus, b.remaining) && (
                          <Button size="sm" variant="outline" onClick={() => openCreate(b.sourceId)}>
                            <Plus className="size-4" /> To‘lov
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {payments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">To‘lovlar tarixi</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Sana</TableHead>
                    <TableHead>{terms.customer}</TableHead>
                    <TableHead>{terms.unit}</TableHead>
                    <TableHead>Summa</TableHead>
                    <TableHead>Usul</TableHead>
                    <TableHead className="hidden lg:table-cell">Izoh</TableHead>
                    <TableHead className="w-12">
                      <span className="sr-only">Amallar</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="whitespace-nowrap">{formatDate(p.paymentDate)}</TableCell>
                      <TableCell>{p.customerName}</TableCell>
                      <TableCell>{p.unitName}</TableCell>
                      <TableCell className="whitespace-nowrap font-medium">{formatCurrency(p.amount)}</TableCell>
                      <TableCell>{PAYMENT_METHOD_MAP[p.paymentMethod.toLowerCase() as PaymentMethod]}</TableCell>
                      <TableCell className="hidden max-w-[16rem] truncate lg:table-cell">{p.notes ?? "—"}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="icon" variant="ghost" aria-label="Amallar">
                              <MoreVertical className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => setDeleteId(p.id)}
                            >
                              <Trash2 className="size-4" /> O‘chirish
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <SourcePaymentDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        balances={balances}
        initialSourceId={initialSourceId}
        terms={terms}
        onSaved={reload}
      />
      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(o) => !o && setDeleteId(null)}
        title="To‘lovni o‘chirish"
        description="To‘lov o‘chiriladi va qolgan summa qayta hisoblanadi."
        confirmText="O‘chirish"
        onConfirm={confirmDelete}
      />
    </div>
  );
}
