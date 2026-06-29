"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PLATFORM_LABELS, type PostingLogView } from "@/lib/posting/types";
import { fetchPostingLogsByListing } from "@/lib/posting/client";

export function PostingLogsModal({
  open,
  onOpenChange,
  listingId,
  listingTitle,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  listingId: string;
  listingTitle: string;
}) {
  const [logs, setLogs] = useState<PostingLogView[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !listingId) return;
    setLoading(true);
    void fetchPostingLogsByListing(listingId)
      .then(setLogs)
      .finally(() => setLoading(false));
  }, [open, listingId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Tarqatish loglari — {listingTitle}</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="mr-2 size-5 animate-spin" /> Yuklanmoqda...
          </div>
        ) : logs.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Hali log yo&apos;q
          </p>
        ) : (
          <ul className="space-y-2">
            {logs.map((log) => (
              <li
                key={log.id}
                className={`rounded-lg border p-3 text-sm ${
                  log.level === "error" ? "border-destructive/40 bg-destructive/5" : ""
                }`}
              >
                <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>
                    {log.platform ? PLATFORM_LABELS[log.platform] : "—"}
                    {log.action ? ` · ${log.action}` : ""}
                  </span>
                  <time>{new Date(log.createdAt).toLocaleString("uz-UZ")}</time>
                </div>
                <p className="mt-1">{log.message}</p>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
