"use client";

import { useEffect, useMemo, useState } from "react";
import {
  FileText,
  MoreVertical,
  Pencil,
  Plus,
  Receipt,
  Search,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Pagination } from "@/components/shared/pagination";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { ExpenseDialog } from "@/components/expenses/expense-dialog";
import { StatCard } from "@/components/shared/stat-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCollection, useCollectionActions } from "@/hooks/use-collection";
import { useTableData } from "@/hooks/use-table-data";
import { MONTHS_UZ_FULL } from "@/lib/analytics";
import { exportToPdf } from "@/lib/export";
import { getTashkentDateParts } from "@/lib/payment-due-schedule";
import { formatCurrency, formatDate } from "@/lib/utils";
import { EXPENSE_CATEGORY_MAP } from "@/lib/constants";
import { formatExpenseDetail } from "@/lib/monthly-expense-type";
import type { Expense, ExpenseCategory } from "@/types";

const ALL_CATEGORIES = "all";

export default function ExpensesPage() {
  const { data, loading } = useCollection<Expense>("expenses");
  const { remove } = useCollectionActions<Expense>("expenses");

  const nowParts = getTashkentDateParts();
  const [month, setMonth] = useState(String(nowParts.month));
  const [year, setYear] = useState(String(nowParts.year));
  const [category, setCategory] = useState<string>(ALL_CATEGORIES);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const monthNum = Number(month);
  const yearNum = Number(year);
  const categoryLabel =
    category === ALL_CATEGORIES
      ? "Barcha kategoriyalar"
      : EXPENSE_CATEGORY_MAP[category as ExpenseCategory] ?? category;
  const periodLabel = `${MONTHS_UZ_FULL[monthNum - 1]} ${yearNum}`;
  const filterLabel =
    category === ALL_CATEGORIES
      ? periodLabel
      : `${periodLabel} · ${categoryLabel}`;

  const yearOptions = useMemo(() => {
    const y = nowParts.year;
    return Array.from({ length: 6 }, (_, i) => y - 2 + i);
  }, [nowParts.year]);

  const filtered = useMemo(() => {
    return data.filter((e) => {
      const p = getTashkentDateParts(e.date);
      if (p.year !== yearNum || p.month !== monthNum) return false;
      if (category !== ALL_CATEGORIES && e.category !== category) return false;
      return true;
    });
  }, [data, yearNum, monthNum, category]);

  const total = useMemo(
    () => filtered.reduce((s, e) => s + (e.amount || 0), 0),
    [filtered]
  );

  const sortedExpenses = useMemo(
    () =>
      [...filtered].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      ),
    [filtered]
  );

  const handlePdf = () => {
    if (sortedExpenses.length === 0) {
      toast.error("Eksport qilish uchun xarajatlar yo'q");
      return;
    }
    const catSlug =
      category === ALL_CATEGORIES ? "barcha" : category;
    exportToPdf({
      title: `Xarajatlar hisoboti — ${filterLabel}`,
      head: [
        "№",
        "Kategoriya",
        "Ishchi / Oylik tur / Izoh",
        "Kompaniya",
        "Sana",
        "Summa",
      ],
      body: sortedExpenses.map((e, i) => [
        i + 1,
        EXPENSE_CATEGORY_MAP[e.category] ?? e.category,
        formatExpenseDetail(e),
        e.companyName || (e.employeeName ? "O'zimiz" : "—"),
        formatDate(e.date),
        formatCurrency(e.amount),
      ]),
      foot: [
        [
          "",
          "JAMI",
          "",
          "",
          `${sortedExpenses.length} ta yozuv`,
          formatCurrency(total),
        ],
      ],
      fileName: `xarajatlar-${yearNum}-${String(monthNum).padStart(2, "0")}-${catSlug}`,
    });
    toast.success("PDF yuklab olindi");
  };

  const {
    search,
    setSearch,
    page,
    setPage,
    totalPages,
    total: count,
    paged,
  } = useTableData<Expense>({
    data: sortedExpenses,
    searchFields: [
      "category",
      "note",
      "employeeName",
      "companyName",
      "monthlyExpenseLabel",
      "monthlyExpenseCustomName",
    ],
    pageSize: 10,
  });

  useEffect(() => {
    setPage(1);
  }, [month, year, category, setPage]);

  const handleDelete = async () => {
    if (!deleteId) return;
    await remove(deleteId);
    toast.success("Xarajat o'chirildi");
    setDeleteId(null);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Xarajatlar"
        description={`${filterLabel} — operatsion xarajatlarni qayd eting.`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Select value={month} onValueChange={setMonth}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Oy" />
              </SelectTrigger>
              <SelectContent>
                {MONTHS_UZ_FULL.map((name, i) => (
                  <SelectItem key={name} value={String(i + 1)}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={year} onValueChange={setYear}>
              <SelectTrigger className="w-28">
                <SelectValue placeholder="Yil" />
              </SelectTrigger>
              <SelectContent>
                {yearOptions.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Kategoriya" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_CATEGORIES}>Barchasi</SelectItem>
                {Object.entries(EXPENSE_CATEGORY_MAP).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={handlePdf} disabled={loading}>
              <FileText className="size-4" /> PDF
            </Button>
            <Button
              onClick={() => {
                setEditing(null);
                setDialogOpen(true);
              }}
            >
              <Plus className="size-4" /> Xarajat qo&apos;shish
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatCard
          title={`${filterLabel} jami`}
          value={formatCurrency(total)}
          icon={Receipt}
          tone="rose"
          loading={loading}
        />
        <StatCard
          title="Yozuvlar soni"
          value={String(filtered.length)}
          icon={Receipt}
          tone="amber"
          loading={loading}
          index={1}
        />
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Izoh, oylik tur (suv, elektr...)..."
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
                icon={Receipt}
                title={`${filterLabel}da xarajat yo'q`}
                description="Boshqa oy/kategoriya tanlang yoki yangi xarajat qo'shing."
              />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kategoriya</TableHead>
                  <TableHead className="hidden md:table-cell">
                    Ishchi / Oylik tur / Izoh
                  </TableHead>
                  <TableHead className="hidden lg:table-cell">Kompaniya</TableHead>
                  <TableHead>Sana</TableHead>
                  <TableHead>Summa</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {paged.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell>
                      <Badge variant="secondary">
                        {EXPENSE_CATEGORY_MAP[e.category]}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground">
                      {formatExpenseDetail(e)}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {e.companyName ? (
                        <Badge variant="outline">{e.companyName}</Badge>
                      ) : e.employeeName ? (
                        <span className="text-xs text-muted-foreground">
                          O&apos;zimiz
                        </span>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {formatDate(e.date)}
                    </TableCell>
                    <TableCell className="font-semibold text-destructive">
                      −{formatCurrency(e.amount)}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="icon" variant="ghost">
                            <MoreVertical className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => {
                              setEditing(e);
                              setDialogOpen(true);
                            }}
                          >
                            <Pencil className="size-4" /> Tahrirlash
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => setDeleteId(e.id)}
                          >
                            <Trash2 className="size-4" /> O&apos;chirish
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
        total={count}
        onPageChange={setPage}
      />

      <ExpenseDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        expense={editing}
      />
      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(o) => !o && setDeleteId(null)}
        title="Xarajatni o'chirish"
        onConfirm={handleDelete}
      />
    </div>
  );
}
