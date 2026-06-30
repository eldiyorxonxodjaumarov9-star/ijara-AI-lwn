"use client";

import Link from "next/link";
import { useState } from "react";
import { ExternalLink, Megaphone, Radio } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { ListingPublishPanel } from "@/components/listings/listing-publish-panel";
import { InstagramSettingsPanel } from "@/components/listings/instagram-settings-panel";
import { PostingChannelsPanel } from "@/components/listings/posting-channels-panel";
import { TelegramDistributionPanel } from "@/components/listings/telegram-distribution-panel";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/context/auth-context";

export default function ElonJoylashPage() {
  const { user } = useAuth();
  const email = user?.email ?? "";
  const name = user?.displayName ?? user?.company ?? "ArendaAi";
  const [tab, setTab] = useState("listings");

  return (
    <div className="space-y-6">
      <PageHeader
        title="E'lon joylash"
        description="Ijara e'lonini qo'shing — bir nechta platformalarga avtomatik tarqatiladi."
        action={
          <Button variant="outline" size="sm" asChild>
            <Link href="/ijara-qidiruv" target="_blank">
              <ExternalLink className="size-4" />
              Ijara qidiruv
            </Link>
          </Button>
        }
      />

      {!email ? (
        <div className="rounded-xl border border-dashed p-8 text-center">
          <Megaphone className="mx-auto mb-3 size-10 text-muted-foreground" />
          <p className="text-muted-foreground">
            E&apos;lon joylash uchun profilingizda email bo&apos;lishi kerak.
          </p>
        </div>
      ) : (
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="listings" className="gap-2">
              <Megaphone className="size-4" />
              E&apos;lon qo&apos;shish
            </TabsTrigger>
            <TabsTrigger value="channels" className="gap-2">
              <Radio className="size-4" />
              Tarqatish kanallari
            </TabsTrigger>
          </TabsList>

          <TabsContent value="listings" className="mt-6">
            <ListingPublishPanel landlordEmail={email} landlordName={name} />
          </TabsContent>

          <TabsContent value="channels" className="mt-6 space-y-6">
            <TelegramDistributionPanel />
            <InstagramSettingsPanel />
            <PostingChannelsPanel hideInstagram />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
