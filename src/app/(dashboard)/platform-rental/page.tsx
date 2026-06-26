"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Building2,
  ExternalLink,
  Megaphone,
  MessageCircle,
  RefreshCw,
  Search,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/context/auth-context";
import { useCollection } from "@/hooks/use-collection";
import { LandlordAccessPanel } from "@/components/platform-rental/landlord-access-panel";
import { getLandlordListings, type LandlordListing } from "@/lib/landlord-crm";
import {
  getAllLandlordAccounts,
  type LandlordProfile,
} from "@/lib/landlord-profile";
import {
  getAllRenterAccounts,
  type RenterProfile,
} from "@/lib/renter-profile";
import {
  getInquiryCompanyName,
  getInquiryPhone,
  getRentalInquiries,
  isGlobalInquiry,
  isListingMessage,
  type RentalInquiry,
} from "@/lib/rental-inquiries";
import {
  getPublishedPropertyIds,
  isPropertyPublished,
  publishPropertyToSearch,
  unpublishPropertyFromSearch,
} from "@/lib/platform-rental-bridge";
import { formatUzs } from "@/lib/rental-search";
import { formatDate } from "@/lib/utils";
import { PROPERTY_STATUS_MAP } from "@/lib/constants";
import type { Property } from "@/types";

export default function PlatformRentalPage() {
  const { user } = useAuth();
  const { data: properties, loading } = useCollection<Property>("properties");
  const [publishedIds, setPublishedIds] = useState<string[]>([]);
  const [landlordListings, setLandlordListings] = useState<LandlordListing[]>([]);
  const [renters, setRenters] = useState<RenterProfile[]>([]);
  const [landlords, setLandlords] = useState<LandlordProfile[]>([]);
  const [inquiries, setInquiries] = useState<RentalInquiry[]>([]);

  const reloadPlatform = useCallback(() => {
    setPublishedIds(getPublishedPropertyIds());
    setLandlordListings(getLandlordListings());
    setRenters(getAllRenterAccounts());
    setLandlords(getAllLandlordAccounts());
    setInquiries(getRentalInquiries());
  }, []);

  useEffect(() => {
    reloadPlatform();
  }, [reloadPlatform, properties.length]);

  const vacant = properties.filter((p) => p.status === "available");
  const searchLeads = inquiries.filter(isGlobalInquiry);
  const listingMessages = inquiries.filter(isListingMessage);

  const togglePublish = (propertyId: string) => {
    if (isPropertyPublished(propertyId)) {
      unpublishPropertyFromSearch(propertyId);
      toast.success("E'lon qidiruvdan olib tashlandi");
    } else {
      publishPropertyToSearch(propertyId);
      toast.success("E'lon ijara qidiruvda ko'rinadi!");
    }
    reloadPlatform();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ijara platformasi"
        description="Bo'sh mulklar, ijara egalari va arendatorlar — ijara qidiruv bilan bog'langan."
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={reloadPlatform}>
              <RefreshCw className="size-4" />
              Yangilash
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/ijara-qidiruv" target="_blank">
                <ExternalLink className="size-4" />
                Ijara qidiruv
              </Link>
            </Button>
          </div>
        }
      />

      <Tabs defaultValue="vacant" className="w-full">
        <TabsList className="flex h-auto w-full flex-wrap gap-1">
          <TabsTrigger value="vacant" className="gap-1.5">
            <Megaphone className="size-4" />
            Bo&apos;sh mulklar
          </TabsTrigger>
          <TabsTrigger value="landlords" className="gap-1.5">
            <Building2 className="size-4" />
            Ijara egalari
          </TabsTrigger>
          <TabsTrigger value="renters" className="gap-1.5">
            <Users className="size-4" />
            Arendatorlar
          </TabsTrigger>
          <TabsTrigger value="inquiries" className="gap-1.5">
            <Search className="size-4" />
            Qidiruv so&apos;rovlari
          </TabsTrigger>
          <TabsTrigger value="messages" className="gap-1.5">
            <MessageCircle className="size-4" />
            Xabarlar
          </TabsTrigger>
        </TabsList>

        <TabsContent value="vacant" className="mt-6 space-y-4">
          <p className="text-sm text-muted-foreground">
            <strong>Bo&apos;sh</strong> mulklarni e&apos;longa chiqaring — arendatorlar{" "}
            <Link href="/ijara-qidiruv" className="text-primary underline">
              ijara qidiruv
            </Link>{" "}
            profilida ko&apos;radi.
          </p>
          {loading ? (
            <p className="text-sm text-muted-foreground">Yuklanmoqda...</p>
          ) : vacant.length === 0 ? (
            <EmptyState
              icon={Building2}
              title="Bo'sh mulk yo'q"
              description="Aktivlar bo'limida mulk qo'shing yoki statusni Bo'sh qiling."
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {vacant.map((p) => {
                const published = publishedIds.includes(p.id);
                return (
                  <Card key={p.id}>
                    {p.images?.[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.images[0]}
                        alt={p.name}
                        className="h-36 w-full rounded-t-xl object-cover"
                      />
                    ) : null}
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-base">{p.name}</CardTitle>
                        <Badge variant="secondary">
                          {PROPERTY_STATUS_MAP[p.status].label}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {p.district} · {p.rooms} xona · {p.area} m²
                      </p>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <p className="text-lg font-bold text-primary">
                        {formatUzs(p.price)}
                      </p>
                      <Button
                        className="w-full"
                        variant={published ? "outline" : "default"}
                        onClick={() => togglePublish(p.id)}
                      >
                        <Megaphone className="size-4" />
                        {published ? "E'londan olib tashlash" : "E'longa chiqarish"}
                      </Button>
                      {published && (
                        <p className="text-center text-xs text-emerald-600 dark:text-emerald-400">
                          Ijara qidiruvda faol
                        </p>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="landlords" className="mt-6 space-y-4">
          <p className="text-sm text-muted-foreground">
            Ijara egalari profillari: email, parol, modul ruxsatlari va akkauntni
            boshqarish. Parol esdan chiqsa — yangisini kiriting va saqlang.
          </p>
          {landlords.length === 0 ? (
            <EmptyState
              icon={Building2}
              title="Ijara egalari yo'q"
              description="Hali /ijara-egalari da profil yaratilmagan."
            />
          ) : (
            <div className="space-y-4">
              {landlords.map((l) => (
                <LandlordAccessPanel
                  key={l.login}
                  landlord={l}
                  grantedBy={user?.displayName ?? user?.email ?? "admin"}
                  onChange={reloadPlatform}
                  onDeleted={() => reloadPlatform()}
                />
              ))}
            </div>
          )}
          <h3 className="font-semibold">E&apos;lonlar ({landlordListings.length})</h3>
          {landlordListings.length === 0 ? (
            <p className="text-sm text-muted-foreground">E&apos;lonlar yo&apos;q</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Sarlavha</TableHead>
                    <TableHead>Hudud</TableHead>
                    <TableHead>Narx</TableHead>
                    <TableHead>Holat</TableHead>
                    <TableHead>Email</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {landlordListings.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className="font-medium">{l.title}</TableCell>
                      <TableCell>{l.district}</TableCell>
                      <TableCell>{formatUzs(l.price)}</TableCell>
                      <TableCell>{l.status}</TableCell>
                      <TableCell className="text-muted-foreground">{l.landlordEmail}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="renters" className="mt-6 space-y-4">
          <p className="text-sm text-muted-foreground">
            <Link href="/ijara-qidiruv" className="text-primary underline" target="_blank">
              Ijara qidiruv
            </Link>{" "}
            da ro&apos;yxatdan o&apos;tgan firmalar.
          </p>
          {renters.length === 0 ? (
            <EmptyState
              icon={Users}
              title="Arendatorlar yo'q"
              description="Hali ijara qidiruv formasi to'ldirilmagan."
            />
          ) : (
            <div className="overflow-x-auto rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Firma</TableHead>
                    <TableHead>Login</TableHead>
                    <TableHead>Telefon</TableHead>
                    <TableHead>Faoliyat</TableHead>
                    <TableHead>Manzil</TableHead>
                    <TableHead>Summa</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {renters.map((r) => (
                    <TableRow key={r.login}>
                      <TableCell className="font-medium">{r.companyName}</TableCell>
                      <TableCell>@{r.login}</TableCell>
                      <TableCell className="text-primary">{r.phone || "—"}</TableCell>
                      <TableCell>{r.activityType}</TableCell>
                      <TableCell className="max-w-[160px] truncate">{r.officeAddress}</TableCell>
                      <TableCell>
                        {r.summa
                          ? formatUzs(
                              Number(String(r.summa).replace(/\s/g, "")) || 0
                            )
                          : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="inquiries" className="mt-6 space-y-4">
          <p className="text-sm text-muted-foreground">
            Arendatorlar to&apos;ldirgan qidiruv formasi — barcha ijara egalari ko&apos;radi.
          </p>
          {searchLeads.length === 0 ? (
            <EmptyState icon={Search} title="So'rovlar yo'q" description="Hali forma yuborilmagan." />
          ) : (
            <div className="space-y-3">
              {searchLeads.map((inq) => (
                <Card key={inq.id}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">
                      {getInquiryCompanyName(inq)}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {getInquiryPhone(inq) || "Telefon yo'q"} · {formatDate(inq.createdAt)}
                    </p>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground">
                    <p>
                      {inq.rentalPlaceType} · {inq.kv} m² ·{" "}
                      {inq.summa ? formatUzs(inq.summa) : "—"}
                    </p>
                    <p className="mt-1">{inq.officeAddress}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="messages" className="mt-6 space-y-4">
          <p className="text-sm text-muted-foreground">
            Arendatorlar e&apos;lonlarga yuborgan xabarlar.
          </p>
          {listingMessages.length === 0 ? (
            <EmptyState
              icon={MessageCircle}
              title="Xabarlar yo'q"
              description="Hali e'longa xabar yuborilmagan."
            />
          ) : (
            <div className="space-y-3">
              {listingMessages.map((msg) => (
                <Card key={msg.id}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">
                      {getInquiryCompanyName(msg)}
                    </CardTitle>
                    <p className="text-sm text-primary">
                      {getInquiryPhone(msg)} · E&apos;lon: {msg.listingTitle}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Ijara egasi: {msg.landlordEmail} · {formatDate(msg.createdAt)}
                    </p>
                  </CardHeader>
                  <CardContent>
                    <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                      {msg.message}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
