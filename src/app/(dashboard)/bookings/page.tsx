"use client";

import Link from "next/link";
import { CalendarDays } from "lucide-react";

import { BookingsView } from "@/components/bookings/bookings-view";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/context/auth-context";
import { isBookingIndustry } from "@/lib/bookings";

export default function BookingsPage() {
  const { workspace, workspaceLoading } = useAuth();
  const industry = workspace?.industry;

  if (workspaceLoading && !workspace) {
    return <Skeleton className="h-64 w-full" />;
  }

  // Other industries never mount BookingsView, so no /api/bookings request is made.
  if (!isBookingIndustry(industry)) {
    return (
      <EmptyState
        icon={CalendarDays}
        title="Bu bo‘lim mavjud emas"
        description="Bronlar bo‘limi faqat mehmonxona va dacha / villa biznesi uchun."
        action={
          <Button asChild variant="outline">
            <Link href="/dashboard">Bosh sahifaga qaytish</Link>
          </Button>
        }
      />
    );
  }

  return <BookingsView industry={industry} />;
}
