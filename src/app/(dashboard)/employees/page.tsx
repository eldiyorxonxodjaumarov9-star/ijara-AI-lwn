"use client";

import { useMemo, useState } from "react";
import {
  Bell,
  Building2,
  MoreVertical,
  Pencil,
  Plus,
  Search,
  Trash2,
  UserCog,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Pagination } from "@/components/shared/pagination";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { CompanyDialog } from "@/components/employees/company-dialog";
import { EmployeeDialog } from "@/components/employees/employee-dialog";
import { EmployeeSalaryDialog } from "@/components/employees/employee-salary-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { useCollection, useCollectionActions } from "@/hooks/use-collection";
import { useTableData } from "@/hooks/use-table-data";
import { apiFetch, isApiConfigured } from "@/lib/api/client";
import { calcDailySalary } from "@/lib/employee-salary";
import { formatCurrency } from "@/lib/utils";
import type { Company, Employee } from "@/types";

const ALL = "all";
const OWN = "own";

export default function EmployeesPage() {
  const { data, loading } = useCollection<Employee>("employees");
  const { data: companies } = useCollection<Company>("companies");
  const { remove } = useCollectionActions<Employee>("employees");
  const { remove: removeCompany } = useCollectionActions<Company>("companies");

  const [companyFilter, setCompanyFilter] = useState(ALL);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [companyDialogOpen, setCompanyDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [salaryFor, setSalaryFor] = useState<Employee | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteCompanyId, setDeleteCompanyId] = useState<string | null>(null);
  const [sendingBot, setSendingBot] = useState(false);

  const filtered = useMemo(() => {
    if (companyFilter === ALL) return data;
    if (companyFilter === OWN) return data.filter((e) => !e.companyId);
    return data.filter((e) => e.companyId === companyFilter);
  }, [data, companyFilter]);

  const { search, setSearch, page, setPage, totalPages, total, paged } =
    useTableData<Employee>({
      data: filtered,
      searchFields: ["fullName", "phone", "position", "companyName"],
      pageSize: 10,
    });

  const handleSendSalaryToBot = async () => {
    if (!isApiConfigured) {
      toast.error("API rejimi yoqilmagan");
      return;
    }
    setSendingBot(true);
    try {
      const res = await apiFetch<{
        sent?: number;
        dueCount?: number;
        chatIds?: number;
        message?: string;
      }>("/notifications/employee-salary", {
        method: "POST",
        body: { withinDays: 31 },
      });
      if ((res.chatIds ?? 0) === 0) {
        toast.warning(
          res.message ??
            "Admin Telegram topilmadi. Botda /start qilib kiring."
        );
      } else {
        toast.success(
          res.message ??
            `${res.sent ?? 0} ta chatga yuborildi (${res.dueCount ?? 0} ishchi)`
        );
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Yuborish xatosi");
    } finally {
      setSendingBot(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await remove(deleteId);
      toast.success("Ishchi o'chirildi");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "O'chirish xatosi");
    }
    setDeleteId(null);
  };

  const handleDeleteCompany = async () => {
    if (!deleteCompanyId) return;
    const hasWorkers = data.some((e) => e.companyId === deleteCompanyId);
    if (hasWorkers) {
      toast.error("Avval shu kompaniya ishchilarini o'chiring yoki boshqa kompaniyaga o'tkazing");
      setDeleteCompanyId(null);
      return;
    }
    try {
      await removeCompany(deleteCompanyId);
      toast.success("Kompaniya o'chirildi");
      if (companyFilter === deleteCompanyId) setCompanyFilter(ALL);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "O'chirish xatosi");
    }
    setDeleteCompanyId(null);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ishchilar"
        description="O'z ishchilar va hamkor kompaniya ishchilari. Xarajatlarda kompaniya nomi bilan ajraladi."
        action={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={handleSendSalaryToBot}
              disabled={sendingBot || loading}
            >
              <Bell className="size-4" />
              {sendingBot ? "Yuborilmoqda..." : "Botga oylik"}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setEditingCompany(null);
                setCompanyDialogOpen(true);
              }}
            >
              <Building2 className="size-4" /> Kompaniya qo&apos;shish
            </Button>
            <Button
              onClick={() => {
                setEditing(null);
                setDialogOpen(true);
              }}
            >
              <Plus className="size-4" /> Ishchi qo&apos;shish
            </Button>
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Ism, telefon, lavozim yoki kompaniya..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select
          value={companyFilter}
          onValueChange={(v) => {
            setCompanyFilter(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Kompaniya" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Barcha ishchilar</SelectItem>
            <SelectItem value={OWN}>O&apos;z kompaniyamiz</SelectItem>
            {companies.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {companies.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {companies.map((c) => (
            <Badge
              key={c.id}
              variant="secondary"
              className="cursor-pointer gap-1 pr-1"
              onClick={() => {
                setEditingCompany(c);
                setCompanyDialogOpen(true);
              }}
            >
              <Building2 className="size-3" />
              {c.name}
              <button
                type="button"
                className="ml-1 rounded p-0.5 hover:bg-destructive/15 hover:text-destructive"
                title="O'chirish"
                onClick={(e) => {
                  e.stopPropagation();
                  setDeleteCompanyId(c.id);
                }}
              >
                <Trash2 className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : paged.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={UserCog}
                title="Ishchi yo'q"
                description="Kompaniya va ishchini qo'shing."
              />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>F.I.O</TableHead>
                  <TableHead className="hidden md:table-cell">
                    Kompaniya
                  </TableHead>
                  <TableHead className="hidden sm:table-cell">Telefon</TableHead>
                  <TableHead className="hidden lg:table-cell">Lavozim</TableHead>
                  <TableHead>Oylik / kunlik</TableHead>
                  <TableHead className="hidden xl:table-cell">
                    Beriladigan kun
                  </TableHead>
                  <TableHead>Holat</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {paged.map((emp) => (
                  <TableRow key={emp.id}>
                    <TableCell className="font-medium">{emp.fullName}</TableCell>
                    <TableCell className="hidden md:table-cell">
                      {emp.companyName ? (
                        <Badge variant="outline">{emp.companyName}</Badge>
                      ) : (
                        <span className="text-muted-foreground">O&apos;zimiz</span>
                      )}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-muted-foreground">
                      {emp.phone || "—"}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-muted-foreground">
                      {emp.position || "—"}
                    </TableCell>
                    <TableCell>
                      {emp.monthlySalary > 0 ? (
                        <>
                          <span className="font-medium">
                            {formatCurrency(emp.monthlySalary)}
                          </span>
                          <span className="mt-0.5 block text-xs text-muted-foreground">
                            kunlik ≈{" "}
                            {formatCurrency(calcDailySalary(emp.monthlySalary))}
                          </span>
                        </>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="hidden xl:table-cell">
                      {emp.salaryPayDay
                        ? `Har oy ${emp.salaryPayDay}-kuni`
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={emp.active ? "success" : "secondary"}>
                        {emp.active ? "Faol" : "Nofaol"}
                      </Badge>
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
                            onClick={() => setSalaryFor(emp)}
                            disabled={!emp.active}
                          >
                            <Wallet className="size-4" />{" "}
                            {emp.companyName ? "To'lov yozish" : "Oylik berish"}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setEditing(emp);
                              setDialogOpen(true);
                            }}
                          >
                            <Pencil className="size-4" /> Tahrirlash
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => setDeleteId(emp.id)}
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
        total={total}
        onPageChange={setPage}
      />

      <EmployeeDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        employee={editing}
      />
      <CompanyDialog
        open={companyDialogOpen}
        onOpenChange={setCompanyDialogOpen}
        company={editingCompany}
      />
      <EmployeeSalaryDialog
        open={!!salaryFor}
        onOpenChange={(o) => !o && setSalaryFor(null)}
        employee={salaryFor}
      />
      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(o) => !o && setDeleteId(null)}
        title="Ishchini o'chirish"
        description="Ishchi o'chiriladi. Oldingi xarajatlar saqlanadi."
        onConfirm={handleDelete}
      />
      <ConfirmDialog
        open={!!deleteCompanyId}
        onOpenChange={(o) => !o && setDeleteCompanyId(null)}
        title="Kompaniyani o'chirish"
        description="Kompaniya o'chiriladi."
        onConfirm={handleDeleteCompany}
      />
    </div>
  );
}
