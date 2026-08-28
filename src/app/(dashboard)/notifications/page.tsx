"use client";

import { useState } from "react";

import { PageHeader } from "@/components/shared/page-header";
import {
  NotificationsTabContent,
  NotificationsTabHeaderActions,
} from "@/components/notifications/notifications-tab";
import { SmsNotificationsPanel } from "@/components/notifications/sms-notifications-panel";
import { SmsHistoryPanel } from "@/components/notifications/sms-history-panel";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

export default function NotificationsPage() {
  const [tab, setTab] = useState("notifications");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Xabarlar"
        description="Bildirishnomalar va SMS xabarnomalarni boshqarish"
        action={tab === "notifications" ? <NotificationsTabHeaderActions /> : undefined}
      />

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="flex h-auto w-full flex-wrap gap-1 sm:w-auto">
          <TabsTrigger value="notifications">Bildirishnomalar</TabsTrigger>
          <TabsTrigger value="sms">SMS xabarnomalar</TabsTrigger>
          <TabsTrigger value="sms-history">SMS tarixi</TabsTrigger>
        </TabsList>

        <TabsContent value="notifications" className="mt-6">
          <NotificationsTabContent />
        </TabsContent>

        <TabsContent value="sms" className="mt-6">
          <SmsNotificationsPanel />
        </TabsContent>

        <TabsContent value="sms-history" className="mt-6">
          <SmsHistoryPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
