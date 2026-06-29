"use client";

import { useEffect, useState } from "react";
import { Copy, Download } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PLATFORM_LABELS,
  POSTING_PLATFORMS,
  type ListingPostInput,
  type PostingJobView,
  type PostingPlatform,
} from "@/lib/posting/types";
import { generatePostText } from "@/lib/posting/copy-generator";
import { markJobPostedClient } from "@/lib/posting/client";

const EXPORT_PLATFORMS = POSTING_PLATFORMS.filter((p) => p !== "ARENDA_INTERNAL");

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success("Matn nusxalandi");
  } catch {
    toast.error("Nusxalash muvaffaqiyatsiz");
  }
}

function downloadImages(images: string[], title: string) {
  images.forEach((src, i) => {
    const a = document.createElement("a");
    a.href = src;
    a.download = `${title.replace(/\s+/g, "-")}-${i + 1}.jpg`;
    if (src.startsWith("data:") || src.startsWith("http")) {
      a.target = "_blank";
      a.rel = "noopener";
    }
    a.click();
  });
  toast.success(`${images.length} ta rasm yuklab olish boshlandi`);
}

export function PostingManualExportModal({
  open,
  onOpenChange,
  listing,
  jobs,
  legacyLocalId,
  onJobUpdated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  listing: ListingPostInput;
  jobs: PostingJobView[];
  legacyLocalId: string;
  onJobUpdated: (job: PostingJobView) => void;
}) {
  const [platform, setPlatform] = useState<PostingPlatform>("OLX");
  const [marking, setMarking] = useState(false);

  useEffect(() => {
    if (open) setPlatform("OLX");
  }, [open]);

  const text = generatePostText(listing, platform);
  const job = jobs.find((j) => j.platform === platform);
  const images = listing.images ?? [];

  const markPosted = async () => {
    if (!job) return;
    setMarking(true);
    try {
      const updated = await markJobPostedClient(job.id, {
        platform,
        legacyLocalId,
      });
      onJobUpdated(updated);
      toast.success(`${PLATFORM_LABELS[platform]} — joylandi deb belgilandi`);
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Xatolik");
    } finally {
      setMarking(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manual export — AI Auto Poster</DialogTitle>
        </DialogHeader>

        <div className="space-y-1.5">
          <Label>Platforma</Label>
          <Select value={platform} onValueChange={(v) => setPlatform(v as PostingPlatform)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {EXPORT_PLATFORMS.map((p) => (
                <SelectItem key={p} value={p}>
                  {PLATFORM_LABELS[p]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label>Tayyor post matni</Label>
            <Button size="sm" variant="outline" className="gap-1" onClick={() => copyText(text)}>
              <Copy className="size-3.5" /> Copy
            </Button>
          </div>
          <Textarea readOnly value={text.replace(/<[^>]+>/g, "")} className="min-h-48 font-mono text-xs" />
        </div>

        {images.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Rasmlar ({images.length})</Label>
              <Button
                size="sm"
                variant="outline"
                className="gap-1"
                onClick={() => downloadImages(images, listing.title)}
              >
                <Download className="size-3.5" /> Yuklab olish
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {images.map((src, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} src={src} alt="" className="size-16 rounded border object-cover" />
              ))}
            </div>
          </div>
        )}

        <Button className="w-full" disabled={marking || !job} onClick={() => void markPosted()}>
          {marking ? "Saqlanmoqda..." : "Joylandi deb belgilash"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
