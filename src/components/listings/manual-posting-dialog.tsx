"use client";

import { Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  PLATFORM_LABELS,
  type PostingJobView,
} from "@/lib/posting/types";

const PLATFORM_URLS: Partial<Record<PostingJobView["platform"], string>> = {
  OLX: "https://www.olx.uz/post-new-ad/",
  JOYMEE: "https://joymee.uz/",
  EGASI: "https://egasi.uz/",
  BESTE: "https://beste.uz/",
  INSTAGRAM: "https://www.instagram.com/",
  TELEGRAM: "https://web.telegram.org/",
};

async function copyText(text: string, label: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${label} nusxalandi`);
  } catch {
    toast.error("Nusxalash muvaffaqiyatsiz");
  }
}

export function ManualPostingDialog({
  job,
  open,
  onOpenChange,
}: {
  job: PostingJobView | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!job) return null;

  const pkg = job.manualPackage;
  const body = pkg?.body ?? job.generatedText ?? "";
  const title = pkg?.title ?? "";
  const platformUrl = PLATFORM_URLS[job.platform];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Qo&apos;lda joylash — {PLATFORM_LABELS[job.platform]}
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          {pkg?.tips ??
            "Matnni nusxalang, platformaga kiring va e'lonni qo'lda joylang."}
        </p>

        {title && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Sarlavha</span>
              <Button
                size="sm"
                variant="outline"
                className="gap-1"
                onClick={() => copyText(title, "Sarlavha")}
              >
                <Copy className="size-3.5" />
                Nusxala
              </Button>
            </div>
            <p className="rounded-lg border bg-muted/40 p-2 text-sm">{title}</p>
          </div>
        )}

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">E&apos;lon matni</span>
            <Button
              size="sm"
              variant="outline"
              className="gap-1"
              onClick={() => copyText(body, "Matn")}
            >
              <Copy className="size-3.5" />
              Nusxala
            </Button>
          </div>
          <Textarea readOnly value={body} className="min-h-40 font-mono text-xs" />
        </div>

        {pkg?.hashtags && (
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-xs text-muted-foreground">
              {pkg.hashtags}
            </span>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => copyText(pkg.hashtags!, "Hashtaglar")}
            >
              <Copy className="size-3.5" />
            </Button>
          </div>
        )}

        {pkg?.imageUrls?.length ? (
          <div className="space-y-2">
            <span className="text-sm font-medium">Rasmlar ({pkg.imageUrls.length})</span>
            <div className="flex flex-wrap gap-2">
              {pkg.imageUrls.map((src, i) => (
                <div key={i} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={src}
                    alt={`Rasm ${i + 1}`}
                    className="size-16 rounded border object-cover"
                  />
                  <Button
                    size="sm"
                    variant="secondary"
                    className="absolute -bottom-2 left-1/2 h-6 -translate-x-1/2 px-2 text-[10px]"
                    onClick={() =>
                      copyText(src.startsWith("data:") ? `Rasm ${i + 1}` : src, "Rasm URL")
                    }
                  >
                    URL
                  </Button>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2 pt-2">
          {platformUrl && (
            <Button variant="outline" size="sm" asChild>
              <a href={platformUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="size-4" />
                {PLATFORM_LABELS[job.platform]} ochish
              </a>
            </Button>
          )}
          <Button
            size="sm"
            onClick={() =>
              copyText(`${title}\n\n${body}`, "To'liq e'lon")
            }
          >
            <Copy className="size-4" />
            Hammasini nusxala
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
