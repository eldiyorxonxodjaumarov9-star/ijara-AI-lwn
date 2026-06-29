"use client";

import { Copy, ExternalLink, RefreshCw } from "lucide-react";
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
  PLATFORM_LABELS,
  type PostingJobView,
} from "@/lib/posting/types";

async function copyText(text: string, label: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${label} nusxalandi`);
  } catch {
    toast.error("Nusxalash muvaffaqiyatsiz");
  }
}

export function PostingPlatformModal({
  job,
  open,
  onOpenChange,
  onRetry,
  onManual,
  retrying,
}: {
  job: PostingJobView | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRetry?: (job: PostingJobView) => void;
  onManual?: (job: PostingJobView) => void;
  retrying?: boolean;
}) {
  if (!job) return null;

  const isManual =
    job.status === "MANUAL_REQUIRED" ||
    ["OLX", "JOYMEE", "EGASI", "BESTE"].includes(job.platform);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {PLATFORM_LABELS[job.platform]}
            <Badge
              variant="outline"
              className={JOB_STATUS_COLORS[job.status]}
            >
              {JOB_STATUS_LABELS[job.status]}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <dl className="space-y-2 text-sm">
          {job.channelName && (
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Kanal / akkaunt</dt>
              <dd className="font-medium">{job.channelName}</dd>
            </div>
          )}
          {job.postedAt && (
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Yuborilgan sana</dt>
              <dd>{new Date(job.postedAt).toLocaleString("uz-UZ")}</dd>
            </div>
          )}
          {job.postUrl && (
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Post havolasi</dt>
              <dd>
                <a
                  href={job.postUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  Ochish <ExternalLink className="size-3" />
                </a>
              </dd>
            </div>
          )}
          {job.errorMessage && (
            <div className="rounded-lg bg-destructive/10 p-2 text-destructive">
              {job.errorMessage}
            </div>
          )}
        </dl>

        {job.generatedText && (
          <div className="rounded-lg border bg-muted/40 p-3 text-xs whitespace-pre-wrap">
            {job.generatedText.replace(/<[^>]+>/g, "")}
          </div>
        )}

        <div className="flex flex-wrap gap-2 pt-2">
          {job.generatedText && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1"
              onClick={() =>
                copyText(job.generatedText!.replace(/<[^>]+>/g, ""), "Matn")
              }
            >
              <Copy className="size-3.5" /> Nusxala
            </Button>
          )}
          {(job.status === "FAILED" || job.platform === "TELEGRAM" || job.platform === "INSTAGRAM") &&
            onRetry && (
              <Button
                size="sm"
                className="gap-1"
                disabled={retrying}
                onClick={() => onRetry(job)}
              >
                <RefreshCw className={`size-3.5 ${retrying ? "animate-spin" : ""}`} />
                Qayta yuborish
              </Button>
            )}
          {isManual && onManual && (
            <Button size="sm" variant="secondary" onClick={() => onManual(job)}>
              Qo&apos;lda joylash
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
