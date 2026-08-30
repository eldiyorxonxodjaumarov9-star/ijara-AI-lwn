"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, RefreshCw, Search, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { Pagination } from "@/components/shared/pagination";
import { PaymentDueCell } from "@/components/notifications/payment-due-cell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { useCollection } from "@/hooks/use-collection";
import { useTenantPaymentDueMap } from "@/hooks/use-tenant-payment-due-lines";
import { useTableData } from "@/hooks/use-table-data";
import { ApiError, isApiConfigured } from "@/lib/api/client";
import { refreshCollection } from "@/lib/data/store";
import {
  buildSmsTenantCandidates,
  collectSmsCandidateRooms,
} from "@/lib/sms-link-candidates";
import { assignSmsLinks } from "@/lib/sms-links-client";
import {
  DEFAULT_SMS_SETTINGS,
  formatPhoneDisplay,
} from "@/lib/sms-notifications";
import type { Contract, Payment, Tenant } from "@/types";
import type {
  SmsLinkedTenant,
  SmsTenantCandidate,
} from "@/types/sms-notifications";

const ALL_ROOMS = "all";
const PAGE_SIZE = 10;

export function SmsAssignTenantsDialog({
  open,
  onOpenChange,
  linkedKeys,
  onAssigned,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  linkedKeys: Set<string>;
  onAssigned: (rows: SmsLinkedTenant[]) => void;
}) {
  const { data: tenants, loading: tenantsLoading } =
    useCollection<Tenant>("tenants");
  const { data: contracts, loading: contractsLoading } =
    useCollection<Contract>("contracts");
  const { loading: paymentsLoading } = useCollection<Payment>("payments");
  const paymentDueByTenant = useTenantPaymentDueMap();

  const [refreshing, setRefreshing] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [roomFilter, setRoomFilter] = useState(ALL_ROOMS);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const reloadFromSource = useCallback(async () => {
    setRefreshing(true);
    setLoadError(null);
    try {
      await Promise.all([
        refreshCollection("tenants"),
        refreshCollection("contracts"),
        refreshCollection("payments"),
      ]);
    } catch (err) {
      setLoadError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Arendatorlarni yuklab bo'lmadi"
      );
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    void reloadFromSource();
  }, [open, reloadFromSource]);

  const candidates = useMemo(
    () => buildSmsTenantCandidates(tenants, contracts, linkedKeys),
    [tenants, contracts, linkedKeys]
  );

  const roomOptions = useMemo(
    () => collectSmsCandidateRooms(candidates),
    [candidates]
  );

  const roomFiltered = useMemo(() => {
    if (roomFilter === ALL_ROOMS) return candidates;
    return candidates.filter((c) => c.propertyLabel === roomFilter);
  }, [candidates, roomFilter]);

  const {
    search,
    setSearch,
    page,
    setPage,
    totalPages,
    total: filteredTotal,
    paged,
  } = useTableData<SmsTenantCandidate>({
    data: roomFiltered,
    searchFields: ["fullName", "phone", "propertyLabel"],
    pageSize: PAGE_SIZE,
  });

  const resetDialogUi = useCallback(() => {
    setSelected(new Set());
    setRoomFilter(ALL_ROOMS);
    setSearch("");
    setPage(1);
    setLoadError(null);
  }, [setSearch, setPage]);

  const candidateByKey = useMemo(() => {
    const map = new Map<string, SmsTenantCandidate>();
    for (const c of candidates) map.set(c.candidateKey, c);
    return map;
  }, [candidates]);

  /** Telefon yo‘q bo‘lsa ham biriktirish mumkin — faqat allaqachon bog‘langanlar cheklanadi */
  const selectableVisible = paged.filter((c) => !c.alreadyLinked);

  const allVisibleSelected =
    selectableVisible.length > 0 &&
    selectableVisible.every((c) => selected.has(c.candidateKey));

  const toggleOne = (candidateKey: string, canSelect: boolean) => {
    if (!canSelect) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(candidateKey)) next.delete(candidateKey);
      else next.add(candidateKey);
      return next;
    });
  };

  const toggleAllVisible = () => {
    if (allVisibleSelected) {
      setSelected((prev) => {
        const next = new Set(prev);
        for (const c of selectableVisible) next.delete(c.candidateKey);
        return next;
      });
    } else {
      setSelected((prev) => {
        const next = new Set(prev);
        for (const c of selectableVisible) next.add(c.candidateKey);
        return next;
      });
    }
  };

  const handleAssign = async () => {
    const toAdd: SmsTenantCandidate[] = [];
    for (const key of selected) {
      const c = candidateByKey.get(key);
      if (c && !c.alreadyLinked && !toAdd.some((x) => x.candidateKey === key)) {
        toAdd.push(c);
      }
    }
    if (toAdd.length === 0) {
      toast.info("Kamida bitta arendator tanlang");
      return;
    }

    if (!isApiConfigured) {
      toast.error("API sozlanmagan — biriktirish saqlanmaydi");
      return;
    }

    setAssigning(true);
    try {
      const result = await assignSmsLinks(
        toAdd.map((c) => ({
          tenantId: c.tenantId,
          contractId: c.contractId,
          propertyId: c.propertyId,
          propertyLabel: c.propertyLabel === "—" ? "" : c.propertyLabel,
          smsEnabled: true,
          settings: { ...DEFAULT_SMS_SETTINGS },
        }))
      );
      onAssigned(result.data);
      const n = result.created.length;
      if (n === 0) {
        toast.info("Yangi biriktirish yo'q (allaqachon mavjud)");
      } else {
        toast.success(`${n} ta arendator biriktirildi`);
      }
      resetDialogUi();
      onOpenChange(false);
    } catch (err) {
      toast.error(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Biriktirish saqlanmadi"
      );
    } finally {
      setAssigning(false);
    }
  };

  const initialLoading =
    (tenantsLoading || contractsLoading || paymentsLoading) &&
    tenants.length === 0;
  const loading = initialLoading || refreshing;

  const showError =
    !loading &&
    candidates.length === 0 &&
    Boolean(loadError || (isApiConfigured && tenants.length === 0));

  const errorMessage =
    loadError ??
    (isApiConfigured
      ? "Arendatorlar ro'yxati bo'sh yoki yuklanmadi. Qayta urinib ko'ring."
      : "Faol arendatorlar topilmadi.");

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) resetDialogUi();
        onOpenChange(o);
      }}
    >
      <DialogContent className="flex max-h-[90vh] max-w-2xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="space-y-1 border-b px-6 py-4">
          <DialogTitle>Arendator biriktirish</DialogTitle>
          <DialogDescription>
            Arendatorlar bo&apos;limidagi ro&apos;yxatdan tanlang. Har bir
            xona/shartnoma alohida qator sifatida biriktiriladi.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 border-b px-6 py-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="relative sm:col-span-2">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Ism, xona yoki telefon bo'yicha qidirish..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                disabled={loading || showError || assigning}
              />
            </div>
            {roomOptions.length > 0 && (
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Mulk / xona</Label>
                <Select
                  value={roomFilter}
                  onValueChange={(v) => {
                    setRoomFilter(v);
                    setPage(1);
                  }}
                  disabled={loading || showError || assigning}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Barchasi" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_ROOMS}>Barchasi</SelectItem>
                    {roomOptions.map((room) => (
                      <SelectItem key={room} value={room}>
                        {room}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            Tanlangan:{" "}
            <span className="font-medium text-foreground">{selected.size}</span>
            {!loading && !showError && (
              <span className="ml-2">
                · Jami: {candidates.length}
                {filteredTotal !== candidates.length &&
                  ` · Ko‘rinayotgan: ${filteredTotal}`}
              </span>
            )}
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-2">
          {loading ? (
            <div className="space-y-2 py-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : showError ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <AlertCircle className="size-10 text-destructive" />
              <div>
                <p className="font-medium">Ma&apos;lumotlarni yuklab bo&apos;lmadi</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {errorMessage}
                </p>
              </div>
              <Button variant="outline" onClick={() => void reloadFromSource()}>
                <RefreshCw className="size-4" /> Qayta urinish
              </Button>
            </div>
          ) : paged.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              {search || roomFilter !== ALL_ROOMS
                ? "Qidiruv bo'yicha arendator topilmadi"
                : "Faol arendatorlar yo'q"}
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <input
                        type="checkbox"
                        className="size-4 rounded border-input accent-primary"
                        checked={allVisibleSelected}
                        onChange={toggleAllVisible}
                        disabled={selectableVisible.length === 0 || assigning}
                        aria-label="Joriy sahifadagi tanlash mumkin bo'lganlarni belgilash"
                      />
                    </TableHead>
                    <TableHead>Arendator</TableHead>
                    <TableHead className="hidden sm:table-cell">Xona</TableHead>
                    <TableHead>Telefon</TableHead>
                    <TableHead>To&apos;lov sanasi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paged.map((c) => {
                    const canSelect = !c.alreadyLinked;
                    const dueLines = paymentDueByTenant.get(c.tenantId) ?? [];
                    const dueForRow =
                      c.propertyLabel === "—"
                        ? dueLines
                        : dueLines.filter(
                            (l) => l.propertyLabel === c.propertyLabel
                          );
                    return (
                      <TableRow
                        key={c.candidateKey}
                        className={!canSelect ? "opacity-70" : undefined}
                      >
                        <TableCell>
                          <input
                            type="checkbox"
                            className="size-4 rounded border-input accent-primary"
                            checked={selected.has(c.candidateKey)}
                            disabled={!canSelect || assigning}
                            onChange={() =>
                              toggleOne(c.candidateKey, canSelect)
                            }
                            aria-label={`${c.fullName} tanlash`}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{c.fullName}</div>
                          {c.alreadyLinked && (
                            <Badge variant="secondary" className="mt-1">
                              Biriktirilgan
                            </Badge>
                          )}
                          {!c.phoneValid && !c.alreadyLinked && (
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {c.phoneInvalidReason ?? "Telefon yo'q"} — baribir
                              biriktirish mumkin
                            </p>
                          )}
                          <span className="mt-0.5 block text-xs text-muted-foreground sm:hidden">
                            {c.propertyLabel}
                          </span>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-muted-foreground">
                          {c.propertyLabel}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm">
                          {c.phone.trim()
                            ? formatPhoneDisplay(c.phone)
                            : "—"}
                        </TableCell>
                        <TableCell className="min-w-[7rem]">
                          {dueForRow.length === 0 ? (
                            <span className="text-sm text-muted-foreground">
                              —
                            </span>
                          ) : (
                            <PaymentDueCell lines={dueForRow} />
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              {totalPages > 1 && (
                <div className="py-3">
                  <Pagination
                    page={page}
                    totalPages={totalPages}
                    total={filteredTotal}
                    onPageChange={setPage}
                  />
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter className="border-t px-6 py-4">
          <Button
            variant="outline"
            disabled={assigning}
            onClick={() => {
              resetDialogUi();
              onOpenChange(false);
            }}
          >
            Bekor qilish
          </Button>
          <Button
            onClick={() => void handleAssign()}
            disabled={selected.size === 0 || loading || showError || assigning}
          >
            <UserPlus className="size-4" />
            {assigning
              ? "Saqlanmoqda..."
              : `Biriktirish (${selected.size})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
