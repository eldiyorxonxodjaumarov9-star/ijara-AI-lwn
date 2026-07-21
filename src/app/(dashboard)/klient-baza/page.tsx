"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Archive,
  Loader2,
  Phone,
  Plus,
  Search,
  Trash2,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Pagination } from "@/components/shared/pagination";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { useTableData } from "@/hooks/use-table-data";
import {
  createContactLead,
  deleteContactLead,
  fetchClientDatabase,
} from "@/lib/client-database-client";
import { CONTACT_INTEREST_MAP } from "@/lib/constants";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { ClientDatabaseRow, ContactInterest } from "@/types";

type TabFilter = "all" | "active" | "left" | "contact";

const KIND_LABEL: Record<
  ClientDatabaseRow["kind"],
  { label: string; variant: "success" | "secondary" | "default" }
> = {
  active: { label: "Faol", variant: "success" },
  left: { label: "Chiqib ketgan", variant: "secondary" },
  contact: { label: "Kontakt", variant: "default" },
};

export default function KlientBazaPage() {
  const [rows, setRows] = useState<ClientDatabaseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabFilter>("all");
  const [selected, setSelected] = useState<ClientDatabaseRow | null>(null);
  const [contactOpen, setContactOpen] = useState(false);
  const [deleteContactId, setDeleteContactId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [interest, setInterest] = useState<ContactInterest>("called");
  const [notes, setNotes] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await fetchClientDatabase());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Yuklash xatosi");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    if (tab === "all") return rows;
    return rows.filter((r) => r.kind === tab);
  }, [rows, tab]);

  const { search, setSearch, page, setPage, totalPages, total, paged } =
    useTableData<ClientDatabaseRow>({
      data: filtered,
      searchFields: [
        "clientNumber",
        "fullName",
        "phone",
        "propertyName",
        "passport",
        "notes",
      ],
      pageSize: 12,
    });

  const stats = useMemo(() => {
    const active = rows.filter((r) => r.kind === "active").length;
    const left = rows.filter((r) => r.kind === "left").length;
    const contacts = rows.filter((r) => r.kind === "contact").length;
    const totalPaid = rows.reduce((s, r) => s + (r.totalPaid || 0), 0);
    return { active, left, contacts, totalPaid, all: rows.length };
  }, [rows]);

  const resetContactForm = () => {
    setFullName("");
    setPhone("");
    setInterest("called");
    setNotes("");
  };

  const handleAddContact = async () => {
    if (!fullName.trim() || !phone.trim()) {
      toast.error("Ism va telefon majburiy");
      return;
    }
    setSaving(true);
    try {
      await createContactLead({
        fullName: fullName.trim(),
        phone: phone.trim(),
        interest,
        notes: notes.trim() || undefined,
        source: "telefon",
      });
      toast.success("Kontakt qo'shildi");
      setContactOpen(false);
      resetContactForm();
      await load();
      setTab("contact");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Xatolik");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteContact = async () => {
    if (!deleteContactId) return;
    const id = deleteContactId.replace(/^contact-/, "");
    try {
      await deleteContactLead(id);
      toast.success("Kontakt o'chirildi");
      setDeleteContactId(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "O'chirish xatosi");
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Klient bazasi"
        description="Barcha klientlar raqami, faol va chiqib ketganlar, telefon kontaktlari — bir joyda."
        action={
          <Button
            onClick={() => {
              resetContactForm();
              setContactOpen(true);
            }}
          >
            <Plus className="size-4" /> Kontakt qo&apos;shish
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Jami</p>
            <p className="text-2xl font-bold">{stats.all}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Faol</p>
            <p className="text-2xl font-bold text-primary">{stats.active}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Chiqib ketgan</p>
            <p className="text-2xl font-bold">{stats.left}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Kontaktlar</p>
            <p className="text-2xl font-bold">{stats.contacts}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs
        value={tab}
        onValueChange={(v) => {
          setTab(v as TabFilter);
          setPage(1);
        }}
      >
        <TabsList className="flex h-auto flex-wrap gap-1">
          <TabsTrigger value="all">Hammasi ({stats.all})</TabsTrigger>
          <TabsTrigger value="active">Faol ({stats.active})</TabsTrigger>
          <TabsTrigger value="left">Chiqib ketgan ({stats.left})</TabsTrigger>
          <TabsTrigger value="contact">
            Kontaktlar ({stats.contacts})
          </TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-4 space-y-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Raqam, ism, telefon yoki xona..."
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
                    icon={tab === "contact" ? Phone : Archive}
                    title={
                      tab === "contact"
                        ? "Kontaktlar yo'q"
                        : tab === "left"
                          ? "Chiqib ketganlar yo'q"
                          : "Hali yozuv yo'q"
                    }
                    description={
                      tab === "contact"
                        ? "Telefon qilgan yoki qiziqqan odamlarni qo'shing."
                        : "Arendatorlar va chiqishlar shu yerda ko'rinadi."
                    }
                  />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>№</TableHead>
                      <TableHead>F.I.O</TableHead>
                      <TableHead>Telefon</TableHead>
                      <TableHead className="hidden md:table-cell">Xona</TableHead>
                      <TableHead>Holat</TableHead>
                      <TableHead className="hidden lg:table-cell">Kirish</TableHead>
                      <TableHead className="hidden lg:table-cell">Chiqish</TableHead>
                      <TableHead className="hidden sm:table-cell">
                        To&apos;langan
                      </TableHead>
                      <TableHead className="w-12" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paged.map((row) => {
                      const kind = KIND_LABEL[row.kind];
                      const interestMeta = row.interest
                        ? CONTACT_INTEREST_MAP[row.interest]
                        : null;
                      return (
                        <TableRow
                          key={row.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => setSelected(row)}
                        >
                          <TableCell>
                            {row.clientNumber ? (
                              <Badge variant="outline">{row.clientNumber}</Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                —
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="font-medium">
                            {row.fullName}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {row.phone}
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            {row.propertyName ?? "—"}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              <Badge variant={kind.variant}>{kind.label}</Badge>
                              {interestMeta ? (
                                <Badge variant={interestMeta.variant}>
                                  {interestMeta.label}
                                </Badge>
                              ) : null}
                            </div>
                          </TableCell>
                          <TableCell className="hidden whitespace-nowrap text-muted-foreground lg:table-cell">
                            {row.entryDate ? formatDate(row.entryDate) : "—"}
                          </TableCell>
                          <TableCell className="hidden whitespace-nowrap text-muted-foreground lg:table-cell">
                            {row.leaveDate ? formatDate(row.leaveDate) : "—"}
                          </TableCell>
                          <TableCell className="hidden font-medium text-primary sm:table-cell">
                            {row.kind === "contact"
                              ? "—"
                              : formatCurrency(row.totalPaid ?? 0)}
                          </TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            {row.kind === "contact" ? (
                              <Button
                                size="icon"
                                variant="ghost"
                                className="text-destructive"
                                onClick={() => setDeleteContactId(row.id)}
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            ) : null}
                          </TableCell>
                        </TableRow>
                      );
                    })}
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
        </TabsContent>
      </Tabs>

      <p className="text-xs text-muted-foreground">
        Jami to&apos;langan (faol + chiqib ketgan):{" "}
        <span className="font-semibold text-foreground">
          {formatCurrency(stats.totalPaid)}
        </span>
        . Klient chiqsa pul kamaymaydi — tarix saqlanadi.
      </p>

      {/* Detail dialog */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserRound className="size-5" />
              {selected?.fullName}
            </DialogTitle>
            <DialogDescription>
              {selected?.clientNumber
                ? `Klient raqami: ${selected.clientNumber}`
                : selected?.kind === "contact"
                  ? "Telefon kontakti"
                  : "Klient"}
            </DialogDescription>
          </DialogHeader>
          {selected && (
            <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">Telefon</dt>
                <dd className="font-medium">{selected.phone}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Holat</dt>
                <dd className="font-medium">
                  {KIND_LABEL[selected.kind].label}
                  {selected.interest
                    ? ` · ${CONTACT_INTEREST_MAP[selected.interest].label}`
                    : ""}
                </dd>
              </div>
              {selected.propertyName ? (
                <div>
                  <dt className="text-muted-foreground">Xona</dt>
                  <dd className="font-medium">{selected.propertyName}</dd>
                </div>
              ) : null}
              {selected.passport ? (
                <div>
                  <dt className="text-muted-foreground">Pasport</dt>
                  <dd className="font-medium">{selected.passport}</dd>
                </div>
              ) : null}
              <div>
                <dt className="text-muted-foreground">Kirish / yozilgan</dt>
                <dd className="font-medium">
                  {selected.entryDate ? formatDate(selected.entryDate) : "—"}
                </dd>
              </div>
              {selected.leaveDate ? (
                <div>
                  <dt className="text-muted-foreground">Chiqish</dt>
                  <dd className="font-medium">
                    {formatDate(selected.leaveDate)}
                  </dd>
                </div>
              ) : null}
              {selected.kind !== "contact" ? (
                <>
                  <div>
                    <dt className="text-muted-foreground">Oylik</dt>
                    <dd className="font-medium">
                      {formatCurrency(selected.monthlyRent ?? 0)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Jami to&apos;langan</dt>
                    <dd className="text-lg font-bold text-primary">
                      {formatCurrency(selected.totalPaid ?? 0)}
                    </dd>
                  </div>
                </>
              ) : null}
              {selected.notes ? (
                <div className="sm:col-span-2">
                  <dt className="text-muted-foreground">Izoh</dt>
                  <dd>{selected.notes}</dd>
                </div>
              ) : null}
            </dl>
          )}
        </DialogContent>
      </Dialog>

      {/* Add contact dialog */}
      <Dialog
        open={contactOpen}
        onOpenChange={(o) => {
          if (!saving) setContactOpen(o);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Phone className="size-5" /> Kontakt qo&apos;shish
            </DialogTitle>
            <DialogDescription>
              Telefon qilgan yoki qiziqqan odamni belgilang.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Ism familiya</Label>
              <Input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Masalan: Ali Valiyev"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Telefon</Label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+998 90 123 45 67"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Holat</Label>
              <Select
                value={interest}
                onValueChange={(v) => setInterest(v as ContactInterest)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CONTACT_INTEREST_MAP).map(([key, meta]) => (
                    <SelectItem key={key} value={key}>
                      {meta.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Izoh</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Masalan: 2 xonali kvartira so'radi"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => setContactOpen(false)}
            >
              Bekor
            </Button>
            <Button type="button" disabled={saving} onClick={handleAddContact}>
              {saving && <Loader2 className="size-4 animate-spin" />}
              Saqlash
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteContactId}
        onOpenChange={(o) => !o && setDeleteContactId(null)}
        title="Kontaktni o'chirish"
        description="Bu kontakt o'chiriladi. Davom etasizmi?"
        onConfirm={handleDeleteContact}
      />
    </div>
  );
}
