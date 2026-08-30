"use client";

import { useEffect, useMemo, useState } from "react";
import {
  MoreVertical,
  Pencil,
  Plus,
  Search,
  UserCheck,
  UserCog,
  UserX,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Pagination } from "@/components/shared/pagination";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmployeeDialog } from "@/components/employees/employee-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { calcDailySalary, formatStartedAt } from "@/lib/employee-salary";
import {
  EMPLOYEE_UNIT,
  isLwnCompanyName,
  isSunnurCompanyName,
  matchEmployeeUnit,
  positionLabel,
} from "@/lib/employee-units";
import { formatCurrency } from "@/lib/utils";
import type { Company, Employee } from "@/types";

type UnitTab = "sunnur" | "lwn";

export default function EmployeesPage() {
  const { data, loading } = useCollection<Employee>("employees");
  const { data: companies } = useCollection<Company>("companies");
  const { update, remove } = useCollectionActions<Employee>("employees");

  const [tab, setTab] = useState<UnitTab>("sunnur");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [terminateId, setTerminateId] = useState<string | null>(null);
  const [unitCompanies, setUnitCompanies] = useState<Company[]>([]);
  const [ensuring, setEnsuring] = useState(false);

  useEffect(() => {
    if (!isApiConfigured) return;
    let cancelled = false;
    void (async () => {
      setEnsuring(true);
      try {
        const res = await apiFetch<{
          sunnur?: Company;
          lwn?: Company;
          data?: Company[];
        }>("/companies?ensureUnits=1");
        if (cancelled) return;
        const list = [
          ...(res.sunnur ? [res.sunnur] : []),
          ...(res.lwn ? [res.lwn] : []),
        ];
        setUnitCompanies(
          list.length > 0
            ? list
            : Array.isArray(res.data)
              ? res.data.filter(
                  (c) => isSunnurCompanyName(c.name) || isLwnCompanyName(c.name)
                )
              : []
        );
      } catch {
        // Store fallback via resolvedUnitCompanies
      } finally {
        if (!cancelled) setEnsuring(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // isApiConfigured is a module constant
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resolvedUnitCompanies = useMemo(() => {
    if (unitCompanies.length > 0) return unitCompanies;
    return companies.filter(
      (c) => isSunnurCompanyName(c.name) || isLwnCompanyName(c.name)
    );
  }, [unitCompanies, companies]);

  const sunnurCompanyId = useMemo(
    () => resolvedUnitCompanies.find((c) => isSunnurCompanyName(c.name))?.id,
    [resolvedUnitCompanies]
  );
  const lwnCompanyId = useMemo(
    () => resolvedUnitCompanies.find((c) => isLwnCompanyName(c.name))?.id,
    [resolvedUnitCompanies]
  );

  const filtered = useMemo(() => {
    return data.filter((e) => {
      const unit = matchEmployeeUnit(e.companyName);
      if (tab === "sunnur") {
        return (
          unit === EMPLOYEE_UNIT.SUNNUR ||
          (e.companyId != null && e.companyId === sunnurCompanyId)
        );
      }
      return (
        unit === EMPLOYEE_UNIT.LWN ||
        (e.companyId != null && e.companyId === lwnCompanyId)
      );
    });
  }, [data, tab, sunnurCompanyId, lwnCompanyId]);

  const { search, setSearch, page, setPage, totalPages, total, paged } =
    useTableData<Employee>({
      data: filtered,
      searchFields: ["fullName", "phone", "position", "companyName"],
      pageSize: 10,
    });

  const defaultCompanyId =
    tab === "sunnur" ? sunnurCompanyId : lwnCompanyId;

  const handleTerminate = async () => {
    if (!terminateId) return;
    try {
      if (isApiConfigured) {
        await remove(terminateId);
      } else {
        await update(terminateId, { active: false } as Partial<Employee>);
      }
      toast.success("Xodim ishdan bo‘shatildi");
      setTerminateId(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Xatolik");
    }
  };

  const handleReactivate = async (emp: Employee) => {
    try {
      await update(emp.id, { active: true } as Partial<Employee>);
      toast.success("Xodim qayta tiklandi");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Xatolik");
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Xodimlar"
        description="Sunnur va LWN xodimlari, oylik maosh va holat"
        action={
          <Button
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
            disabled={ensuring || !defaultCompanyId}
          >
            <Plus className="size-4" /> Xodim qo‘shish
          </Button>
        }
      />

      <Tabs
        value={tab}
        onValueChange={(v) => {
          setTab(v as UnitTab);
          setPage(1);
        }}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <TabsList>
            <TabsTrigger value="sunnur">Sunnur xodimlari</TabsTrigger>
            <TabsTrigger value="lwn">LWN xodimlari</TabsTrigger>
          </TabsList>
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Qidirish..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
        </div>

        {(["sunnur", "lwn"] as const).map((key) => (
          <TabsContent key={key} value={key} className="mt-4 space-y-4">
            <Card>
              <CardContent className="p-0">
                {loading || ensuring ? (
                  <div className="space-y-2 p-4">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Skeleton key={i} className="h-10 w-full" />
                    ))}
                  </div>
                ) : paged.length === 0 ? (
                  <EmptyState
                    icon={UserCog}
                    title={
                      key === "sunnur"
                        ? "Sunnur xodimlari yo‘q"
                        : "LWN xodimlari yo‘q"
                    }
                    description="Yangi xodim qo‘shing — maosh xarajatida shu yerda ko‘rinadi."
                    action={
                      <Button
                        onClick={() => {
                          setEditing(null);
                          setDialogOpen(true);
                        }}
                      >
                        <Plus className="size-4" /> Xodim qo‘shish
                      </Button>
                    }
                  />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>F.I.O</TableHead>
                        <TableHead className="hidden sm:table-cell">
                          Telefon
                        </TableHead>
                        <TableHead className="hidden md:table-cell">
                          Lavozim
                        </TableHead>
                        <TableHead>Oylik</TableHead>
                        <TableHead className="hidden lg:table-cell">
                          Ish boshlagan
                        </TableHead>
                        <TableHead className="hidden xl:table-cell">
                          Maosh kuni
                        </TableHead>
                        <TableHead>Holat</TableHead>
                        <TableHead className="w-12" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paged.map((emp) => (
                        <TableRow key={emp.id}>
                          <TableCell className="font-medium">
                            {emp.fullName}
                          </TableCell>
                          <TableCell className="hidden text-muted-foreground sm:table-cell">
                            {emp.phone || "—"}
                          </TableCell>
                          <TableCell className="hidden text-muted-foreground md:table-cell">
                            {positionLabel(emp.position)}
                          </TableCell>
                          <TableCell>
                            {emp.monthlySalary > 0 ? (
                              <div>
                                <div>{formatCurrency(emp.monthlySalary)}</div>
                                <div className="text-xs text-muted-foreground">
                                  kunlik ≈{" "}
                                  {formatCurrency(
                                    calcDailySalary(emp.monthlySalary)
                                  )}
                                </div>
                              </div>
                            ) : (
                              "—"
                            )}
                          </TableCell>
                          <TableCell className="hidden text-muted-foreground lg:table-cell">
                            {formatStartedAt(
                              emp.startedAt ?? emp.createdAt
                            )}
                          </TableCell>
                          <TableCell className="hidden xl:table-cell">
                            {emp.salaryPayDay
                              ? `Har oy ${emp.salaryPayDay}-kuni`
                              : "—"}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={emp.active ? "success" : "secondary"}
                            >
                              {emp.active ? "Faol" : "Ishdan bo‘shatilgan"}
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
                                  onClick={() => {
                                    setEditing(emp);
                                    setDialogOpen(true);
                                  }}
                                >
                                  <Pencil className="size-4" /> Tahrirlash
                                </DropdownMenuItem>
                                {emp.active ? (
                                  <DropdownMenuItem
                                    className="text-destructive focus:text-destructive"
                                    onClick={() => setTerminateId(emp.id)}
                                  >
                                    <UserX className="size-4" /> Ishdan
                                    bo‘shatish
                                  </DropdownMenuItem>
                                ) : (
                                  <DropdownMenuItem
                                    onClick={() => void handleReactivate(emp)}
                                  >
                                    <UserCheck className="size-4" /> Qayta
                                    tiklash
                                  </DropdownMenuItem>
                                )}
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
            {totalPages > 1 && (
              <Pagination
                page={page}
                totalPages={totalPages}
                total={total}
                onPageChange={setPage}
              />
            )}
          </TabsContent>
        ))}
      </Tabs>

      <EmployeeDialog
        open={dialogOpen}
        onOpenChange={(o) => {
          setDialogOpen(o);
          if (!o) setEditing(null);
        }}
        employee={editing}
        unitCompanies={resolvedUnitCompanies}
        defaultCompanyId={defaultCompanyId}
      />

      <ConfirmDialog
        open={Boolean(terminateId)}
        onOpenChange={(o) => {
          if (!o) setTerminateId(null);
        }}
        title="Ishdan bo‘shatish"
        description="Xodim soft-terminate qilinadi (active=false). Maosh ro‘yxatidan chiqadi, yozuv o‘chirilmaydi."
        confirmText="Bo‘shatish"
        onConfirm={() => void handleTerminate()}
      />
    </div>
  );
}
