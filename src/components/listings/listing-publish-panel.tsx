"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ImagePlus, Plus, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  deleteLandlordListing,
  getLandlordListings,
  saveLandlordListing,
  type ListingStatus,
  type LandlordListing,
} from "@/lib/landlord-crm";
import { PROPERTY_TYPES } from "@/lib/landlord-profile";
import { compressImageFile } from "@/lib/image-compress";
import { formatSummaInput, parseSumma } from "@/lib/uzs-input";
import {
  fetchListingsWithJobs,
  getLocalPostingJobs,
  publishListingToPlatforms,
  saveLocalPostingJobs,
} from "@/lib/posting/client";
import type { PostingJobView } from "@/lib/posting/types";
import { ListingPostingCard } from "@/components/listings/listing-posting-card";

const STATUS_LABEL: Record<ListingStatus, string> = {
  active: "Faol",
  draft: "Qoralama",
  rented: "Ijarada",
};

const MAX_IMAGES = 5;
const MAX_IMAGE_SIZE = 2 * 1024 * 1024;

const EMPTY_FORM = {
  title: "",
  district: "",
  rooms: "2",
  area: "50",
  price: "",
  propertyType: PROPERTY_TYPES[0],
  description: "",
  status: "active" as ListingStatus,
  images: [] as string[],
  scheduleAt: "",
};

