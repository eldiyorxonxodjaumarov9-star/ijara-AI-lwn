"use client";

import { useMemo, useState } from "react";
import {
  Link2,
  LogOut,
  MoreVertical,
  Pencil,
  Plus,
  Search,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/shared/page-header";
import { SendPaymentRemindersButton } from "@/components/shared/send-payment-reminders-button";
import { EmptyState } from "@/components/shared/empty-state";
import { Pagination } from "@/components/shared/pagination";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { TenantDialog } from "@/components/tenants/tenant-dialog";
import { TenantAssignDialog } from "@/components/tenants/tenant-assign-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Avatar,
  AvatarFallback,
} from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCollection, useCollectionActions } from "@/hooks/use-collection";
import { useIndustryTerminology } from "@/hooks/use-industry-terminology";
import { useTableData } from "@/hooks/use-table-data";
import { isApiConfigured } from "@/lib/api/client";
import { refreshCollection } from "@/lib/data/store";
import { getTenantRoomMaps } from "@/lib/tenant-room-assign";
import {
  checkoutTenantApi,
  checkoutTenantLocal,
} from "@/lib/tenant-checkout-client";
import {
  checkoutSuccessMessage,
  formatCheckoutDebt,
  previewCheckoutDebt,
  type CheckoutDebtDecision,
} from "@/lib/tenant-checkout-debt";
import { formatTashkentDate, getTashkentDateParts } from "@/lib/payment-due-schedule";
import { useTashkentNow } from "@/context/tashkent-time-context";
import { cn, formatCurrency, formatDate, getInitials } from "@/lib/utils";
import { deleteTenantWithLinkedClients } from "@/lib/tenant-client-sync";
import type { Contract, Payment, Tenant } from "@/types";

type TenantRow = Tenant & { assignedRoom: string };

