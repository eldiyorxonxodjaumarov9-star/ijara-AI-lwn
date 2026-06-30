"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CheckCircle2,
  Loader2,
  Plus,
  Send,
  ShieldCheck,
  Trash2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  checkTelegramChannelAdminApi,
  createTelegramChannelApi,
  deleteTelegramChannelApi,
  fetchTelegramChannels,
  processTelegramQueueApi,
  testTelegramChannelApi,
  updateTelegramChannelApi,
} from "@/lib/telegram-distribution/client";
import type { TelegramChannelView } from "@/lib/telegram-distribution/types";

const EMPTY_FORM = {
  name: "",
  username: "",
  chatId: "",
  regionFilters: "",
  propertyTypeFilters: "",
  priority: "0",
  enabled: true,
};

export function TelegramDistributionPanel() {
  const [channels, setChannels] = useState<TelegramChannelView[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editing, setEditing] = useState<TelegramChannelView | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setChannels(await fetchTelegramChannels());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Yuklash xatosi");
      setChannels([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (ch: TelegramChannelView) => {
    setEditing(ch);
    setForm({
      name: ch.name,
      username: ch.username ?? "",
      chatId: ch.chatId,
      regionFilters: ch.regionFilters?.join(", ") ?? "",
      propertyTypeFilters: ch.propertyTypeFilters?.join(", ") ?? "",
      priority: String(ch.priority),
      enabled: ch.enabled ?? true,
    });
    setDialogOpen(true);
  };

  const save = async () => {
    const payload = {
      name: form.name.trim(),
      username: form.username.trim() || undefined,
      chatId: form.chatId.trim(),
      enabled: form.enabled,
      regionFilters: form.regionFilters
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      propertyTypeFilters: form.propertyTypeFilters
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      priority: Number(form.priority) || 0,
    };
    try {
      if (editing) {
        await updateTelegramChannelApi(editing.id, payload);
        toast.success("Kanal yangilandi");
      } else {
        await createTelegramChannelApi(payload);
        toast.success("Kanal qo'shildi");
      }
      setDialogOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Saqlash xatosi");
    }
  };

  const onTest = async (id: string) => {
    setBusy(`test-${id}`);
    try {
      await testTelegramChannelApi(id);
      toast.success("Test xabari yuborildi");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Test xatosi");
    } finally {
      setBusy(null);
    }
  };

  const onCheckAdmin = async (id: string) => {
    setBusy(`admin-${id}`);
    try {
      const r = await checkTelegramChannelAdminApi(id);
      toast.success(
        r.isAdmin
          ? `Bot admin (@${r.botUsername ?? "bot"})`
          : `Bot admin emas: ${r.status}`
      );
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Tekshirish xatosi");
    } finally {
      setBusy(null);
    }
  };

  const onDelete = async (id: string) => {
    if (!confirm("Kanalni o'chirasizmi?")) return;
    try {
      await deleteTelegramChannelApi(id);
      toast.success("O'chirildi");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Xato");
    }
  };

  const onProcessQueue = async () => {
    setBusy("queue");
    try {
      const r = await processTelegramQueueApi();
      toast.success(`Navbat: ${r.processed} ta ishlandi`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Navbat xatosi");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Send className="size-5" />
            Telegram Distribution
          </CardTitle>
          <CardDescription className="mt-1 max-w-2xl">
            Hudud va mulk turiga qarab AI routing — masalan Chilonzor →
            @chilonzor_ijara, @toshkent_ijara, @arenda_ai. Bo&apos;sh filtr = barcha
            e&apos;lonlar.
          </CardDescription>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" size="sm" disabled={busy === "queue"} onClick={() => void onProcessQueue()}>
            {busy === "queue" ? <Loader2 className="size-4 animate-spin" /> : "Navbat"}
          </Button>
          <Button size="sm" onClick={openCreate}>
            <Plus className="size-4" /> Kanal
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : channels.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Kanallar yo&apos;q. Birinchi Telegram kanalni qo&apos;shing.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kanal</TableHead>
                <TableHead className="hidden md:table-cell">Hudud</TableHead>
                <TableHead className="hidden lg:table-cell">Mulk turi</TableHead>
                <TableHead>Admin</TableHead>
                <TableHead className="text-right">Amallar</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {channels.map((ch) => (
                <TableRow key={ch.id}>
                  <TableCell>
                    <div className="font-medium">{ch.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {ch.username ? `@${ch.username}` : ch.chatId} · P{ch.priority}
                    </div>
                    {!ch.enabled && (
                      <Badge variant="secondary" className="mt-1 text-[10px]">
                        O&apos;chirilgan
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="hidden max-w-[140px] truncate text-xs md:table-cell">
                    {ch.regionFilters?.length ? ch.regionFilters.join(", ") : "Barchasi"}
                  </TableCell>
                  <TableCell className="hidden max-w-[140px] truncate text-xs lg:table-cell">
                    {ch.propertyTypeFilters?.length
                      ? ch.propertyTypeFilters.join(", ")
                      : "Barchasi"}
                  </TableCell>
                  <TableCell>
                    {ch.isBotAdmin === true ? (
                      <CheckCircle2 className="size-4 text-emerald-600" />
                    ) : ch.isBotAdmin === false ? (
                      <XCircle className="size-4 text-destructive" />
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        title="Admin tekshirish"
                        disabled={!!busy}
                        onClick={() => void onCheckAdmin(ch.id)}
                      >
                        <ShieldCheck className="size-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs"
                        disabled={busy === `test-${ch.id}`}
                        onClick={() => void onTest(ch.id)}
                      >
                        Test
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => openEdit(ch)}>
                        Tahrir
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() => void onDelete(ch.id)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Kanalni tahrirlash" : "Yangi kanal"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nomi</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Chilonzor ijara"
              />
            </div>
            <div>
              <Label>Username</Label>
              <Input
                value={form.username}
                onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                placeholder="chilonzor_ijara"
              />
            </div>
            <div>
              <Label>Chat ID</Label>
              <Input
                value={form.chatId}
                onChange={(e) => setForm((f) => ({ ...f, chatId: e.target.value }))}
                placeholder="-1001234567890"
              />
            </div>
            <div>
              <Label>Hudud filtri (vergul bilan)</Label>
              <Input
                value={form.regionFilters}
                onChange={(e) => setForm((f) => ({ ...f, regionFilters: e.target.value }))}
                placeholder="Chilonzor, Toshkent, *"
              />
            </div>
            <div>
              <Label>Mulk turi filtri</Label>
              <Input
                value={form.propertyTypeFilters}
                onChange={(e) =>
                  setForm((f) => ({ ...f, propertyTypeFilters: e.target.value }))
                }
                placeholder="Ofis, Do'kon, *"
              />
            </div>
            <div>
              <Label>Priority</Label>
              <Input
                type="number"
                value={form.priority}
                onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={form.enabled}
                onCheckedChange={(v) => setForm((f) => ({ ...f, enabled: v }))}
              />
              <Label>Yoqilgan</Label>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => void save()}>Saqlash</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
