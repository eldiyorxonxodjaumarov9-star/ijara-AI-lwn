"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Camera, Link2, Loader2, Plug, Save, Unplug, Zap } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export type InstagramStatus = {
  enabled: boolean;
  connected: boolean;
  hasToken: boolean;
  hasAppId: boolean;
  appId?: string;
  redirectUri?: string;
  accountId?: string;
  username?: string;
  accountType?: string;
  accountName?: string;
  profilePictureUrl?: string;
  error?: string;
};

async function parseRes<T>(res: Response): Promise<T> {
  const json = await res.json();
  if (!res.ok) throw new Error(json?.message ?? "So'rov xatosi");
  return (json?.data ?? json) as T;
}

export function InstagramSettingsPanel() {
  const [status, setStatus] = useState<InstagramStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [connecting, setConnecting] = useState(false);

  const [enabled, setEnabled] = useState(false);
  const [appId, setAppId] = useState("");
  const [appSecret, setAppSecret] = useState("");
  const [redirectUri, setRedirectUri] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [accountId, setAccountId] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/integrations/instagram/status", { cache: "no-store" });
      const data = await parseRes<InstagramStatus>(res);
      setStatus(data);
      setEnabled(data.enabled);
      setAppId(data.appId ?? "");
      setRedirectUri(
        data.redirectUri ??
          `${typeof window !== "undefined" ? window.location.origin : ""}/api/integrations/instagram/callback`
      );
      setAccountId(data.accountId ?? "");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Yuklash xatosi");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const ig = params.get("instagram");
    const msg = params.get("message");
    const username = params.get("username");
    if (ig === "connected") {
      toast.success(`Instagram ulandi${username ? `: @${username}` : ""}`);
      void load();
      params.delete("instagram");
      params.delete("username");
      params.delete("message");
      window.history.replaceState({}, "", `${window.location.pathname}?${params}`);
    }
    if (ig === "error" && msg) {
      toast.error(decodeURIComponent(msg));
      params.delete("instagram");
      params.delete("message");
      window.history.replaceState({}, "", `${window.location.pathname}?${params}`);
    }
  }, [load]);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/integrations/instagram", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled,
          appId: appId.trim(),
          redirectUri: redirectUri.trim(),
          accountId: accountId.trim(),
          ...(appSecret.trim() ? { appSecret: appSecret.trim() } : {}),
          ...(accessToken.trim() ? { accessToken: accessToken.trim() } : {}),
        }),
      });
      const data = await parseRes<InstagramStatus>(res);
      setStatus(data);
      setAppSecret("");
      setAccessToken("");
      toast.success("Instagram sozlamalari saqlandi");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Saqlash xatosi");
    } finally {
      setSaving(false);
    }
  };

  const testConnection = async () => {
    setTesting(true);
    try {
      const res = await fetch("/api/integrations/instagram/test", { method: "POST" });
      const data = await parseRes<{ ok: boolean; message: string }>(res);
      toast.success(data.message);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Test xatosi");
    } finally {
      setTesting(false);
    }
  };

  const connectOAuth = async () => {
    setConnecting(true);
    try {
      await save();
      const res = await fetch("/api/integrations/instagram/auth-url");
      const data = await parseRes<{ url: string }>(res);
      window.location.href = data.url;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "OAuth xatosi");
      setConnecting(false);
    }
  };

  const disconnect = async () => {
    try {
      await fetch("/api/integrations/instagram/disconnect", { method: "POST" });
      toast.success("Instagram uzildi");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Uzish xatosi");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="mr-2 size-5 animate-spin" /> Yuklanmoqda...
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Camera className="size-5" />
          Instagram integratsiyasi
        </CardTitle>
        <CardDescription>
          Business/Creator akkaunt orqali avtomatik post joylash. Tokenlar faqat serverda saqlanadi.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          {status?.connected ? (
            <Badge className="bg-emerald-600">Ulangan</Badge>
          ) : (
            <Badge variant="secondary">Ulanmagan</Badge>
          )}
          {status?.username && (
            <Badge variant="outline">@{status.username}</Badge>
          )}
          {status?.accountType && (
            <Badge variant="outline">{status.accountType}</Badge>
          )}
        </div>

        {status?.error && (
          <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
            {status.error}
          </div>
        )}

        <div className="flex items-center justify-between rounded-lg border p-4">
          <div>
            <p className="font-medium">Instagram yoqilgan</p>
            <p className="text-sm text-muted-foreground">
              O&apos;chirilsa — manual_required status qaytadi
            </p>
          </div>
          <Switch checked={enabled} onCheckedChange={setEnabled} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>App ID</Label>
            <Input value={appId} onChange={(e) => setAppId(e.target.value)} placeholder="Meta App ID" />
          </div>
          <div className="space-y-1.5">
            <Label>App Secret</Label>
            <Input
              type="password"
              value={appSecret}
              onChange={(e) => setAppSecret(e.target.value)}
              placeholder={status?.hasAppId ? "•••••••• (saqlangan)" : "App Secret"}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Redirect URI</Label>
            <Input value={redirectUri} onChange={(e) => setRedirectUri(e.target.value)} />
            <p className="text-xs text-muted-foreground">
              Meta Developer Console → Instagram → Valid OAuth Redirect URIs ga qo&apos;shing
            </p>
          </div>
          <div className="space-y-1.5">
            <Label>Access Token (ixtiyoriy — OAuth tavsiya)</Label>
            <Input
              type="password"
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
              placeholder={status?.hasToken ? "•••••••• (saqlangan)" : "Long-lived token"}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Account ID (IG User ID)</Label>
            <Input
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              placeholder="178414..."
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={() => void save()} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Saqlash
          </Button>
          <Button
            variant="default"
            className="gap-2"
            onClick={() => void connectOAuth()}
            disabled={connecting || !appId.trim()}
          >
            {connecting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Link2 className="size-4" />
            )}
            Instagram ulash (OAuth)
          </Button>
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => void testConnection()}
            disabled={testing}
          >
            {testing ? <Loader2 className="size-4 animate-spin" /> : <Zap className="size-4" />}
            Test connection
          </Button>
          {status?.connected && (
            <Button variant="destructive" className="gap-2" onClick={() => void disconnect()}>
              <Unplug className="size-4" /> Disconnect
            </Button>
          )}
        </div>

        <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          <p className="flex items-center gap-2 font-medium text-foreground">
            <Plug className="size-4" /> .env o&apos;zgaruvchilar
          </p>
          <p className="mt-1">
            INSTAGRAM_ENABLED, INSTAGRAM_APP_ID, INSTAGRAM_APP_SECRET, INSTAGRAM_REDIRECT_URI,
            INSTAGRAM_ACCESS_TOKEN, INSTAGRAM_ACCOUNT_ID
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export function InstagramConnectButton({
  variant = "outline",
  size = "sm",
}: {
  variant?: "outline" | "default" | "secondary";
  size?: "sm" | "default";
}) {
  return (
    <Button variant={variant} size={size} asChild className="gap-1">
      <Link href="/settings?tab=posting">
        <Camera className="size-4" /> Instagram ulash
      </Link>
    </Button>
  );
}
