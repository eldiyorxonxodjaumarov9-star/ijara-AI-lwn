"use client";

import { useEffect, useState } from "react";
import { ImageOff, Loader2 } from "lucide-react";

import { apiFetchBlob } from "@/lib/api/client";
import { cn } from "@/lib/utils";

type Props = {
  checkInId: string | null | undefined;
  hasSelfie?: boolean;
  className?: string;
  size?: "sm" | "md" | "lg";
};

const sizeClass = {
  sm: "h-10 w-10",
  md: "h-14 w-14",
  lg: "h-40 w-40",
};

/**
 * Loads attendance selfie via authenticated API proxy (no Telegram token in URL).
 */
export function AttendanceSelfieThumb({
  checkInId,
  hasSelfie = true,
  className,
  size = "md",
}: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [missing, setMissing] = useState(!hasSelfie || !checkInId);
  const [loading, setLoading] = useState(Boolean(hasSelfie && checkInId));

  useEffect(() => {
    if (!checkInId || !hasSelfie) {
      setMissing(true);
      setLoading(false);
      return;
    }
    let cancelled = false;
    let objectUrl: string | null = null;
    setLoading(true);
    setMissing(false);
    void (async () => {
      try {
        const blob = await apiFetchBlob(`/attendance/selfies/${checkInId}`);
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      } catch {
        if (!cancelled) {
          setMissing(true);
          setUrl(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [checkInId, hasSelfie]);

  if (loading) {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-md border bg-muted",
          sizeClass[size],
          className
        )}
      >
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (missing || !url) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center gap-1 rounded-md border bg-muted px-1 text-center",
          sizeClass[size],
          className
        )}
        title="Rasm mavjud emas"
      >
        <ImageOff className="h-4 w-4 text-muted-foreground" />
        {size !== "sm" ? (
          <span className="text-[10px] leading-tight text-muted-foreground">
            Rasm yo‘q
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <button
      type="button"
      className={cn(
        "overflow-hidden rounded-md border focus:outline-none focus:ring-2 focus:ring-ring",
        sizeClass[size],
        className
      )}
      onClick={() => window.open(url, "_blank", "noopener,noreferrer")}
      title="Katta o‘lchamda ochish"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="Davomat selfisi" className="h-full w-full object-cover" />
    </button>
  );
}
