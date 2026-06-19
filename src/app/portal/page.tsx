"use client";

import Image from "next/image";
import { useMemo } from "react";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Clock,
  Home,
  MapPin,
  Phone,
  User,
  Wallet,
  Wrench,
} from "lucide-react";

import { useAuth } from "@/context/auth-context";
import { useLanguage } from "@/context/language-context";
import { usePortalData } from "@/hooks/use-portal-data";
import { VacantRoomsSection } from "@/components/portal/vacant-rooms-section";
import { TenantNotificationsSection } from "@/components/portal/tenant-notifications-section";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState } from "@/components/shared/empty-state";
import { TelegramLink } from "@/components/shared/telegram-link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { computeDebts } from "@/lib/analytics";
import {
  CONTRACT_STATUS_MAP,
  LANDLORD_CONTACT,
  MAINTENANCE_STATUS_MAP,
  PAYMENT_METHOD_MAP,
} from "@/lib/constants";
import type { TranslationKey } from "@/lib/i18n/translations";
import { daysBetween, formatCurrency, formatDate } from "@/lib/utils";
import type { Contract, Maintenance, Payment, Property } from "@/types";

function addMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function estimateNextPayment(
  contract: Contract,
  payments: Payment[]
): Date | null {
  if (contract.status !== "active") return null;
  const contractPayments = payments
    .filter((p) => p.contractId === contract.id)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const base = contractPayments[0]
    ? new Date(contractPayments[0].date)
    : new Date(contract.startDate);
  const next = addMonths(base, 1);
  return next > new Date(contract.endDate) ? null : next;
}

