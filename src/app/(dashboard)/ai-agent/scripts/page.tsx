"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Eye,
  FileText,
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
  AI_AGENT_SCRIPT_CATEGORIES,
  type AiAgentScriptCategory,
} from "@/lib/api-server/ai-agent-content/schemas";

type ScriptRow = {
  id: string;
  title: string;
  category: AiAgentScriptCategory;
  content: string;
  active: boolean;
  updatedAt: string;
};

type ListPayload = {
  data: ScriptRow[];
  total: number;
};

const CATEGORY_LABELS: Record<AiAgentScriptCategory, string> = {
  GREETING: "Greeting",
  PRICE_INFO: "Price info",
  CONTRACT: "Contract",
  VIEWING: "Viewing",
  PAYMENT: "Payment",
  PARKING: "Parking",
  INTERNET: "Internet",
  GENERAL: "General",
};

export default function AiAgentScriptsPage() {
  const [rows, setRows] = useState<ScriptRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [preview, setPreview] = useState<ScriptRow | null>(null);
  const [editing, setEditing] = useState<ScriptRow | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: "",
    category: "GENERAL" as AiAgentScriptCategory,
    content: "",
    active: true,
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ limit: "100" });
      if (search.trim()) qs.set("search", search.trim());
      if (category !== "all") qs.set("category", category);
      const res = await apiFetch<ListPayload>(`/ai-agent/scripts?${qs}`);
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

  const openCreate = () => {
    setEditing(null);
    setForm({ title: "", category: "GENERAL", content: "", active: true });
    setDialogOpen(true);
  };

  const openEdit = (row: ScriptRow) => {
    setEditing(row);
    setForm({
      title: row.title,
      category: row.category,
      content: row.content,
      active: row.active,
    });
    setDialogOpen(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      if (editing) {
        await apiFetch(`/ai-agent/scripts/${editing.id}`, {
          method: "PATCH",
          body: form,
        });
        toast.success("Script yangilandi");
      } else {
        await apiFetch("/ai-agent/scripts", { method: "POST", body: form });
        toast.success("Script yaratildi");
      }
      setDialogOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Saqlash xatosi");
    } finally {
      setSaving(false);
    }
  };

  const deactivate = async (row: ScriptRow) => {
    try {
      await apiFetch(`/ai-agent/scripts/${row.id}`, {
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
      await apiFetch(`/ai-agent/scripts/${deleteId}`, { method: "DELETE" });
      toast.success("O‘chirildi");
      setDeleteId(null);
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "O‘chirish xatosi");
    }
  };

  const filteredHint = useMemo(
    () => `${rows.length} ta script`,
    [rows.length]
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="AI Agent — Scripts"
        description="Telegram AI agent uchun matn skriptlari"
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
            {AI_AGENT_SCRIPT_CATEGORIES.map((c) => (
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
        <EmptyState
          icon={FileText}
          title="Script yo‘q"
          description="Birinchi skriptni qo‘shing"
        />
      ) : (
        <>
          <p className="text-sm text-muted-foreground">{filteredHint}</p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.title}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {CATEGORY_LABELS[row.category]}
                    </Badge>
                  </TableCell>
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
                        <DropdownMenuItem onClick={() => void deactivate(row)}>
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
        </>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit script" : "Add script"}
            </DialogTitle>
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
                    category: v as AiAgentScriptCategory,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AI_AGENT_SCRIPT_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {CATEGORY_LABELS[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Content</Label>
              <Textarea
                rows={8}
                value={form.content}
                onChange={(e) =>
                  setForm((f) => ({ ...f, content: e.target.value }))
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
          <pre className="max-h-[50vh] overflow-auto whitespace-pre-wrap rounded-md bg-muted p-3 text-sm">
            {preview?.content}
          </pre>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(o) => !o && setDeleteId(null)}
        title="Scriptni o‘chirish?"
        description="Bu amalni qaytarib bo‘lmaydi."
        onConfirm={() => void remove()}
      />
    </div>
  );
}
