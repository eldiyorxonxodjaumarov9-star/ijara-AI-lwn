"use client";

import { useState } from "react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LandlordClientsTab } from "@/components/landing/landlord/landlord-clients-tab";
import { LandlordListingsTab } from "@/components/landing/landlord/landlord-listings-tab";
import { LandlordMessagesTab } from "@/components/landing/landlord/landlord-messages-tab";
import { LandlordReportsTab } from "@/components/landing/landlord/landlord-reports-tab";
import { LandlordVerifyTab } from "@/components/landing/landlord/landlord-verify-tab";

export function LandlordCrmPanel() {
  const [refreshKey, setRefreshKey] = useState(0);
  const bump = () => setRefreshKey((k) => k + 1);

  return (
    <Tabs defaultValue="clients" className="w-full">
      <TabsList className="mb-6 flex h-auto w-full flex-wrap gap-1 bg-white/5 p-1">
        <TabsTrigger value="clients" className="flex-1 sm:flex-none">
          Mijozlar
        </TabsTrigger>
        <TabsTrigger value="verify" className="flex-1 sm:flex-none">
          Tekshirish
        </TabsTrigger>
        <TabsTrigger value="messages" className="flex-1 sm:flex-none">
          Xabarlar
        </TabsTrigger>
        <TabsTrigger value="listings" className="flex-1 sm:flex-none">
          E&apos;lonlar
        </TabsTrigger>
        <TabsTrigger value="reports" className="flex-1 sm:flex-none">
          Hisobotlar
        </TabsTrigger>
      </TabsList>

      <TabsContent value="clients">
        <LandlordClientsTab refreshKey={refreshKey} />
      </TabsContent>
      <TabsContent value="verify">
        <LandlordVerifyTab onVerified={bump} />
      </TabsContent>
      <TabsContent value="messages">
        <LandlordMessagesTab refreshKey={refreshKey} />
      </TabsContent>
      <TabsContent value="listings">
        <LandlordListingsTab refreshKey={refreshKey} />
      </TabsContent>
      <TabsContent value="reports">
        <LandlordReportsTab refreshKey={refreshKey} />
      </TabsContent>
    </Tabs>
  );
}
