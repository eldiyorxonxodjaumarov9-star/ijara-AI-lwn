import { cn } from "@/lib/utils";
import { BrandMark } from "@/components/brand-mark";

export function BrandLogo({
  className,
  showText = true,
}: {
  className?: string;
  showText?: boolean;
}) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
        <BrandMark />
      </div>
      {showText && (
        <span className="text-lg font-bold tracking-tight">
          arenda<span className="text-primary">Ai</span>
        </span>
      )}
    </div>
  );
}
