"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Camera, Copy, ExternalLink, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  JOB_STATUS_COLORS,
  JOB_STATUS_LABELS,
  type PostingJobView,
} from "@/lib/posting/types";
import type { InstagramStatus } from "@/components/listings/instagram-settings-panel";
import type { ListingPostInput } from "@/lib/posting/types";

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success("Caption nusxalandi");
  } catch {
    toast.error("Nusxalash muvaffaqiyatsiz");
  }
}

export function InstagramPlatformModal({
  job,
  open,
  onOpenChange,
  listing,
  listingId,
  onJobUpdated,
}: {
  job: PostingJobView | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  listing: ListingPostInput;
  listingId: string;
  onJobUpdated: (job: PostingJobView) => void;
}) {
  const [status, setStatus] = useState<InstagramStatus | null>(null);
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    if (!open) return;
    void fetch("/api/integrations/instagram/status", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => setStatus(j?.data ?? j))
      .catch(() => setStatus(null));
  }, [open]);

  if (!job) return null;

  const caption = job.generatedText?.replace(/<[^>]+>/g, "") ?? "";

  const onRetry = async () => {
    setPosting(true);
    try {
      const res = await fetch(`/api/listings/${listingId}/post/instagram`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listing }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message ?? "Post xatosi");
      const updated = (json?.data ?? json)?.job as PostingJobView;
      onJobUpdated(updated);
      toast.success("Instagram ga joylandi!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Instagram post xatosi");
    } finally {
      setPosting(false);
    }
  };

  const needsConnect =
    !status?.enabled ||
    !status?.connected ||
    job.errorMessage?.includes("ulanmagan") ||
    job.errorMessage?.includes("o'chirilgan");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="size-5 text-pink-600" />
            Instagram
            <Badge variant="outline" className={JOB_STATUS_COLORS[job.status]}>
              {JOB_STATUS_LABELS[job.status]}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <dl className="space-y-2 text-sm">
          {job.channelName && (
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Akkaunt</dt>
              <dd className="font-medium">{job.channelName}</dd>
            </div>
          )}
          {status?.accountType && (
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Akkaunt turi</dt>
              <dd>{status.accountType}</dd>
            </div>
          )}
          {job.postedAt && (
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Yuborilgan</dt>
              <dd>{new Date(job.postedAt).toLocaleString("uz-UZ")}</dd>
            </div>
          )}
        </dl>

        {job.errorMessage && (
          <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
            {job.errorMessage}
          </div>
        )}

        {!status?.connected && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
            Instagram Business/Creator akkauntini ulang — sozlamalar → Posting → Instagram OAuth.
          </div>
        )}

        {caption && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">AI tayyor caption</p>
            <div className="max-h-40 overflow-y-auto rounded-lg border bg-muted/40 p-3 text-xs whitespace-pre-wrap">
              {caption}
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2 pt-1">
          {caption && (
            <Button size="sm" variant="outline" className="gap-1" onClick={() => copyText(caption)}>
              <Copy className="size-3.5" /> Nusxala
            </Button>
          )}
          {status?.connected && status.enabled && (
            <Button size="sm" className="gap-1" disabled={posting} onClick={() => void onRetry()}>
              <RefreshCw className={`size-3.5 ${posting ? "animate-spin" : ""}`} />
              Qayta yuborish
            </Button>
          )}
          {needsConnect && (
            <Button size="sm" variant="secondary" asChild>
              <Link href="/settings?tab=posting">
                <Camera className="size-3.5" /> Instagram ulash
              </Link>
            </Button>
          )}
          {job.postUrl && job.status === "POSTED" && (
            <Button size="sm" variant="outline" asChild>
              <a href={job.postUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="size-3.5" /> Postni ko&apos;rish
              </a>
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
