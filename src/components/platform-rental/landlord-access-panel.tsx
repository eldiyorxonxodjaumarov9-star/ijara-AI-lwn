"use client";

import { useEffect, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  KeyRound,
  Mail,
  ShieldCheck,
  ShieldX,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CRM_NAV, type CrmViewId } from "@/lib/arenda-crm/constants";
import {
  getLandlordAccess,
  setCrmModuleAccess,
  setLandlordAccess,
  type LandlordAccessRecord,
} from "@/lib/landlord-access";
import {
  adminUpdateLandlordAccount,
  deleteLandlordAccount,
  type LandlordProfile,
} from "@/lib/landlord-profile";
import { cn } from "@/lib/utils";

export function LandlordAccessPanel({
  landlord,
  grantedBy,
  onChange,
  onDeleted,
}: {
  landlord: LandlordProfile;
  grantedBy: string;
  onChange?: () => void;
  onDeleted?: (login: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [access, setAccess] = useState(() => getLandlordAccess(landlord.login));
  const [account, setAccount] = useState(landlord);
  const [currentLogin, setCurrentLogin] = useState(landlord.login);
  const [loginEdit, setLoginEdit] = useState(landlord.login);
  const [email, setEmail] = useState(landlord.email);
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setAccount(landlord);
    setCurrentLogin(landlord.login);
    setLoginEdit(landlord.login);
    setEmail(landlord.email);
    setNewPassword("");
    setAccess(getLandlordAccess(landlord.login));
  }, [landlord]);

  const refresh = () => {
    setAccess(getLandlordAccess(currentLogin));
    onChange?.();
  };

  const togglePortal = (grant: boolean) => {
    setLandlordAccess(currentLogin, grant, grantedBy);
    toast.success(grant ? "CRM kirish ruxsati berildi" : "CRM kirish bloklandi");
    refresh();
  };

  const toggleModule = (module: CrmViewId, allowed: boolean) => {
    if (!access?.granted && allowed) {
      toast.error("Avval umumiy CRM kirish ruxsatini bering");
      return;
    }
    setCrmModuleAccess(currentLogin, module, allowed, grantedBy);
    toast.success(allowed ? "Modul yoqildi" : "Modul o'chirildi — egasiga ko'rinmaydi");
    refresh();
  };

  const saveAccount = () => {
    setSaving(true);
    const result = adminUpdateLandlordAccount(currentLogin, {
      login: loginEdit,
      email,
      password: newPassword || undefined,
    });
    setSaving(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    const loginChanged = result.profile.login !== currentLogin;
    setAccount(result.profile);
    setCurrentLogin(result.profile.login);
    setLoginEdit(result.profile.login);
    setEmail(result.profile.email);
    setNewPassword("");
    setAccess(getLandlordAccess(result.profile.login));
    toast.success(
      loginChanged
        ? "Login, email va parol yangilandi"
        : "Email va parol yangilandi"
    );
    onChange?.();
  };

  const handleDelete = () => {
    const ok = deleteLandlordAccount(currentLogin);
    if (!ok) {
      toast.error("Akkaunt o'chirilmadi");
      return;
    }
    toast.success("Ijara egasi akkaunti o'chirildi");
    setDeleteOpen(false);
    onDeleted?.(currentLogin);
    onChange?.();
  };

  const record: LandlordAccessRecord = access ?? {
    login: landlord.login,
    granted: false,
    modules: Object.fromEntries(CRM_NAV.map((n) => [n.id, false])) as LandlordAccessRecord["modules"],
  };

  return (
    <>
      <Card className="overflow-hidden">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base">{account.fullName}</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                <span className="font-mono">@{account.login}</span>
                {" · "}
                {account.email}
                {" · "}
                {account.phone}
              </p>
              <p className="text-sm text-muted-foreground">
                {account.city} · {account.propertyCount} ta mulk
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {record.granted ? (
                <Badge className="bg-emerald-600">CRM faol</Badge>
              ) : (
                <Badge variant="outline" className="text-amber-600">
                  Kutilmoqda
                </Badge>
              )}
              <Button variant="outline" size="sm" onClick={() => setOpen((o) => !o)}>
                {open ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                Boshqarish
              </Button>
            </div>
          </div>
        </CardHeader>

        {open && (
          <CardContent className="space-y-6 border-t pt-4">
            {/* Akkaunt ma'lumotlari */}
            <div className="space-y-4 rounded-xl border bg-muted/30 p-4">
              <div>
                <p className="text-sm font-semibold">Kirish ma&apos;lumotlari</p>
                <p className="text-xs text-muted-foreground">
                  Login, email va parolni o&apos;zgartirish mumkin. Parol esdan chiqsa — yangisini kiriting.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5 text-xs">
                    <KeyRound className="size-3.5" />
                    Login (kirish nomi)
                  </Label>
                  <Input
                    value={loginEdit}
                    onChange={(e) =>
                      setLoginEdit(e.target.value.replace(/^@/, "").trimStart())
                    }
                    placeholder="masalan: umarzon2"
                    className="font-mono"
                    autoComplete="username"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Kirishda shu login ishlatiladi (@ ixtiyoriy)
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Joriy parol</Label>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      value={account.password}
                      readOnly
                      className="pr-10 font-mono"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full"
                      onClick={() => setShowPassword((v) => !v)}
                    >
                      {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </Button>
                  </div>
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="flex items-center gap-1.5 text-xs">
                    <Mail className="size-3.5" />
                    Email
                  </Label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="email@example.com"
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs">Yangi parol</Label>
                  <Input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Parol esdan chiqsa — yangisini kiriting (kamida 4 belgi)"
                    autoComplete="new-password"
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={saveAccount} disabled={saving}>
                  Saqlash
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => setDeleteOpen(true)}
                >
                  <Trash2 className="size-4" />
                  Akkauntni o&apos;chirish
                </Button>
              </div>
            </div>

            {/* CRM ruxsatlari */}
            <div className="flex flex-wrap gap-2 rounded-lg border bg-muted/40 p-3">
              <span className="w-full text-sm font-medium">Umumiy CRM kirish</span>
              <Button
                size="sm"
                variant={record.granted ? "default" : "outline"}
                onClick={() => togglePortal(true)}
              >
                <ShieldCheck className="size-4" />
                Ruxsat berish
              </Button>
              <Button
                size="sm"
                variant={!record.granted ? "destructive" : "outline"}
                onClick={() => togglePortal(false)}
              >
                <ShieldX className="size-4" />
                Ruxsat bermaslik
              </Button>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Modullar (ijara egasi menyusida)</p>
              <p className="text-xs text-muted-foreground">
                &quot;Ruxsat bermaslik&quot; bosilsa — shu bo&apos;lim Arenda CRM dan yashirinadi.
              </p>
              <div className="divide-y rounded-xl border">
                {CRM_NAV.map((item) => {
                  const allowed = record.modules[item.id] !== false;
                  const Icon = item.icon;
                  return (
                    <div
                      key={item.id}
                      className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                    >
                      <div className="flex items-center gap-2">
                        <Icon className="size-4 text-muted-foreground" />
                        <span className="text-sm font-medium">{item.label}</span>
                        <Badge
                          variant="secondary"
                          className={cn(
                            "text-[10px]",
                            allowed ? "text-emerald-700" : "text-muted-foreground"
                          )}
                        >
                          {allowed ? "Ko'rinadi" : "Yashirin"}
                        </Badge>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant={allowed ? "default" : "outline"}
                          disabled={!record.granted}
                          onClick={() => toggleModule(item.id, true)}
                        >
                          Ruxsat berish
                        </Button>
                        <Button
                          size="sm"
                          variant={!allowed ? "destructive" : "outline"}
                          disabled={!record.granted}
                          onClick={() => toggleModule(item.id, false)}
                        >
                          Ruxsat bermaslik
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Akkauntni o'chirish"
        description={`@${account.login} (${account.email}) akkaunti butunlay o'chiriladi. CRM kirish va profil yo'qoladi. Davom etasizmi?`}
        confirmText="O'chirish"
        onConfirm={handleDelete}
      />
    </>
  );
}
