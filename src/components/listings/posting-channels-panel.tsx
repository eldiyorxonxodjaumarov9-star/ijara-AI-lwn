"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw, Save } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  fetchPostingChannels,
  updatePostingChannelClient,
  type PublicChannel,
} from "@/lib/posting/client";
import { PLATFORM_LABELS, POSTING_PLATFORMS } from "@/lib/posting/types";

type ChannelForm = PublicChannel & {
  botToken?: string;
  accessToken?: string;
  channelId?: string;
  igUserId?: string;
};

function channelToForm(c: PublicChannel): ChannelForm {
  return {
    ...c,
    channelId: c.settings.channelId ?? "",
    igUserId: c.settings.igUserId ?? "",
  };
}

export function PostingChannelsPanel({ hideInstagram = false }: { hideInstagram?: boolean }) {
  const [channels, setChannels] = useState<ChannelForm[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchPostingChannels();
      setChannels(
        POSTING_PLATFORMS.map(
          (p) => channelToForm(data.find((d) => d.platform === p) ?? {
            platform: p,
            enabled: p === "ARENDA_INTERNAL" || p === "TELEGRAM",
            settings: {},
            hasBotToken: false,
            hasChannelId: false,
          })
        )
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Kanallar yuklanmadi");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const updateLocal = (platform: ChannelForm["platform"], patch: Partial<ChannelForm>) => {
    setChannels((prev) =>
      prev.map((c) => (c.platform === platform ? { ...c, ...patch } : c))
    );
  };

  const saveChannel = async (platform: ChannelForm["platform"]) => {
    const ch = channels.find((c) => c.platform === platform);
    if (!ch) return;

    setSaving(platform);
    try {
      await updatePostingChannelClient(platform, {
        enabled: ch.enabled,
        settings: {
          channelId: ch.channelId?.trim() ?? "",
          igUserId: ch.igUserId?.trim() ?? "",
          channelName: ch.settings?.channelName?.trim() ?? "",
          igUsername: ch.settings?.igUsername?.trim() ?? "",
        },
        secrets: {
          ...(ch.botToken?.trim() ? { botToken: ch.botToken.trim() } : {}),
          ...(ch.accessToken?.trim() ? { accessToken: ch.accessToken.trim() } : {}),
        },
      });
      toast.success(`${PLATFORM_LABELS[platform]} saqlandi`);
      setChannels((prev) =>
        prev.map((c) =>
          c.platform === platform
            ? { ...c, botToken: "", accessToken: "", hasBotToken: Boolean(ch.botToken || ch.accessToken || c.hasBotToken) }
            : c
        )
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Saqlash xatosi");
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="mr-2 size-5 animate-spin" />
        Yuklanmoqda...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        API tokenlar faqat serverda saqlanadi. Frontendga token qiymati chiqmaydi.
        OLX, Joymee, egasi.uz va Beste uchun rasmiy API yo&apos;q — qo&apos;lda joylash
        paketi yaratiladi.
      </p>

      {channels.filter((ch) => !hideInstagram || ch.platform !== "INSTAGRAM").map((ch) => (
        <Card key={ch.platform}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base">{PLATFORM_LABELS[ch.platform]}</CardTitle>
            <div className="flex items-center gap-2">
              <Label htmlFor={`enabled-${ch.platform}`} className="text-xs text-muted-foreground">
                Yoqilgan
              </Label>
              <Switch
                id={`enabled-${ch.platform}`}
                checked={ch.enabled}
                onCheckedChange={(v) => updateLocal(ch.platform, { enabled: v })}
                disabled={ch.platform === "ARENDA_INTERNAL"}
              />
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {ch.platform === "TELEGRAM" && (
              <>
                <div className="space-y-1.5">
                  <Label>Bot token</Label>
                  <Input
                    type="password"
                    placeholder={ch.hasBotToken ? "•••••••• (saqlangan)" : "123456:ABC..."}
                    value={ch.botToken ?? ""}
                    onChange={(e) => updateLocal(ch.platform, { botToken: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Kanal / guruh ID</Label>
                  <Input
                    placeholder="-1001234567890"
                    value={ch.channelId ?? ""}
                    onChange={(e) => updateLocal(ch.platform, { channelId: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Kanal nomi (ixtiyoriy)</Label>
                  <Input
                    placeholder="@arenda_ijara"
                    value={ch.settings?.channelName ?? ""}
                    onChange={(e) =>
                      updateLocal(ch.platform, {
                        settings: { ...ch.settings, channelName: e.target.value },
                      })
                    }
                  />
                </div>
              </>
            )}

            {ch.platform === "INSTAGRAM" && (
              <>
                <div className="space-y-1.5">
                  <Label>Access token</Label>
                  <Input
                    type="password"
                    placeholder={ch.hasBotToken ? "•••••••• (saqlangan)" : "IG access token"}
                    value={ch.accessToken ?? ""}
                    onChange={(e) => updateLocal(ch.platform, { accessToken: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Instagram User ID</Label>
                  <Input
                    placeholder="178414..."
                    value={ch.igUserId ?? ""}
                    onChange={(e) => updateLocal(ch.platform, { igUserId: e.target.value })}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Instagram Graph API uchun public rasm URL kerak (Vercel Blob yoki HTTPS).
                </p>
              </>
            )}

            {["OLX", "JOYMEE", "EGASI", "BESTE"].includes(ch.platform) && (
              <p className="text-sm text-muted-foreground">
                Rasmiy API mavjud emas. E&apos;lon qo&apos;shilganda tayyor matn va rasm
                paketi yaratiladi (manual_required).
              </p>
            )}

            {ch.platform === "ARENDA_INTERNAL" && (
              <p className="text-sm text-muted-foreground">
                Ichki Arenda AI bazasi — e&apos;lon ijara qidiruvda avtomatik ko&apos;rinadi.
              </p>
            )}

            {ch.platform !== "ARENDA_INTERNAL" && (
              <Button
                size="sm"
                className="gap-2"
                disabled={saving === ch.platform}
                onClick={() => void saveChannel(ch.platform)}
              >
                {saving === ch.platform ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Save className="size-4" />
                )}
                Saqlash
              </Button>
            )}
          </CardContent>
        </Card>
      ))}

      <Button variant="outline" size="sm" className="gap-2" onClick={() => void load()}>
        <RefreshCw className="size-4" />
        Yangilash
      </Button>
    </div>
  );
}
