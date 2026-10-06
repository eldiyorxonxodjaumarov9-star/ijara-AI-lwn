"use client";

import { Ban, Pencil, Plus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { MANUAL_DEBT_STATUS_LABEL, type ManualDebtView } from "@/lib/manual-debts";
import { formatCurrency } from "@/lib/utils";

export function ManualDebtsTable({
  debts,
  canManage,
  onPay,
  onEdit,
  onCancel,
}: {
  debts: ManualDebtView[];
  canManage: boolean;
  onPay: (debt: ManualDebtView) => void;
  onEdit: (debt: ManualDebtView) => void;
  onCancel: (debt: ManualDebtView) => void;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Mulk / Xona</TableHead>
          <TableHead>Qarzdor</TableHead>
          <TableHead className="hidden md:table-cell">Faoliyat</TableHead>
          <TableHead className="hidden md:table-cell">Qarzdorlik sanasi</TableHead>
          <TableHead className="hidden lg:table-cell">Qarz jami</TableHead>
          <TableHead className="hidden lg:table-cell">To&apos;langan</TableHead>
          <TableHead>Qolgan</TableHead>
          <TableHead>Holat</TableHead>
          {canManage && <TableHead className="text-right">Amallar</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {debts.map((d) => (
          <TableRow key={d.id} className="bg-amber-500/[0.04]">
            <TableCell className="font-medium">
              {d.propertyName ?? (
                <span className="text-muted-foreground">Biriktirilmagan</span>
              )}
            </TableCell>
            <TableCell>
              <div className="font-medium">{d.debtorName}</div>
              {d.debtorPhone && (
                <div className="text-xs text-muted-foreground">{d.debtorPhone}</div>
              )}
              {!d.telegramLinked && (
                <div className="text-xs text-muted-foreground">Telegram ulanmagan</div>
              )}
            </TableCell>
            <TableCell className="hidden md:table-cell">{d.debtorOccupation ?? "—"}</TableCell>
            <TableCell className="hidden md:table-cell text-muted-foreground">{d.debtDate}</TableCell>
            <TableCell className="hidden lg:table-cell text-muted-foreground">
              {formatCurrency(d.originalAmount)}
            </TableCell>
            <TableCell className="hidden lg:table-cell text-muted-foreground">
              {formatCurrency(d.paidAmount)}
            </TableCell>
            <TableCell className="font-bold text-destructive">
              {formatCurrency(d.remainingAmount)}
            </TableCell>
            <TableCell>
              <div className="flex flex-wrap gap-1">
                <Badge variant="secondary">Qo‘lda qo‘shilgan</Badge>
                <Badge variant={d.status === "PARTIAL" ? "outline" : "destructive"}>
                  {MANUAL_DEBT_STATUS_LABEL[d.status]}
                </Badge>
              </div>
            </TableCell>
            {canManage && (
              <TableCell>
                <div className="flex justify-end gap-1">
                  <Button size="sm" variant="outline" onClick={() => onPay(d)}>
                    <Plus className="size-3.5" />
                    To‘lov qo‘shish
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => onEdit(d)}
                    aria-label="Tahrirlash"
                    title="Tahrirlash"
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => onCancel(d)}
                    aria-label="Bekor qilish"
                    title="Bekor qilish"
                  >
                    <Ban className="size-4 text-destructive" />
                  </Button>
                </div>
              </TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
