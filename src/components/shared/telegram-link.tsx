import { Send } from "lucide-react";

import { cn, toTelegramUrl } from "@/lib/utils";

export function TelegramLink({
  value,
  className,
  showIcon = true,
}: {
  value: string;
  className?: string;
  showIcon?: boolean;
}) {
  const url = toTelegramUrl(value);
  const display =
    value.trim().startsWith("@") ? value.trim() : `@${value.trim().replace(/^@/, "")}`;

  if (!url) {
    return <span className={className}>{value}</span>;
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "inline-flex items-center gap-1 text-primary transition-colors hover:underline",
        className
      )}
      onClick={(e) => e.stopPropagation()}
    >
      {showIcon && <Send className="size-3.5 shrink-0" />}
      {display}
    </a>
  );
}
