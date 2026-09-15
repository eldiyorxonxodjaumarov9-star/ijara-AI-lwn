import { cn } from "@/lib/utils";

export function LandingContainer({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8", className)}>
      {children}
    </div>
  );
}

export function LandingSection({
  id,
  tone = "light",
  className,
  children,
}: {
  id?: string;
  tone?: "light" | "muted" | "navy";
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className={cn(
        "scroll-mt-24 py-14 sm:py-16 lg:py-24",
        tone === "light" && "bg-white text-slate-900",
        tone === "muted" && "bg-[#F4F7FB] text-slate-900",
        tone === "navy" && "bg-[#071429] text-white",
        className
      )}
    >
      {children}
    </section>
  );
}

export function LandingEyebrow({
  children,
  tone = "light",
}: {
  children: React.ReactNode;
  tone?: "light" | "navy";
}) {
  return (
    <p
      className={cn(
        "text-xs font-semibold tracking-[0.18em] uppercase",
        tone === "light" ? "text-blue-700" : "text-blue-300"
      )}
    >
      {children}
    </p>
  );
}

export function LandingTitle({
  as: Tag = "h2",
  children,
  className,
}: {
  as?: "h2" | "h3";
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Tag
      className={cn(
        "text-balance text-3xl font-semibold tracking-tight sm:text-4xl lg:text-[2.6rem] lg:leading-[1.15]",
        className
      )}
    >
      {children}
    </Tag>
  );
}

export function LandingLead({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "mt-4 max-w-2xl text-pretty text-base leading-relaxed text-slate-600 sm:text-lg",
        className
      )}
    >
      {children}
    </p>
  );
}
