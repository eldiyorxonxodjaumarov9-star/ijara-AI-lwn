"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import {
  Eye,
  ImageIcon,
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
import { ImageUpload } from "@/components/shared/image-upload";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import {
  AI_AGENT_MEDIA_CATEGORIES,
  type AiAgentMediaCategory,
} from "@/lib/api-server/ai-agent-content/schemas";

type MediaRow = {
  id: string;
  title: string;
  category: AiAgentMediaCategory;
  roomId: string | null;
  description: string | null;
  fileUrl: string;
  active: boolean;
  sortOrder: number;
  room?: { id: string; title: string; building: string | null } | null;
};

type ListPayload = { data: MediaRow[] };
type RoomOption = { id: string; name?: string; title?: string };

const CATEGORY_LABELS: Record<AiAgentMediaCategory, string> = {
  ROOM: "Room",
  OFFICE: "Office",
  BUILDING: "Building",
  ENTRANCE: "Entrance",
  PARKING: "Parking",
  LOCATION: "Location",
  OTHER: "Other",
};

export default function AiAgentMediaPage() {
  const [rows, setRows] = useState<MediaRow[]>([]);
  const [rooms, setRooms] = useState<RoomOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [preview, setPreview] = useState<MediaRow | null>(null);
  const [editing, setEditing] = useState<MediaRow | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: "",
    category: "OTHER" as AiAgentMediaCategory,
    roomId: "",
    description: "",
    fileUrl: "",
    active: true,
    sortOrder: 0,
  });

  const loadRooms = useCallback(async () => {
    try {
      const res = await apiFetch<{ data: RoomOption[] } | RoomOption[]>(
        "/properties?limit=200"
      );
      const list = Array.isArray(res)
        ? res
        : Array.isArray((res as { data?: RoomOption[] })?.data)
          ? (res as { data: RoomOption[] }).data
          : [];
      setRooms(list);
    } catch {
      setRooms([]);
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ limit: "100" });
      if (search.trim()) qs.set("search", search.trim());
      if (category !== "all") qs.set("category", category);
      const res = await apiFetch<ListPayload>(`/ai-agent/media?${qs}`);
      setRows(res?.data ?? []);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Yuklash xatosi");
    } finally {
      setLoading(false);
    }
  }, [search, category]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadRooms();
  }, [loadRooms]);

  const openCreate = () => {
    setEditing(null);
    setForm({
      title: "",
      category: "OTHER",
      roomId: "",
      description: "",
      fileUrl: "",
      active: true,
      sortOrder: 0,
    });
    setDialogOpen(true);
  };

  const openEdit = (row: MediaRow) => {
    setEditing(row);
    setForm({
      title: row.title,
      category: row.category,
      roomId: row.roomId ?? "",
      description: row.description ?? "",
      fileUrl: row.fileUrl,
      active: row.active,
      sortOrder: row.sortOrder,
    });
    setDialogOpen(true);
  };

  const save = async () => {
    if (!form.fileUrl) {
      toast.error("Rasm yuklang");
      return;
    }
    setSaving(true);
    try {
      const body = {
        title: form.title,
        category: form.category,
        roomId: form.roomId || null,
        description: form.description || null,
        fileUrl: form.fileUrl,
        active: form.active,
        sortOrder: Number(form.sortOrder) || 0,
      };
      if (editing) {
        await apiFetch(`/ai-agent/media/${editing.id}`, {
          method: "PATCH",
          body,
        });
        toast.success("Media yangilandi");
      } else {
        await apiFetch("/ai-agent/media", { method: "POST", body });
        toast.success("Media yaratildi");
      }
      setDialogOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Saqlash xatosi");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (row: MediaRow) => {
    try {
      await apiFetch(`/ai-agent/media/${row.id}`, {
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
      await apiFetch(`/ai-agent/media/${deleteId}`, { method: "DELETE" });
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
        title="AI Agent — Media Library"
        description="Rasmlar Vercel Blob orqali saqlanadi"
        action={
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Add
          </Button>
        }
      />
      <AiAgentSubnav />

      <div className="flex flex-wrap gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Qidirish..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Barcha</SelectItem>
            {AI_AGENT_MEDIA_CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>
                {CATEGORY_LABELS[c]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Yuklanmoqda...</p>
      ) : rows.length === 0 ? (
        <EmptyState icon={ImageIcon} title="Media yo‘q" description="Rasm qo‘shing" />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Preview</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Room</TableHead>
              <TableHead>Order</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>
                  <div className="relative h-12 w-12 overflow-hidden rounded border">
                    <Image
                      src={row.fileUrl}
                      alt={row.title}
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  </div>
                </TableCell>
                <TableCell className="font-medium">{row.title}</TableCell>
                <TableCell>
                  <Badge variant="secondary">
                    {CATEGORY_LABELS[row.category]}
                  </Badge>
                </TableCell>
                <TableCell>
                  {row.room?.title ?? row.roomId?.slice(0, 8) ?? "—"}
                </TableCell>
                <TableCell>{row.sortOrder}</TableCell>
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
            <DialogTitle>{editing ? "Edit media" : "Add media"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Title</Label>
              <Input
                value={form.title}
                onChange={(e) =>
                  setForm((f) => ({ ...f, title: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label>Category</Label>
              <Select
                value={form.category}
                onValueChange={(v) =>
                  setForm((f) => ({
                    ...f,
                    category: v as AiAgentMediaCategory,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AI_AGENT_MEDIA_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {CATEGORY_LABELS[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Room (optional)</Label>
              <Select
                value={form.roomId || "none"}
                onValueChange={(v) =>
                  setForm((f) => ({
                    ...f,
                    roomId: v === "none" ? "" : v,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Xona tanlang" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Bog‘lanmagan</SelectItem>
                  {rooms.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name ?? r.title ?? r.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Description</Label>
              <Textarea
                rows={3}
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label>Sort order</Label>
              <Input
                type="number"
                value={form.sortOrder}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    sortOrder: Number(e.target.value) || 0,
                  }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label>Image</Label>
              <ImageUpload
                folder="ai-agent-media"
                multiple={false}
                value={form.fileUrl ? [form.fileUrl] : []}
                onChange={(urls) =>
                  setForm((f) => ({ ...f, fileUrl: urls[0] ?? "" }))
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
          {preview?.fileUrl ? (
            <div className="relative aspect-video w-full overflow-hidden rounded border">
              <Image
                src={preview.fileUrl}
                alt={preview.title}
                fill
                className="object-contain"
                unoptimized
              />
            </div>
          ) : null}
          <p className="text-sm whitespace-pre-wrap">{preview?.description}</p>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(o) => !o && setDeleteId(null)}
        title="Mediani o‘chirish?"
        onConfirm={() => void remove()}
      />
    </div>
  );
}
