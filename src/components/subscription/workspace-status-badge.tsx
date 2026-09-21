import { cn } from "@/lib/utils";
import {
  subscriptionBadgeClassName,
  subscriptionStatusLabel,
} from "@/lib/subscription-ui";
import type { WorkspaceSubscriptionView } from "@/types";

export function WorkspaceStatusBadge({
  workspace,
  className,
  compact = false,
}: {
  workspace: WorkspaceSubscriptionView;
  className?: string;
  compact?: boolean;
}) {
  if (workspace.isInternal) return null;

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border font-medium",
        compact ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-0.5 text-[11px]",
        subscriptionBadgeClassName(workspace.status),
        className
      )}
    >
      {workspace.status === "DEMO" ? "DEMO" : workspace.plan?.toUpperCase() ?? subscriptionStatusLabel(workspace.status)}
    </span>
  );
}
