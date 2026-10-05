"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Banknote,
  Building2,
  CalendarClock,
  Car,
  DoorOpen,
  LogIn,
  LogOut,
  Sparkles,
  Users,
  Wrench,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { DashboardKpiCard } from "@/components/dashboard/dashboard-kpi-card";
import { DashboardPanel } from "@/components/dashboard/dashboard-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PROPERTY_STATUS_MAP, PAYMENT_METHOD_MAP } from "@/lib/constants";
import {
  industryBlockMode,
  isMoneyKpi,
  resolveIndustryKpiValue,
  type IndustryBlockMode,
  type IndustryDashboardConfig,
  type IndustryInventory,
  type IndustryKpiKey,
} from "@/lib/dashboard-industry";
import { formatCurrency, formatDate } from "@/lib/utils";
import { VEHICLE_STATUS_LABELS, type Vehicle } from "@/lib/vehicles";
import {
  BOOKING_STATUS_LABELS,
  countCurrentGuests,
  occupiesToday,
  selectCurrentStays,
  selectTodayCheckIns,
  selectTodayCheckOuts,
  selectUpcomingArrivals,
  selectUpcomingDepartures,
  type Booking,
} from "@/lib/bookings";
import {
  selectActiveRentals,
  selectTodayRentals,
  selectUpcomingReturns,
  type VehicleRental,
} from "@/lib/vehicle-rentals";
import type { Contract, Payment, Property, Tenant } from "@/types";

const KPI_ICONS: Record<IndustryKpiKey, LucideIcon> = {
  totalUnits: Building2,
  occupiedUnits: DoorOpen,
  vacantUnits: DoorOpen,
  maintenanceUnits: Wrench,
  monthlyIncome: Banknote,
  debt: AlertTriangle,
  todayGuests: Users,
  todayIncome: Banknote,
  todayRentals: Car,
  todayBookings: CalendarClock,
  todayCheckIns: LogIn,
  todayCheckOuts: LogOut,
  activeBookings: CalendarClock,
};

