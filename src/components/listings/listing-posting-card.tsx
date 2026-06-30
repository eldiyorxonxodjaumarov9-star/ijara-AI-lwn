"use client";

import { useState } from "react";
import {
  FileDown,
  ImagePlus,
  ListTree,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { LandlordListing, ListingStatus } from "@/lib/landlord-crm";
import { formatUzs } from "@/lib/rental-search";
import type { PostingJobView } from "@/lib/posting/types";
import {
  retryAllPostingClient,
  retryPostingJobClient,
  updateLocalPostingJob,
} from "@/lib/posting/client";
import { PostingStatusBadges } from "@/components/listings/posting-status-badges";
import { InstagramPlatformModal } from "@/components/listings/instagram-platform-modal";
import { PostingPlatformModal } from "@/components/listings/posting-platform-modal";
import { PostingManualExportModal } from "@/components/listings/posting-manual-export-modal";
import { PostingLogsModal } from "@/components/listings/posting-logs-modal";
import { ManualPostingDialog } from "@/components/listings/manual-posting-dialog";
import { TelegramDistributionModal } from "@/components/listings/telegram-distribution-modal";

const STATUS_LABEL: Record<ListingStatus, string> = {
  active: "Faol",
  draft: "Qoralama",
  rented: "Ijarada",
};

export function ListingPostingCard({
  listing,
  jobs,
  serverListingId,
  onJobsChange,
  onDelete,
}: {
  listing: LandlordListing;
  jobs: PostingJobView[];
  /** PostgreSQL listing id — Telegram multi-channel uchun */
  serverListingId?: string;
  onJobsChange: (listingId: string, jobs: PostingJobView[]) => void;
  onDelete: () => void;
}) {
  const [selectedJob, setSelectedJob] = useState<PostingJobView | null>(null);
  const [telegramOpen, setTelegramOpen] = useState(false);
  const [manualJob, setManualJob] = useState<PostingJobView | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [logsOpen, setLogsOpen] = useState(false);
  const [retrying, setRetrying] = useState<string | null>(null);
  const [redistributing, setRedistributing] = useState(false);

  const listingInput = {
    title: listing.title,
    district: listing.district,
    rooms: listing.rooms,
    area: listing.area,
    price: listing.price,
    propertyType: listing.propertyType,
    description: listing.description,
    images: listing.images,
    status: listing.status,
    landlordEmail: listing.landlordEmail,
    landlordName: listing.landlordName,
    legacyLocalId: listing.id,
  };

  const onRetryJob = async (job: PostingJobView) => {
    setRetrying(job.id);
    try {
      const updated = await retryPostingJobClient(job.id, {
        platform: job.platform,
        legacyLocalId: listing.id,
        listing: listingInput,
      });
      onJobsChange(
        listing.id,
        jobs.map((j) => (j.platform === updated.platform ? updated : j))
      );
      setSelectedJob(updated);
      toast.success("Qayta yuborildi");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Xatolik");
    } finally {
      setRetrying(null);
    }
  };

  const onRedistribute = async () => {
    setRedistributing(true);
    try {
      const updated = await retryAllPostingClient(listing.id, listingInput);
      onJobsChange(listing.id, updated);
      toast.success("Barcha platformalarga qayta tarqatildi");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Tarqatish xatosi");
    } finally {
      setRedistributing(false);
    }
  };

  const onJobUpdated = (job: PostingJobView) => {
    onJobsChange(
      listing.id,
      jobs.map((j) => (j.platform === job.platform ? job : j))
    );
    updateLocalPostingJob(listing.id, job);
  };

  return (
    <>
      <Card className="overflow-hidden">
        {listing.images?.[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={listing.images[0]}
            alt={listing.title}
            className="h-40 w-full object-cover"
          />
        ) : (
          <div className="flex h-40 items-center justify-center bg-muted">
            <ImagePlus className="size-8 text-muted-foreground" />
          </div>
        )}
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h4 className="font-semibold">{listing.title}</h4>
              <p className="text-sm text-muted-foreground">
                {listing.district} · {listing.rooms} xona · {listing.area} m²
              </p>
            </div>
            <Button
              size="icon"
              variant="ghost"
              className="shrink-0 text-destructive"
              onClick={onDelete}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>

          <p className="mt-2 text-lg font-bold text-primary">{formatUzs(listing.price)}</p>
          <Badge variant="secondary" className="mt-2">
            {STATUS_LABEL[listing.status]}
          </Badge>

          {jobs.length > 0 && (
            <>
              <p className="mt-3 text-xs font-medium text-muted-foreground">
                AI Auto Poster · Multi-platform
              </p>
              <PostingStatusBadges
                jobs={jobs}
                compact
                onJobClick={(job) => {
                  if (job.platform === "TELEGRAM" && serverListingId) {
                    setTelegramOpen(true);
                  } else {
                    setSelectedJob(job);
                  }
                }}
              />
            </>
          )}

          <div className="mt-3 flex flex-wrap gap-1.5">
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1 text-xs"
              disabled={redistributing}
              onClick={() => void onRedistribute()}
            >
              <RefreshCw className={`size-3 ${redistributing ? "animate-spin" : ""}`} />
              Qayta tarqatish
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1 text-xs"
              onClick={() => setExportOpen(true)}
            >
              <FileDown className="size-3" /> Manual export
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1 text-xs"
              onClick={() => setLogsOpen(true)}
            >
              <ListTree className="size-3" /> Loglar
            </Button>
          </div>
        </CardContent>
      </Card>

      <PostingPlatformModal
        job={selectedJob?.platform !== "INSTAGRAM" ? selectedJob : null}
        open={Boolean(selectedJob && selectedJob.platform !== "INSTAGRAM")}
        onOpenChange={(o) => !o && setSelectedJob(null)}
        onRetry={onRetryJob}
        onManual={(j) => {
          setSelectedJob(null);
          setManualJob(j);
        }}
        retrying={retrying === selectedJob?.id}
      />

      <InstagramPlatformModal
        job={selectedJob?.platform === "INSTAGRAM" ? selectedJob : null}
        open={Boolean(selectedJob?.platform === "INSTAGRAM")}
        onOpenChange={(o) => !o && setSelectedJob(null)}
        listing={listingInput}
        listingId={listing.id}
        onJobUpdated={(job) => {
          onJobsChange(
            listing.id,
            jobs.map((j) => (j.platform === "INSTAGRAM" ? job : j))
          );
          setSelectedJob(job);
        }}
      />

      <ManualPostingDialog
        job={manualJob}
        open={Boolean(manualJob)}
        onOpenChange={(o) => !o && setManualJob(null)}
      />

      <PostingManualExportModal
        open={exportOpen}
        onOpenChange={setExportOpen}
        listing={listingInput}
        jobs={jobs}
        legacyLocalId={listing.id}
        onJobUpdated={onJobUpdated}
      />

      <PostingLogsModal
        open={logsOpen}
        onOpenChange={setLogsOpen}
        listingId={listing.id}
        listingTitle={listing.title}
      />

      {serverListingId && (
        <TelegramDistributionModal
          listingId={serverListingId}
          open={telegramOpen}
          onOpenChange={setTelegramOpen}
        />
      )}
    </>
  );
}