export default function TenantsPage() {
  const { data, loading, api } = useCollection<Tenant>("tenants");
  const { data: contracts } = useCollection<Contract>("contracts");
  const { data: payments } = useCollection<Payment>("payments");
  const { remove } = useCollectionActions<Tenant>("tenants");
  const tashkentNow = useTashkentNow();
  const terms = useIndustryTerminology();

  const { byTenant: roomByTenant } = useMemo(
    () => getTenantRoomMaps(contracts),
    [contracts]
  );

  const activeTenants = useMemo(
    () => data.filter((t) => !t.leftAt),
    [data]
  );

  const tenantsWithRoom = useMemo<TenantRow[]>(
    () =>
      activeTenants.map((t) => ({
        ...t,
        assignedRoom: roomByTenant.get(t.id) ?? "",
      })),
    [activeTenants, roomByTenant]
  );

  const [dialogOpen, setDialogOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [editing, setEditing] = useState<Tenant | null>(null);
  const [assigning, setAssigning] = useState<Tenant | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [checkoutId, setCheckoutId] = useState<string | null>(null);
  const [checkingOut, setCheckingOut] = useState(false);
  const [debtDecision, setDebtDecision] = useState<CheckoutDebtDecision | null>(null);

  const { search, setSearch, page, setPage, totalPages, total, paged } =
    useTableData<TenantRow>({
      data: tenantsWithRoom,
      searchFields: ["fullName", "phone", "assignedRoom"],
      pageSize: 10,
    });

  const handleDelete = async () => {
    if (!deleteId) return;
    if (isApiConfigured) {
      await remove(deleteId);
      await refreshCollection("clients");
    } else {
      await deleteTenantWithLinkedClients(deleteId);
    }
    toast.success(terms.customerDeletedToast);
    setDeleteId(null);
  };

  const checkoutTenant = useMemo(
    () => (checkoutId ? data.find((t) => t.id === checkoutId) ?? null : null),
    [checkoutId, data]
  );
  const checkoutPreview = useMemo(
    () =>
      checkoutId
        ? previewCheckoutDebt(checkoutId, contracts, payments, data, tashkentNow)
        : null,
    [checkoutId, contracts, payments, data, tashkentNow]
  );

  const checkoutHasDebt = (checkoutPreview?.remainingDebt ?? 0) > 0;
  // Qarz ko'rinmasa — xavfsiz tanlov KEEP_DEBT (server baribir qarz topsa, u saqlanadi).
  const effectiveDebtDecision: CheckoutDebtDecision | null = checkoutHasDebt
    ? debtDecision
    : "KEEP_DEBT";

  const openCheckout = (tenantId: string) => {
    setDebtDecision(null);
    setCheckoutId(tenantId);
  };

  const handleCheckout = async () => {
    if (!checkoutId || !effectiveDebtDecision) return;
    setCheckingOut(true);
    try {
      let outcome: { remainingDebt: number; writtenOffAmount: number };
      if (isApiConfigured) {
        const result = await checkoutTenantApi(checkoutId, effectiveDebtDecision);
        outcome = result;
        await Promise.all([
          api.list(),
          refreshCollection("contracts"),
          refreshCollection("properties"),
          refreshCollection("payments"),
          refreshCollection("clients"),
        ]);
      } else {
        const writeOff = effectiveDebtDecision === "WRITE_OFF";
        await checkoutTenantLocal(checkoutId, writeOff ? checkoutPreview?.perContract : []);
        const debt = checkoutPreview?.remainingDebt ?? 0;
        outcome = writeOff
          ? { remainingDebt: 0, writtenOffAmount: debt }
          : { remainingDebt: debt, writtenOffAmount: 0 };
        await Promise.all([
          api.list(),
          refreshCollection("contracts"),
          refreshCollection("properties"),
        ]);
      }
      toast.success(checkoutSuccessMessage(outcome), { duration: 6000 });
      setCheckoutId(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Chiqish xatosi");
    } finally {
      setCheckingOut(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={terms.customerPlural}
        description={terms.customersDescription}
        action={
          <div className="flex flex-wrap gap-2">
            <SendPaymentRemindersButton variant="outline" />
            <Button
              onClick={() => {
                setEditing(null);
                setDialogOpen(true);
              }}
            >
              <Plus className="size-4" /> {terms.addCustomerLabel}
            </Button>
          </div>
        }
      />

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Ism, telefon yoki xona bo'yicha..."
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : paged.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={Users}
                title={terms.emptyCustomersTitle}
                description={terms.emptyCustomersText}
              />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>№</TableHead>
                  <TableHead>F.I.O</TableHead>
                  <TableHead>{terms.unitSingular}</TableHead>
                  <TableHead className="hidden md:table-cell">Telefon</TableHead>
                  <TableHead className="hidden lg:table-cell">Arenda kirish</TableHead>
                  <TableHead className="hidden lg:table-cell">To&apos;lov muddati</TableHead>
                  <TableHead className="hidden xl:table-cell">{terms.contractSingular}</TableHead>
                  <TableHead>Ijara</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {paged.map((tenant) => (
                  <TableRow
                    key={tenant.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => {
                      setAssigning(tenant);
                      setAssignOpen(true);
                    }}
                  >
                    <TableCell>
                      {tenant.clientNumber ? (
                        <Badge variant="outline">{tenant.clientNumber}</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarFallback>
                            {getInitials(tenant.fullName)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="truncate font-medium">
                            {tenant.fullName}
                          </p>
                          <p className="truncate text-xs text-muted-foreground md:hidden">
                            {tenant.phone}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {tenant.assignedRoom ? (
                        <Badge variant="secondary">{tenant.assignedRoom}</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          Biriktirilmagan
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {tenant.phone}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell whitespace-nowrap text-muted-foreground">
                      {tenant.entryDate ? formatDate(tenant.entryDate) : "—"}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell whitespace-nowrap text-muted-foreground">
                      {tenant.paymentDueDate
                        ? formatDate(tenant.paymentDueDate)
                        : "—"}
                    </TableCell>
                    <TableCell className="hidden xl:table-cell text-muted-foreground">
                      {tenant.contractDuration
                        ? `${tenant.contractDuration} oy`
                        : "—"}
                    </TableCell>
                    <TableCell className="font-medium">
                      {formatCurrency(tenant.rentAmount)}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="icon" variant="ghost">
                            <MoreVertical className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => {
                              setAssigning(tenant);
                              setAssignOpen(true);
                            }}
                          >
                            <Link2 className="size-4" /> Xonaga biriktirish
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setEditing(tenant);
                              setDialogOpen(true);
                            }}
                          >
                            <Pencil className="size-4" /> Tahrirlash
                          </DropdownMenuItem>
                          {tenant.assignedRoom ? (
                            <DropdownMenuItem onClick={() => openCheckout(tenant.id)}>
                              <LogOut className="size-4" /> Xonadan chiqarish
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem onClick={() => openCheckout(tenant.id)}>
                              <LogOut className="size-4" /> Chiqish (arxivga)
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => setDeleteId(tenant.id)}
                          >
                            <Trash2 className="size-4" /> Butunlay o&apos;chirish
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Pagination
        page={page}
        totalPages={totalPages}
        total={total}
        onPageChange={setPage}
      />

      <TenantDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        tenant={editing}
      />
      <TenantAssignDialog
        open={assignOpen}
        onOpenChange={setAssignOpen}
        tenant={assigning}
      />
      <Dialog
        open={!!checkoutId}
        onOpenChange={(o) => !o && !checkingOut && setCheckoutId(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Ijarachini xonadan chiqarasizmi?</DialogTitle>
            <DialogDescription>
              Xona bo&apos;shaydi, shartnoma shu sana bilan yopiladi. To&apos;lov
              tarixi saqlanadi — keyingi oylar uchun yangi qarz yozilmaydi.
            </DialogDescription>
          </DialogHeader>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Ijarachi</dt>
            <dd className="font-medium">{checkoutTenant?.fullName ?? "—"}</dd>
            <dt className="text-muted-foreground">Xona</dt>
            <dd className="font-medium">{checkoutPreview?.roomName ?? "Biriktirilmagan"}</dd>
            <dt className="text-muted-foreground">Hozirgi qarzdorlik</dt>
            <dd className={checkoutHasDebt ? "font-semibold text-destructive" : "font-medium"}>
              {formatCheckoutDebt(checkoutPreview?.remainingDebt ?? 0)}
            </dd>
            <dt className="text-muted-foreground">Checkout sana</dt>
            <dd className="font-medium">{formatTashkentDate(getTashkentDateParts(tashkentNow))}</dd>
          </dl>
          {checkoutHasDebt ? (
            <fieldset className="space-y-2" disabled={checkingOut}>
              <legend className="mb-2 text-sm font-medium">Qarzdorlikni saqlaysizmi?</legend>
              {(
                [
                  {
                    value: "KEEP_DEBT",
                    title: "Qarzdorlikka qo‘shilsin",
                    hint: "Qarz saqlanadi va Qarzdorliklar bo‘limida turadi.",
                  },
                  {
                    value: "WRITE_OFF",
                    title: "Qarzdorlikka qo‘shilmasin",
                    hint: "Mavjud qarz 0 UZS qilib yopiladi.",
                  },
                ] as const
              ).map((option) => (
                <label
                  key={option.value}
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors",
                    debtDecision === option.value
                      ? "border-primary bg-primary/5"
                      : "hover:bg-muted/50"
                  )}
                >
                  <input
                    type="radio"
                    name="checkout-debt-decision"
                    value={option.value}
                    checked={debtDecision === option.value}
                    onChange={() => setDebtDecision(option.value)}
                    className="mt-1 accent-primary"
                  />
                  <span className="space-y-0.5">
                    <span className="block text-sm font-medium">{option.title}</span>
                    <span className="block text-xs text-muted-foreground">{option.hint}</span>
                  </span>
                </label>
              ))}
            </fieldset>
          ) : (
            <p className="rounded-lg border bg-muted/40 p-3 text-sm">Qarzdorlik mavjud emas</p>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCheckoutId(null)}
              disabled={checkingOut}
            >
              Bekor qilish
            </Button>
            <Button
              variant="destructive"
              onClick={handleCheckout}
              disabled={checkingOut || !effectiveDebtDecision}
            >
              {checkingOut ? "Jarayonda..." : "Xonadan chiqarish"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(o) => !o && setDeleteId(null)}
        title={terms.deleteCustomerTitle}
        description="Diqqat: shartnoma va barcha to'lovlar ham o'chadi. Tarixni saqlash uchun «Xonadan chiqarish»ni tanlang."
        onConfirm={handleDelete}
      />
    </div>
  );
}