export function ListingPublishPanel({
  landlordEmail,
  landlordName,
}: {
  landlordEmail: string;
  landlordName: string;
}) {
  const [listings, setListings] = useState<LandlordListing[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [postingJobs, setPostingJobs] = useState<Record<string, PostingJobView[]>>({});
  const [serverListingIds, setServerListingIds] = useState<Record<string, string>>({});
  const imageInputRef = useRef<HTMLInputElement>(null);

  const email = landlordEmail.trim().toLowerCase();

  const reloadListings = useCallback(async () => {
    const loaded = getLandlordListings(email || undefined);
    setListings(loaded);

    const jobs: Record<string, PostingJobView[]> = {};
    const serverIds: Record<string, string> = {};
    for (const l of loaded) {
      const stored = getLocalPostingJobs(l.id);
      if (stored?.length) jobs[l.id] = stored;
    }

    if (email) {
      try {
        const fromDb = await fetchListingsWithJobs(email);
        for (const row of fromDb) {
          const localId = row.legacyLocalId ?? row.id;
          serverIds[localId] = row.id;
          if (row.jobs?.length) {
            jobs[localId] = row.jobs;
            saveLocalPostingJobs(localId, row.jobs);
          }
        }
      } catch {
        /* localStorage fallback */
      }
    }

    setServerListingIds(serverIds);
    setPostingJobs(jobs);
  }, [email]);

  useEffect(() => {
    void reloadListings();
  }, [reloadListings]);

  const onJobsChange = (listingId: string, jobs: PostingJobView[]) => {
    setPostingJobs((prev) => ({ ...prev, [listingId]: jobs }));
    saveLocalPostingJobs(listingId, jobs);
  };

  const onImageUpload = async (files: FileList | null) => {
    if (!files?.length) return;
    const remaining = MAX_IMAGES - form.images.length;
    if (remaining <= 0) {
      toast.error(`Maksimum ${MAX_IMAGES} ta rasm`);
      return;
    }

    setUploadingImages(true);
    const toRead = Array.from(files).slice(0, remaining);
    const added: string[] = [];

    try {
      for (const file of toRead) {
        if (!file.type.startsWith("image/")) {
          toast.error("Faqat rasm fayli yuklang");
          continue;
        }
        if (file.size > MAX_IMAGE_SIZE) {
          toast.error("Har bir rasm 2 MB dan kichik bo'lsin");
          continue;
        }
        added.push(await compressImageFile(file));
      }
      if (added.length) {
        setForm((f) => ({
          ...f,
          images: [...f.images, ...added].slice(0, MAX_IMAGES),
        }));
        toast.success(`${added.length} ta rasm yuklandi`);
      }
    } catch {
      toast.error("Rasm yuklashda xatolik");
    } finally {
      setUploadingImages(false);
      if (imageInputRef.current) imageInputRef.current.value = "";
    }
  };

  const onAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving || !email) return;
    if (!form.title.trim() || !form.district.trim() || !form.price.trim()) {
      toast.error("Sarlavha, hudud va narx kiriting");
      return;
    }
    const price = parseSumma(form.price);
    if (!price) {
      toast.error("To'g'ri oylik narx kiriting");
      return;
    }

    setSaving(true);
    const result = saveLandlordListing({
      title: form.title.trim(),
      district: form.district.trim(),
      rooms: Number(form.rooms) || 1,
      area: Number(form.area) || 0,
      price,
      propertyType: form.propertyType,
      description: form.description.trim() || undefined,
      images: form.images.length ? form.images : undefined,
      status: form.status,
      landlordEmail: email,
      landlordName: landlordName.trim() || "ArendaAi",
    });

    if (!result.ok) {
      setSaving(false);
      toast.error(result.error);
      return;
    }

    try {
      const published = await publishListingToPlatforms({
        title: result.listing.title,
        district: result.listing.district,
        rooms: result.listing.rooms,
        area: result.listing.area,
        price: result.listing.price,
        propertyType: result.listing.propertyType,
        description: result.listing.description,
        images: result.listing.images,
        status: result.listing.status,
        landlordEmail: email,
        landlordName: landlordName.trim() || "ArendaAi",
        legacyLocalId: result.listing.id,
        scheduledAt: form.scheduleAt
          ? new Date(form.scheduleAt).toISOString()
          : undefined,
      });

      onJobsChange(result.listing.id, published.jobs);
      setServerListingIds((prev) => ({
        ...prev,
        [result.listing.id]: published.id,
      }));
      setForm(EMPTY_FORM);

      const posted = published.jobs.filter((j) => j.status === "POSTED").length;
      const manual = published.jobs.filter((j) => j.status === "MANUAL_REQUIRED").length;
      toast.success(
        `E'lon saqlandi! AI Auto Poster: ${posted} avtomatik, ${manual} qo'lda joylash.`
      );
      await reloadListings();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Tarqatish xatosi");
      await reloadListings();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Yangi e&apos;lon qo&apos;shish</CardTitle>
          <p className="text-sm text-muted-foreground">
            AI Auto Poster e&apos;lon matnini yaratadi va Telegram, Instagram, OLX,
            Joymee, egasi.uz, Beste ga tarqatadi.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={onAdd} className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Sarlavha *</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="2 xonali kvartira, Chilonzor"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Rasmlar</Label>
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => onImageUpload(e.target.files)}
              />
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="gap-2"
                  onClick={() => imageInputRef.current?.click()}
                  disabled={form.images.length >= MAX_IMAGES || uploadingImages}
                >
                  <ImagePlus className="size-4" />
                  {uploadingImages ? "Yuklanmoqda..." : "Rasm qo'shish"}
                </Button>
                <span className="text-xs text-muted-foreground">
                  {form.images.length}/{MAX_IMAGES} · 2 MB gacha
                </span>
              </div>
              {form.images.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {form.images.map((src, i) => (
                    <div key={i} className="relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={src} alt="" className="size-20 rounded-lg border object-cover" />
                      <button
                        type="button"
                        onClick={() =>
                          setForm((f) => ({
                            ...f,
                            images: f.images.filter((_, idx) => idx !== i),
                          }))
                        }
                        className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-destructive text-white"
                      >
                        <X className="size-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Hudud *</Label>
              <Input
                value={form.district}
                onChange={(e) => setForm((f) => ({ ...f, district: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Mulk turi</Label>
              <Select
                value={form.propertyType}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, propertyType: v as typeof f.propertyType }))
                }
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PROPERTY_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Xona soni</Label>
              <Input type="number" min={1} value={form.rooms}
                onChange={(e) => setForm((f) => ({ ...f, rooms: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Maydon (m²)</Label>
              <Input type="number" min={1} value={form.area}
                onChange={(e) => setForm((f) => ({ ...f, area: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Oylik narx (so&apos;m) *</Label>
              <Input
                inputMode="numeric"
                value={form.price}
                onChange={(e) =>
                  setForm((f) => ({ ...f, price: formatSummaInput(e.target.value) }))
                }
                placeholder="4 500 000"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Holat</Label>
              <Select
                value={form.status}
                onValueChange={(v) => setForm((f) => ({ ...f, status: v as ListingStatus }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_LABEL).map(([k, label]) => (
                    <SelectItem key={k} value={k}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Tavsif</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                className="min-h-24"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Telegram yuborish vaqti (ixtiyoriy)</Label>
              <Input
                type="datetime-local"
                value={form.scheduleAt}
                onChange={(e) => setForm((f) => ({ ...f, scheduleAt: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">
                Bo&apos;sh qoldirsangiz — darhol barcha mos Telegram kanallarga yuboriladi.
              </p>
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" className="gap-2" disabled={saving || uploadingImages}>
                <Plus className="size-4" />
                {saving ? "Saqlanmoqda va tarqatilmoqda..." : "E'lon qo'shish"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div>
        <h3 className="mb-4 text-lg font-semibold">
          Mening e&apos;lonlarim ({listings.length})
        </h3>
        {listings.length === 0 ? (
          <p className="rounded-xl border border-dashed py-12 text-center text-sm text-muted-foreground">
            Hali e&apos;lon yo&apos;q
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {listings.map((l) => (
              <ListingPostingCard
                key={l.id}
                listing={l}
                jobs={postingJobs[l.id] ?? []}
                serverListingId={serverListingIds[l.id]}
                onJobsChange={onJobsChange}
                onDelete={() => {
                  deleteLandlordListing(l.id);
                  void reloadListings();
                  toast.success("E'lon o'chirildi");
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
