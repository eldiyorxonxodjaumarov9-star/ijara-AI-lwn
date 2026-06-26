"use client";

import { useCallback, useEffect, useState } from "react";
import { Bot, Phone, RefreshCw, Search, UserCheck, Users } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Pagination } from "@/components/shared/pagination";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { apiFetch, isApiConfigured } from "@/lib/api/client";
import { formatDate } from "@/lib/utils";

type BotUserRow = {
  id: string;
  chatId: string;
  displayName: string;
  username: string | null;
  phone: string | null;
  selectedRole: string | null;
  tenantName: string | null;
  startCount: number;
  firstStartAt: string;
  lastStartAt: string;
  phoneVerifiedAt: string | null;
};

type BotUsersResponse = {
  stats: { total: number; withPhone: number; linkedTenant: number };
  data: BotUserRow[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
};

const ROLE_LABEL: Record<string, string> = {
  tenant: "Arendator",
  owner: "Arenda egasi",
};

export default function TelegramBotUsersPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [response, setResponse] = useState<BotUsersResponse | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!isApiConfigured) {
      setLoading(false);
      return;
    }
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: "20",
        order: "desc",
      });
      if (search.trim()) params.set("search", search.trim());
      const data = await apiFetch<BotUsersResponse>(
        `/telegram/bot-users?${params}`
      );
      setResponse(data);
    } catch {
      toast.error("Bot foydalanuvchilarini yuklashda xatolik");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [page, search]);

  useEffect(() => {
    void load();
  }, [load]);

  const stats = response?.stats;
  const rows = response?.data ?? [];
  const meta = response?.meta;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Telegram bot foydalanuvchilari"
        description="Botda /start bosgan va telefon ulashgan foydalanuvchilar ro'yxati."
        action={
          <Button
            variant="outline"
            onClick={() => void load(true)}
            disabled={refreshing}
          >
            <RefreshCw className={refreshing ? "size-4 animate-spin" : "size-4"} />
            Yangilash
          </Button>
        }
      />

      {!isApiConfigured ? (
        <EmptyState
          icon={Bot}
          title="Server rejimi kerak"
          description="Bot foydalanuvchilari faqat PostgreSQL bazasi bilan ishlaydi."
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardContent className="flex items-center gap-4 p-5">
                <div className="flex size-11 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-600">
                  <Users className="size-5" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Jami /start</p>
                  <p className="text-2xl font-bold">
                    {loading ? "—" : (stats?.total ?? 0)}
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-4 p-5">
                <div className="flex size-11 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600">
                  <Phone className="size-5" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Telefon ulashgan</p>
                  <p className="text-2xl font-bold">
                    {loading ? "—" : (stats?.withPhone ?? 0)}
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-4 p-5">
                <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <UserCheck className="size-5" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Bazada topilgan</p>
                  <p className="text-2xl font-bold">
                    {loading ? "—" : (stats?.linkedTenant ?? 0)}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative max-w-sm flex-1">
              <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Ism, telefon, username..."
                className="pl-9"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
            </div>
          </div>

          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div className="space-y-2 p-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : rows.length === 0 ? (
                <div className="p-8">
                  <EmptyState
                    icon={Bot}
                    title="Hali foydalanuvchi yo'q"
                    description="Botda /start bosganlar shu yerda ko'rinadi."
                  />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ism</TableHead>
                      <TableHead>Telefon</TableHead>
                      <TableHead>Rol</TableHead>
                      <TableHead>Arendator</TableHead>
                      <TableHead>/start</TableHead>
                      <TableHead>Oxirgi kirish</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>
                          <div className="font-medium">{row.displayName}</div>
                          {row.username && (
                            <div className="text-xs text-muted-foreground">
                              @{row.username}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          {row.phone ? (
                            <span className="font-mono text-sm">{row.phone}</span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {row.selectedRole ? (
                            <Badge variant="secondary">
                              {ROLE_LABEL[row.selectedRole] ?? row.selectedRole}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {row.tenantName ? (
                            <span className="text-sm">{row.tenantName}</span>
                          ) : row.phoneVerifiedAt ? (
                            <Badge variant="outline">Tasdiqlangan</Badge>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>{row.startCount}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(row.lastStartAt)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {meta && meta.totalPages > 1 && (
            <Pagination
              page={meta.page}
              totalPages={meta.totalPages}
              total={meta.total}
              onPageChange={setPage}
            />
          )}
        </>
      )}
    </div>
  );
}