export function IndustryDashboard({
  config,
  loading,
  inventory,
  vehicles = [],
  rentals = [],
  bookings = [],
  today = "",
  monthlyIncome,
  debtCount,
  todayIncome,
  properties,
  payments,
  contracts,
  tenants,
}: {
  config: IndustryDashboardConfig;
  loading: boolean;
  inventory: IndustryInventory;
  vehicles?: Vehicle[];
  rentals?: VehicleRental[];
  bookings?: Booking[];
  /** YYYY-MM-DD in Asia/Tashkent. */
  today?: string;
  monthlyIncome: number;
  debtCount: number;
  todayIncome: number;
  properties: Property[];
  payments: Payment[];
  contracts: Contract[];
  tenants: Tenant[];
}) {
  const values = {
    inventory,
    monthlyIncome,
    debtCount,
    todayIncome,
    todayRentals: selectTodayRentals(rentals, today).length,
    todayGuests: countCurrentGuests(bookings),
    todayCheckIns: selectTodayCheckIns(bookings, today).length,
    todayCheckOuts: selectTodayCheckOuts(bookings, today).length,
    activeBookings: selectCurrentStays(bookings, today).length,
  };

  return (
    <div className="relative space-y-5 sm:space-y-6">
      <div className="dash-grid-fade pointer-events-none absolute inset-x-0 -top-4 h-64 opacity-60" aria-hidden />
      <div className="relative space-y-5 sm:space-y-6">
        <header className="app-panel app-reveal overflow-hidden p-5 sm:p-6">
          <div className="pointer-events-none absolute -right-10 -top-16 size-56 rounded-full bg-sky-500/20 blur-3xl" aria-hidden />
          <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="app-chip text-sky-200">
                <Sparkles className="size-3.5" aria-hidden />
                AI Property Management
              </p>
              <h1 className="mt-3 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                {config.title}
              </h1>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-[15px]">
                {config.subtitle}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {config.quickActions.map((action) => (
                <Button
                  key={action.href + action.label}
                  asChild
                  size="sm"
                  variant={action.href === config.quickActions[0]?.href ? "default" : "outline"}
                  className={
                    action.href === config.quickActions[0]?.href
                      ? "bg-sky-500 text-white hover:bg-sky-400"
                      : "border-border bg-white/5 hover:bg-white/10"
                  }
                >
                  <Link href={action.href}>{action.label}</Link>
                </Button>
              ))}
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {config.stats.map((stat, index) => {
            const value = resolveIndustryKpiValue(stat.key, values);
            return (
              <DashboardKpiCard
                key={stat.key}
                index={index}
                title={stat.label}
                value={isMoneyKpi(stat.key) ? formatCurrency(value) : String(value)}
                icon={KPI_ICONS[stat.key]}
                tone={
                  stat.key === "debt" || stat.key === "maintenanceUnits"
                    ? "amber"
                    : stat.key === "vacantUnits"
                      ? "cyan"
                      : "blue"
                }
                loading={loading}
              />
            );
          })}
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {config.blocks.map((block, index) => {
            const mode = industryBlockMode(
              block.key,
              config.usePropertyInventory,
              config.useVehicleInventory,
              config.useBookingInventory
            );
            return (
              <DashboardPanel key={block.key} title={block.title} delayMs={120 + index * 40}>
                <BlockBody
                  mode={mode}
                  loading={loading}
                  empty={block.empty}
                  properties={properties}
                  vehicles={vehicles}
                  rentals={rentals}
                  bookings={bookings}
                  today={today}
                  payments={payments}
                  contracts={contracts}
                  tenants={tenants}
                />
              </DashboardPanel>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function BlockBody({
  mode,
  loading,
  empty,
  properties,
  vehicles,
  rentals,
  bookings,
  today,
  payments,
  contracts,
  tenants,
}: {
  mode: IndustryBlockMode;
  loading: boolean;
  empty: string;
  properties: Property[];
  vehicles: Vehicle[];
  rentals: VehicleRental[];
  bookings: Booking[];
  today: string;
  payments: Payment[];
  contracts: Contract[];
  tenants: Tenant[];
}) {
  if (mode === "empty") {
    return <p className="py-8 text-center text-sm text-slate-400">{empty}</p>;
  }
  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full bg-white/10" />
        ))}
      </div>
    );
  }

  if (mode === "units") {
    return (
      <Rows
        empty={empty}
        items={properties.slice(0, 6).map((property) => (
          <div key={property.id} className="app-row">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-100">{property.name}</p>
              <p className="truncate text-xs text-slate-400">{property.address}</p>
            </div>
            <Badge variant="secondary" className="border-white/10 bg-white/5 text-slate-300">
              {PROPERTY_STATUS_MAP[property.status]?.label ?? property.status}
            </Badge>
          </div>
        ))}
      />
    );
  }

  if (mode === "bookingUnits") {
    return (
      <Rows
        empty={empty}
        items={properties.slice(0, 6).map((property) => {
          const stay = bookings.find((b) => b.propertyId === property.id && occupiesToday(b, today));
          const label = stay ? "Band" : property.status === "maintenance" ? "Ta’mirda" : "Bo‘sh";
          return (
            <div key={property.id} className="app-row">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-100">{property.name}</p>
                <p className="truncate text-xs text-slate-400">
                  {stay ? `${stay.guestName} • ${formatDate(stay.checkOutDate)} gacha` : property.address}
                </p>
              </div>
              <Badge
                variant="secondary"
                className={`border-white/10 bg-white/5 ${stay ? "text-amber-300" : "text-slate-300"}`}
              >
                {label}
              </Badge>
            </div>
          );
        })}
      />
    );
  }

  if (
    mode === "todayCheckIns" ||
    mode === "todayCheckOuts" ||
    mode === "activeBookings" ||
    mode === "upcomingArrivals" ||
    mode === "upcomingDepartures"
  ) {
    const byArrival = mode === "todayCheckIns" || mode === "upcomingArrivals";
    const list =
      mode === "todayCheckIns"
        ? selectTodayCheckIns(bookings, today)
        : mode === "todayCheckOuts"
          ? selectTodayCheckOuts(bookings, today)
          : mode === "activeBookings"
            ? selectCurrentStays(bookings, today)
            : mode === "upcomingArrivals"
              ? selectUpcomingArrivals(bookings, today)
              : selectUpcomingDepartures(bookings, today);
    return (
      <Rows
        empty={empty}
        items={list.slice(0, 5).map((booking) => (
          <div key={booking.id} className="app-row">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-100">{booking.propertyName}</p>
              <p className="truncate text-xs text-slate-400">
                {booking.guestName} • {booking.guestCount} kishi • {BOOKING_STATUS_LABELS[booking.status]}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold text-sky-300">
                {formatDate(byArrival ? booking.checkInDate : booking.checkOutDate)}
              </p>
              <p className="text-xs text-slate-400">{byArrival ? "Kirish" : "Chiqish"}</p>
            </div>
          </div>
        ))}
      />
    );
  }

  if (mode === "vehicles") {
    return (
      <Rows
        empty={empty}
        items={vehicles.slice(0, 6).map((vehicle) => (
          <div key={vehicle.id} className="app-row">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-100">{vehicle.name}</p>
              <p className="truncate text-xs text-slate-400">{vehicle.plateNumber}</p>
            </div>
            <Badge variant="secondary" className="border-white/10 bg-white/5 text-slate-300">
              {VEHICLE_STATUS_LABELS[vehicle.status] ?? vehicle.status}
            </Badge>
          </div>
        ))}
      />
    );
  }

  if (mode === "activeRentals" || mode === "upcomingReturns") {
    const list =
      mode === "activeRentals" ? selectActiveRentals(rentals) : selectUpcomingReturns(rentals, today);
    return (
      <Rows
        empty={empty}
        items={list.slice(0, 5).map((rental) => (
          <div key={rental.id} className="app-row">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-100">{rental.vehicleName}</p>
              <p className="truncate text-xs text-slate-400">
                {rental.customerName} • {rental.plateNumber}
              </p>
            </div>
            <div className="text-right">
              <p
                className={`text-sm font-semibold ${rental.endDate < today ? "text-amber-300" : "text-sky-300"}`}
              >
                {formatDate(rental.endDate)}
              </p>
              <p className="text-xs text-slate-400">
                {rental.endDate < today ? "Muddati o‘tgan" : "Qaytarish"}
              </p>
            </div>
          </div>
        ))}
      />
    );
  }

  if (mode === "payments") {
    return (
      <Rows
        empty={empty}
        items={payments.slice(0, 5).map((payment) => (
          <div key={payment.id} className="app-row">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-100">
                {payment.tenantName ?? "To‘lov"}
              </p>
              <p className="truncate text-xs text-slate-400">
                {payment.propertyName ?? "—"} • {formatDate(payment.date)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold text-sky-300">{formatCurrency(payment.amount)}</p>
              <p className="text-xs text-slate-400">{PAYMENT_METHOD_MAP[payment.method]}</p>
            </div>
          </div>
        ))}
      />
    );
  }

  if (mode === "tenants") {
    return (
      <Rows
        empty={empty}
        items={tenants.slice(0, 5).map((tenant) => (
          <div key={tenant.id} className="app-row">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-100">{tenant.fullName}</p>
              <p className="truncate text-xs text-slate-400">{tenant.phone}</p>
            </div>
            <p className="text-sm font-semibold text-emerald-300">
              {formatCurrency(tenant.rentAmount)}
            </p>
          </div>
        ))}
      />
    );
  }

  return (
    <Rows
      empty={empty}
      items={contracts.slice(0, 5).map((contract) => (
        <div key={contract.id} className="app-row">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-slate-100">
              {contract.propertyName ?? "Shartnoma"}
            </p>
            <p className="truncate text-xs text-slate-400">
              {contract.tenantName ?? "—"} • {formatDate(contract.endDate)}
            </p>
          </div>
        </div>
      ))}
    />
  );
}

function Rows({ empty, items }: { empty: string; items: ReactNode[] }) {
  if (items.length === 0) {
    return <p className="py-8 text-center text-sm text-slate-400">{empty}</p>;
  }
  return <div className="space-y-1">{items}</div>;
}
