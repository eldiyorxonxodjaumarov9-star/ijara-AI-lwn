"use client";

import { useEffect, useRef, useState } from "react";
import { ImagePlus, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
import { getLandlordProfile } from "@/lib/landlord-profile";
import { PROPERTY_TYPES } from "@/lib/landlord-profile";
import { formatUzs } from "@/lib/rental-search";
import {
  compressImageFile,
  MAX_SOURCE_IMAGE_BYTES,
} from "@/lib/image-compress";
import { formatSummaInput, parseSumma } from "@/lib/uzs-input";

const STATUS_LABEL: Record<ListingStatus, string> = {
  active: "Faol",
  draft: "Qoralama",
  rented: "Ijarada",
};

const MAX_IMAGES = 5;

const EMPTY_FORM: {
  title: string;
  district: string;
  rooms: string;
  area: string;
  price: string;
  propertyType: string;
  description: string;
  status: ListingStatus;
  images: string[];
} = {
  title: "",
  district: "",
  rooms: "2",
  area: "50",
  price: "",
  propertyType: PROPERTY_TYPES[0],
  description: "",
  status: "active" as ListingStatus,
  images: [] as string[],
};

export function LandlordListingsTab({ refreshKey }: { refreshKey: number }) {
  const [listings, setListings] = useState<LandlordListing[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const reloadListings = () => {
    const email = getLandlordProfile()?.email;
    setListings(getLandlordListings(email));
  };

  useEffect(() => {
    reloadListings();
  }, [refreshKey]);

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
        if (file.size > MAX_SOURCE_IMAGE_BYTES) {
          toast.error("Rasm 20 MB dan kichik bo'lsin");
          continue;
        }
        const compressed = await compressImageFile(file);
        added.push(compressed);
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

  const removeImage = (index: number) => {
    setForm((f) => ({
      ...f,
      images: f.images.filter((_, i) => i !== index),
    }));
  };

  const onAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    if (!form.title.trim() || !form.district.trim() || !form.price.trim()) {
      toast.error("Sarlavha, hudud va narx kiriting");
      return;
    }
    const price = parseSumma(form.price);
    if (!price) {
      toast.error("To'g'ri oylik narx kiriting");
      return;
    }
    const profile = getLandlordProfile();
    if (!profile?.email) {
      toast.error("Avval profilda email kiriting (yuqoridagi profil bo'limi)");
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
      landlordEmail: profile.email,
      landlordName: profile.fullName,
    });
    setSaving(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    reloadListings();
    setForm(EMPTY_FORM);
    toast.success(
      form.status === "active"
        ? "E'lon joylandi va qidiruvda ko'rinadi"
        : "E'lon saqlandi (qidiruvda ko'rinishi uchun holatni «Faol» qiling)"
    );
  };

  return (
    <div className="space-y-6">
      <form
        onSubmit={onAdd}
        className="rounded-xl border border-white/10 bg-white/5 p-5"
      >
        <h3 className="font-semibold">E&apos;lon joylash</h3>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Sarlavha</Label>
            <Input
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              className="border-white/10 bg-white/5 text-white"
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
                className="gap-2 border-white/20 bg-white/5 text-white hover:bg-white/10"
                onClick={() => imageInputRef.current?.click()}
                disabled={form.images.length >= MAX_IMAGES || uploadingImages}
              >
                <ImagePlus className="size-4" />
                {uploadingImages ? "Yuklanmoqda..." : "Rasm qo'shish"}
              </Button>
              <span className="text-xs text-slate-500">
                {form.images.length}/{MAX_IMAGES} · avtomatik siqiladi
              </span>
            </div>
            {form.images.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {form.images.map((src, i) => (
                  <div key={i} className="group relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={src}
                      alt={`Rasm ${i + 1}`}
                      className="size-20 rounded-lg border border-white/10 object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removeImage(i)}
                      className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-red-500 text-white opacity-90 hover:opacity-100"
                      aria-label="Rasmni o'chirish"
                    >
                      <X className="size-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Hudud</Label>
            <Input
              value={form.district}
              onChange={(e) => setForm((f) => ({ ...f, district: e.target.value }))}
              className="border-white/10 bg-white/5 text-white"
              placeholder="Chilonzor"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Mulk turi</Label>
            <Select
              value={form.propertyType}
              onValueChange={(v) => setForm((f) => ({ ...f, propertyType: v }))}
            >
              <SelectTrigger className="border-white/10 bg-white/5 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROPERTY_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Xona soni</Label>
            <Input
              type="number"
              min={1}
              value={form.rooms}
              onChange={(e) => setForm((f) => ({ ...f, rooms: e.target.value }))}
              className="border-white/10 bg-white/5 text-white"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Maydon (m²)</Label>
            <Input
              type="number"
              min={1}
              value={form.area}
              onChange={(e) => setForm((f) => ({ ...f, area: e.target.value }))}
              className="border-white/10 bg-white/5 text-white"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Oylik narx (so&apos;m)</Label>
            <Input
              inputMode="numeric"
              value={form.price}
              onChange={(e) =>
                setForm((f) => ({ ...f, price: formatSummaInput(e.target.value) }))
              }
              className="border-white/10 bg-white/5 text-white"
              placeholder="4 500 000"
            />
            <p className="text-xs text-slate-500">
              O&apos;zbek so&apos;mida kiriting. Masalan: 1 000 000 000
            </p>
          </div>
          <div className="space-y-1.5">
            <Label>Holat</Label>
            <Select
              value={form.status}
              onValueChange={(v) =>
                setForm((f) => ({ ...f, status: v as ListingStatus }))
              }
            >
              <SelectTrigger className="border-white/10 bg-white/5 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(STATUS_LABEL).map(([k, label]) => (
                  <SelectItem key={k} value={k}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-slate-500">
              Ijara qidiruvda ko&apos;rinishi uchun <span className="text-cyan-400">Faol</span> tanlang
            </p>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Tavsif</Label>
            <Textarea
              value={form.description}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
              className="border-white/10 bg-white/5 text-white"
            />
          </div>
        </div>
        <Button type="submit" className="mt-4 gap-2" disabled={saving || uploadingImages}>
          <Plus className="size-4" />
          {saving ? "Saqlanmoqda..." : "E'lon qo'shish"}
        </Button>
      </form>

      <div className="grid gap-4 sm:grid-cols-2">
        {listings.length === 0 ? (
          <p className="col-span-2 py-8 text-center text-slate-500">
            E&apos;lonlar yo&apos;q
          </p>
        ) : (
          listings.map((l) => (
            <div
              key={l.id}
              className="overflow-hidden rounded-xl border border-white/10 bg-white/5"
            >
              {l.images?.[0] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={l.images[0]}
                  alt={l.title}
                  className="h-36 w-full object-cover"
                />
              ) : (
                <div className="flex h-36 items-center justify-center bg-white/5 text-slate-600">
                  <ImagePlus className="size-8" />
                </div>
              )}
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="font-semibold text-white">{l.title}</h4>
                    <p className="text-sm text-slate-400">
                      {l.district} · {l.rooms} xona · {l.area} m²
                    </p>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="shrink-0 text-slate-400 hover:text-red-400"
                    onClick={() => {
                      deleteLandlordListing(l.id);
                      reloadListings();
                      toast.success("E'lon o'chirildi");
                    }}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
                <p className="mt-2 text-lg font-bold text-cyan-400">
                  {formatUzs(l.price)}
                </p>
                <Badge variant="secondary" className="mt-2">
                  {STATUS_LABEL[l.status]}
                </Badge>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
