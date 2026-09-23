"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Eye,
  MapPin,
  MoreVertical,
  Pencil,
  Plus,
  Power,
  Search,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { AiAgentSubnav } from "@/components/ai-agent/ai-agent-subnav";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch, ApiError } from "@/lib/api/client";

type LocationRow = {
  id: string;
  title: string;
  address: string;
  landmark: string | null;
  mapUrl: string | null;
  workingHours: string | null;
  description: string | null;
  active: boolean;
};

type ListPayload = { data: LocationRow[] };

const emptyForm = {
  title: "",
  address: "",
  landmark: "",
  mapUrl: "",
  workingHours: "",
  description: "",
  active: true,
};

export default function AiAgentLocationsPage() {
  const [rows, setRows] = useState<LocationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [preview, setPreview] = useState<LocationRow | null>(null);
  const [editing, setEditing] = useState<LocationRow | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ limit: "100" });
      if (search.trim()) qs.set("search", search.trim());
      const res = await apiFetch<ListPayload>(`/ai-agent/locations?${qs}`);
      setRows(res?.data ?? []);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Yuklash xatosi");
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    void load();
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (row: LocationRow) => {
    setEditing(row);
    setForm({
      title: row.title,
      address: row.address,
      landmark: row.landmark ?? "",
      mapUrl: row.mapUrl ?? "",
      workingHours: row.workingHours ?? "",
      description: row.description ?? "",
      active: row.active,
    });
    setDialogOpen(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      const body = {
        ...form,
        landmark: form.landmark || null,
        mapUrl: form.mapUrl || null,
        workingHours: form.workingHours || null,
        description: form.description || null,
      };
      if (editing) {
        await apiFetch(`/ai-agent/locations/${editing.id}`, {
          method: "PATCH",
          body,
        });
        toast.success("Lokatsiya yangilandi");
      } else {
        await apiFetch("/ai-agent/locations", { method: "POST", body });
        toast.success("Lokatsiya yaratildi");
      }
      setDialogOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Saqlash xatosi");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (row: LocationRow) => {
    try {
      await apiFetch(`/ai-agent/locations/${row.id}`, {
        method: "PATCH",
        body: { active: !row.active },
      });
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Xatolik");
    }
  };

  const remove = async () => {
    if (!deleteId) return;
    try {
      await apiFetch(`/ai-agent/locations/${deleteId}`, { method: "DELETE" });
      toast.success("O‘chirildi");
      setDeleteId(null);
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "O‘chirish xatosi");
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="AI Agent — Locations"
        description="Filial / ofis manzillari"
        action={
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Add
          </Button>
        }
      />
      <AiAgentSubnav />

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Qidirish..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Yuklanmoqda...</p>
      ) : rows.length === 0 ? (
        <EmptyState icon={MapPin} title="Lokatsiya yo‘q" description="Filial qo‘shing" />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Address</TableHead>
              <TableHead>Hours</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium">{row.title}</TableCell>
                <TableCell>{row.address}</TableCell>
                <TableCell>{row.workingHours ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant={row.active ? "default" : "outline"}>
                    {row.active ? "Active" : "Inactive"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setPreview(row)}>
                        <Eye className="mr-2 h-4 w-4" />
                        Preview
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => openEdit(row)}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => void toggleActive(row)}>
                        <Power className="mr-2 h-4 w-4" />
                        {row.active ? "Deactivate" : "Activate"}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => setDeleteId(row.id)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit location" : "Add location"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {(
              [
                ["title", "Title"],
                ["address", "Address"],
                ["landmark", "Landmark"],
                ["mapUrl", "Map URL"],
                ["workingHours", "Working hours"],
              ] as const
            ).map(([key, label]) => (
              <div key={key} className="space-y-1">
                <Label>{label}</Label>
                <Input
                  value={form[key]}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, [key]: e.target.value }))
                  }
                />
              </div>
            ))}
            <div className="space-y-1">
              <Label>Description</Label>
              <Textarea
                rows={4}
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={form.active}
                onCheckedChange={(active) =>
                  setForm((f) => ({ ...f, active }))
                }
              />
              <Label>Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Bekor
            </Button>
            <Button onClick={() => void save()} disabled={saving}>
              Saqlash
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!preview} onOpenChange={() => setPreview(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{preview?.title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            <p>
              <strong>Address:</strong> {preview?.address}
            </p>
            <p>
              <strong>Landmark:</strong> {preview?.landmark ?? "—"}
            </p>
            <p>
              <strong>Hours:</strong> {preview?.workingHours ?? "—"}
            </p>
            {preview?.mapUrl ? (
              <a
                className="text-primary underline"
                href={preview.mapUrl}
                target="_blank"
                rel="noreferrer"
              >
                Map link
              </a>
            ) : null}
            <p className="whitespace-pre-wrap">{preview?.description}</p>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(o) => !o && setDeleteId(null)}
        title="Lokatsiyani o‘chirish?"
        onConfirm={() => void remove()}
      />
    </div>
  );
}