export default function PortalPage() {
  const { user } = useAuth();
  const { t } = useLanguage();

  const tf = (key: TranslationKey, params?: Record<string, string | number>) => {
    let text = t(key);
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        text = text.replace(`{${k}}`, String(v));
      }
    }
    return text;
  };

  const {
    tenant: myTenant,
    contracts: myContracts,
    payments: myPayments,
    properties,
    maintenance: myMaintenance,
    loading,
  } = usePortalData();

  const propertyMap = useMemo(
    () => new Map(properties.map((p) => [p.id, p])),
    [properties]
  );

  const totalPaid = useMemo(
    () => myPayments.reduce((sum, p) => sum + (p.amount || 0), 0),
    [myPayments]
  );

  const debtRows = useMemo(
    () => computeDebts(myContracts, myPayments),
    [myContracts, myPayments]
  );

  const totalDebt = useMemo(
    () => debtRows.reduce((sum, r) => sum + r.debt, 0),
    [debtRows]
  );

  const activeContracts = myContracts.filter((c) => c.status === "active");
  const primaryContract = activeContracts[0] ?? myContracts[0];
  const primaryProperty = primaryContract
    ? propertyMap.get(primaryContract.propertyId)
    : undefined;

  const daysUntilEnd = primaryContract
    ? daysBetween(new Date(), new Date(primaryContract.endDate))
    : null;

  const nextPaymentDate = primaryContract
    ? estimateNextPayment(primaryContract, myPayments)
    : null;

  const expiringSoon =
    primaryContract?.status === "active" &&
    daysUntilEnd !== null &&
    daysUntilEnd > 0 &&
    daysUntilEnd <= 30;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          {tf("portal.greeting")}, {user?.displayName}!
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("portal.desc")}</p>
      </div>

      {!loading && totalDebt > 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-destructive" />
          <div>
            <p className="font-medium text-destructive">{t("portal.debtAlert")}</p>
            <p className="text-sm text-muted-foreground">
              {t("portal.debtAlertDesc")}{" "}
              <span className="font-semibold text-foreground">
                {formatCurrency(totalDebt)}
              </span>
            </p>
          </div>
        </div>
      )}

      <TenantNotificationsSection />

      {!loading && expiringSoon && daysUntilEnd !== null && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
          <Clock className="mt-0.5 size-5 shrink-0 text-amber-600" />
          <div>
            <p className="font-medium text-amber-700 dark:text-amber-500">
              {t("portal.expiringAlert")}
            </p>
            <p className="text-sm text-muted-foreground">
              {tf("portal.expiringAlertDesc", { days: daysUntilEnd })}
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          title={t("portal.debt")}
          value={formatCurrency(totalDebt)}
          icon={Wallet}
          tone={totalDebt > 0 ? "rose" : "primary"}
          loading={loading}
          index={0}
        />
        <StatCard
          title={t("portal.totalPaid")}
          value={formatCurrency(totalPaid)}
          icon={CheckCircle2}
          tone="primary"
          loading={loading}
          index={1}
        />
        <StatCard
          title={t("portal.activeContracts")}
          value={String(activeContracts.length)}
          icon={Home}
          tone="blue"
          loading={loading}
          index={2}
        />
      </div>

      <VacantRoomsSection properties={properties} loading={loading} />

      {primaryContract && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle>{t("portal.activeRental")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {primaryProperty?.images[0] && (
                <div className="relative aspect-video overflow-hidden rounded-lg">
                  <Image
                    src={primaryProperty.images[0]}
                    alt={primaryProperty.name}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, 400px"
                  />
                </div>
              )}
              <div>
                <p className="font-semibold">
                  {primaryContract.propertyName ?? primaryProperty?.name ?? "—"}
                </p>
                {primaryProperty?.address && (
                  <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                    <MapPin className="size-3.5 shrink-0" />
                    {primaryProperty.address}, {primaryProperty.district}
                  </p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground">{t("portal.monthlyRent")}</p>
                  <p className="font-medium">
                    {formatCurrency(primaryContract.monthlyPayment)}
                    {t("portal.perMonth")}
                  </p>
                </div>
                {primaryContract.deposit != null && primaryContract.deposit > 0 && (
                  <div>
                    <p className="text-muted-foreground">{t("portal.deposit")}</p>
                    <p className="font-medium">
                      {formatCurrency(primaryContract.deposit)}
                    </p>
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2 text-sm">
                <span className="flex items-center gap-1 text-muted-foreground">
                  <CalendarDays className="size-3.5" />
                  {formatDate(primaryContract.startDate)} —{" "}
                  {formatDate(primaryContract.endDate)}
                </span>
                {daysUntilEnd !== null && (
                  <Badge variant={daysUntilEnd > 0 ? "secondary" : "destructive"}>
                    {daysUntilEnd > 0
                      ? tf("portal.daysLeft", { days: daysUntilEnd })
                      : t("portal.contractEnded")}
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>

          {nextPaymentDate && (
            <Card>
              <CardHeader>
                <CardTitle>{t("portal.nextPayment")}</CardTitle>
                <CardDescription>{t("portal.nextPaymentDesc")}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <div className="flex size-14 items-center justify-center rounded-full bg-primary/10">
                    <Wallet className="size-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">
                      {formatCurrency(primaryContract.monthlyPayment)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {formatDate(nextPaymentDate.toISOString())}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {!loading && debtRows.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t("portal.debtDetails")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {debtRows.map((row) => (
              <div
                key={row.contractId}
                className="flex items-center justify-between rounded-lg border p-3 text-sm"
              >
                <div>
                  <p className="font-medium">{row.propertyName}</p>
                  <p className="text-xs text-muted-foreground">
                    {t("portal.expected")}: {formatCurrency(row.expected)} ·{" "}
                    {t("portal.paid")}: {formatCurrency(row.paid)}
                  </p>
                </div>
                <span className="font-semibold text-destructive">
                  {formatCurrency(row.debt)}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="size-4" />
              {t("portal.myProfile")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("portal.phone")}</span>
              <a
                href={`tel:${myTenant?.phone ?? user?.phone ?? ""}`}
                className="font-medium text-primary hover:underline"
              >
                {myTenant?.phone ?? user?.phone ?? "—"}
              </a>
            </div>
            {myTenant?.email && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("portal.email")}</span>
                <span className="font-medium">{myTenant.email}</span>
              </div>
            )}
            {myTenant?.telegram && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  {t("portal.telegram")}
                </span>
                <TelegramLink value={myTenant.telegram} />
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("portal.contactLandlord")}</CardTitle>
            <CardDescription>{t("portal.contactDesc")}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <a href={`tel:${LANDLORD_CONTACT.phone}`}>
                <Phone className="mr-1.5 size-4" />
                {t("portal.call")}
              </a>
            </Button>
            <Button asChild variant="outline" size="sm">
              <a
                href={`https://t.me/${LANDLORD_CONTACT.telegram.replace("@", "")}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <TelegramLink
                  value={LANDLORD_CONTACT.telegram}
                  showIcon={false}
                />
              </a>
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("portal.myContracts")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!loading && myContracts.length === 0 ? (
            <EmptyState
              icon={Home}
              title={t("portal.noContracts")}
              description={t("portal.noContractsDesc")}
            />
          ) : (
            myContracts.map((c) => {
              const status = CONTRACT_STATUS_MAP[c.status];
              return (
                <div key={c.id} className="rounded-lg border p-4 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-medium">{c.propertyName ?? "—"}</div>
                    <Badge variant={status?.variant}>{status?.label}</Badge>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <CalendarDays className="size-3.5" />
                      {formatDate(c.startDate)} — {formatDate(c.endDate)}
                    </span>
                    <span className="text-right font-medium text-foreground">
                      {formatCurrency(c.monthlyPayment)}
                      {t("portal.perMonth")}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wrench className="size-4" />
            {t("portal.maintenance")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {!loading && myMaintenance.length === 0 ? (
            <EmptyState
              icon={Wrench}
              title={t("portal.noMaintenance")}
              description={t("portal.noMaintenanceDesc")}
            />
          ) : (
            myMaintenance.map((m) => {
              const st = MAINTENANCE_STATUS_MAP[m.status];
              return (
                <div
                  key={m.id}
                  className="flex items-start justify-between gap-2 border-b py-2 text-sm last:border-0"
                >
                  <div>
                    <p className="font-medium">{m.issue}</p>
                    <p className="text-xs text-muted-foreground">
                      {m.propertyName ?? "—"} · {formatDate(m.createdAt)}
                    </p>
                  </div>
                  <Badge variant={st?.variant}>{st?.label}</Badge>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("portal.paymentHistory")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {!loading && myPayments.length === 0 ? (
            <EmptyState
              icon={Wallet}
              title={t("portal.noPayments")}
              description={t("portal.noPaymentsDesc")}
            />
          ) : (
            myPayments.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between border-b py-2 text-sm last:border-0"
              >
                <div>
                  <div className="font-medium">{formatCurrency(p.amount)}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatDate(p.date)} ·{" "}
                    {p.method ? PAYMENT_METHOD_MAP[p.method] : "—"}
                    {p.note ? ` · ${p.note}` : ""}
                  </div>
                </div>
                <CheckCircle2 className="size-4 text-primary" />
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
