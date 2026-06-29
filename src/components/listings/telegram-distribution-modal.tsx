"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ExternalLink,
  Loader2,
  RefreshCw,
  Send,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { isApiConfigured } from "@/lib/api/client";
import {
  bulkRepostTelegramApi,
  fetchListingTelegramJobs,
  retryTelegramJobApi,
} from "@/lib/telegram-distribution/client";
import {
  TELEGRAM_STATUS_COLORS,
  TELEGRAM_STATUS_LABELS,
  type TelegramPostingJobView,
  type TelegramPostingLogView,
} from "@/lib/telegram-distribution/types";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/utils";

export function TelegramDistributionModal({
  listingId,
  open,
  onOpenChange,
}: {
  listingId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [jobs, setJobs] = useState<TelegramPostingJobView[]>([]);
  const [logs, setLogs] = useState<TelegramPostingLogView[]>([]);
  const [loading, setLoading] = useState(false);
  const [retrying, setRetrying] = useState<string | null>(null);
  const [reposting, setReposting] = useState(false);

  const load = useCallback(async () => {
    if (!isApiConfigured || !listingId) return;
    setLoading(true);
    try {
      const data = await fetchListingTelegramJobs(listingId);
      setJobs(data.jobs);
      setLogs(data.logs);
    } catch {
      setJobs([]);
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [listingId]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  const onRetry = async (jobId: string) => {
    setRetrying(jobId);
    try {
      await retryTelegramJobApi(jobId);
      toast.success("Qayta yuborildi");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Xato");
    } finally {
      setRetrying(null);
    }
  };

  const onBulkRepost = async () => {
    setReposting(true);
    try {
      const updated = await bulkRepostTelegramApi(listingId);
      setJobs(updated);
      toast.success("Barcha kanallarga qayta yuborildi");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Xato");
    } finally {
      setReposting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="size-5" />
            Telegram kanallarga tarqatish
          </DialogTitle>
        </DialogHeader>

        {!isApiConfigured ? (
          <p className="text-sm text-muted-foreground">
            Ko&apos;p kanalli tarqatish server rejimida ishlaydi.
          </p>
        ) : loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="size-6 animate-spin" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex justify-end">
              <Button
                size="sm"
                variant="outline"
                disabled={reposting}
                onClick={() => void onBulkRepost()}
              >
                <RefreshCw
                  className={cn("mr-1 size-4", reposting && "animate-spin")}
                />
                Bulk repost
              </Button>
            </div>

            {jobs.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-6">
                Telegram kanallarga hali yuborilmagan yoki kanallar sozlanmagan.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Kanal</TableHead>
                    <TableHead>Holat</TableHead>
                    <TableHead>Sana</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {jobs.map((job) => (
                    <TableRow key={job.id}>
                      <TableCell>
                        <div className="font-medium">{job.channelName}</div>
                        {job.channelUsername && (
                          <div className="text-xs text-muted-foreground">
                            @{job.channelUsername}
                          </div>
                        )}
                        {job.errorMessage && (
                          <p className="mt-1 text-xs text-destructive">
                            {job.errorMessage}
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px]",
                            TELEGRAM_STATUS_COLORS[job.status]
                          )}
                        >
                          {TELEGRAM_STATUS_LABELS[job.status]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs whitespace-nowrap">
                        {job.postedAt
                          ? formatDate(job.postedAt)
                          : job.scheduledAt
                            ? `Reja: ${formatDate(job.scheduledAt)}`
                            : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {job.postUrl && (
                          <Button size="icon" variant="ghost" asChild>
                            <a
                              href={job.postUrl}
                              target="_blank"
                              rel="noreferrer"
                            >
                              <ExternalLink className="size-4" />
                            </a>
                          </Button>
                        )}
                        {(job.status === "FAILED" || job.status === "PENDING") && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 text-xs"
                            disabled={retrying === job.id}
                            onClick={() => void onRetry(job.id)}
                          >
                            {retrying === job.id ? (
                              <Loader2 className="size-3 animate-spin" />
                            ) : (
                              "Qayta"
                            )}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            {logs.length > 0 && (
              <div>
                <p className="mb-2 text-sm font-medium">Loglar</p>
                <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border p-2 text-xs">
                  {logs.slice(0, 30).map((log) => (
                    <div
                      key={log.id}
                      className={cn(
                        log.level === "error" && "text-destructive",
                        log.level === "warn" && "text-amber-600"
                      )}
                    >
                      <span className="text-muted-foreground">
                        {formatDate(log.createdAt)}
                      </span>{" "}
                      — {log.message}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
