"use client";

import { useState } from "react";
import { CreditCard, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { WorkspaceStatusBadge } from "@/components/subscription/workspace-status-badge";
import {
  formatSubscriptionDate,
  subscriptionStatusLabel,
} from "@/lib/subscription-ui";
import { useAuth } from "@/context/auth-context";

export function SubscriptionPanel() {
  const { workspace } = useAuth();
  const [showPaymentNotice, setShowPaymentNotice] = useState(false);

  if (!workspace) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Obuna</CardTitle>
          <CardDescription>Obuna ma&apos;lumotlari yuklanmoqda...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Obuna</CardTitle>
        <CardDescription>
          Workspace obunasi va kirish huquqi holati
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
                Workspace
              </p>
              <p className="mt-1 text-lg font-semibold text-slate-100">
                {workspace.workspaceName}
              </p>
            </div>
            <WorkspaceStatusBadge workspace={workspace} />
          </div>

          <dl className="mt-5 grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs text-slate-500">Holat</dt>
              <dd className="mt-1 text-sm font-medium text-slate-200">
                {subscriptionStatusLabel(workspace.status)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Reja</dt>
              <dd className="mt-1 text-sm font-medium text-slate-200">
                {workspace.plan ?? "Tanlanmagan"}
              </dd>
            </div>
            {workspace.status === "DEMO" && (
              <div className="sm:col-span-2">
                <dt className="text-xs text-slate-500">Demo tugash sanasi</dt>
                <dd className="mt-1 text-sm font-medium text-slate-200">
                  {formatSubscriptionDate(workspace.demoEndsAt)}
                </dd>
              </div>
            )}
            {workspace.currentPeriodEnd && workspace.status === "ACTIVE" && (
              <div className="sm:col-span-2">
                <dt className="text-xs text-slate-500">Joriy davr tugashi</dt>
                <dd className="mt-1 text-sm font-medium text-slate-200">
                  {formatSubscriptionDate(workspace.currentPeriodEnd)}
                </dd>
              </div>
            )}
          </dl>
        </div>

        {!workspace.hasAccess && !workspace.isInternal && (
          <div className="rounded-xl border border-rose-400/20 bg-rose-500/10 p-4 text-sm text-rose-100">
            Ijara AI&apos;dan foydalanishni davom ettirish uchun oylik obunani
            faollashtiring.
          </div>
        )}

        {!showPaymentNotice ? (
          <Button
            className="bg-sky-500 text-white hover:bg-sky-400"
            onClick={() => setShowPaymentNotice(true)}
          >
            <CreditCard className="size-4" />
            Obunani faollashtirish
          </Button>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-white/15 bg-white/[0.02] px-6 py-10 text-center">
            <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-sky-500/10 text-sky-300">
              <Sparkles className="size-5" />
            </div>
            <h3 className="text-base font-semibold text-slate-100">
              Onlayn to&apos;lov tez orada ishga tushadi
            </h3>
            <p className="mt-2 max-w-md text-sm text-slate-400">
              To&apos;lov tizimi hozircha tayyorlanmoqda. Obunani faollashtirish
              uchun qo&apos;llab-quvvatlash jamoasi bilan bog&apos;laning.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
