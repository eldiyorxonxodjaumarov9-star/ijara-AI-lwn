"use client";

import {
  JOB_STATUS_COLORS,
  JOB_STATUS_LABELS,
  PLATFORM_LABELS,
  type PostingJobView,
} from "@/lib/posting/types";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function PostingStatusBadges({
  jobs,
  compact,
  onJobClick,
}: {
  jobs: PostingJobView[];
  compact?: boolean;
  onJobClick?: (job: PostingJobView) => void;
}) {
  if (!jobs.length) return null;

  return (
    <div className={cn("flex flex-wrap gap-1.5", compact ? "mt-2" : "mt-3")}>
      {jobs
        .filter((j) => j.platform !== "ARENDA_INTERNAL")
        .map((job) => (
          <Badge
            key={job.id}
            variant="outline"
            className={cn(
              "cursor-pointer border text-[10px] font-normal transition-opacity hover:opacity-80",
              JOB_STATUS_COLORS[job.status]
            )}
            onClick={() => onJobClick?.(job)}
          >
            {PLATFORM_LABELS[job.platform]}: {JOB_STATUS_LABELS[job.status]}
          </Badge>
        ))}
    </div>
  );
}
