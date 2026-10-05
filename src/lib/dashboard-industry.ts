import { selectOccupiedPropertyIds, type Booking } from "@/lib/bookings";
import { getTashkentDateParts } from "@/lib/payment-due-schedule";
import { countVehicleInventory } from "@/lib/vehicles";
import {
  isRentalIndustry,
  type RentalIndustry,
} from "@/lib/rental-industry";

export type IndustryKpiKey =
  | "totalUnits"
  | "occupiedUnits"
  | "vacantUnits"
  | "maintenanceUnits"
  | "monthlyIncome"
  | "debt"
  | "todayGuests"
  | "todayIncome"
  | "todayRentals"
  | "todayBookings"
  | "todayCheckIns"
  | "todayCheckOuts"
  | "activeBookings";

export type IndustryBlockKey =
  | "occupancy"
  | "recentPayments"
  | "upcomingContracts"
  | "tasks"
  | "tenants"
  | "payments"
  | "contractDeadlines"
  | "roomStatus"
  | "todayCheckIn"
  | "todayCheckOut"
  | "vehicleStatus"
  | "activeRentals"
  | "upcomingReturns"
  | "todayBookings"
  | "activeBookings"
  | "upcomingBookings"
  | "upcomingArrivals"
  | "upcomingDepartures";

export type IndustryBlockMode =
  | "units"
  | "bookingUnits"
  | "vehicles"
  | "activeRentals"
  | "upcomingReturns"
  | "todayCheckIns"
  | "todayCheckOuts"
  | "activeBookings"
  | "upcomingArrivals"
  | "upcomingDepartures"
  | "payments"
  | "contracts"
  | "tenants"
  | "empty";

export type IndustryInventory = {
  total: number;
  occupied: number;
  vacant: number;
  maintenance: number;
};

export type IndustryDashboardConfig = {
  industry: Exclude<RentalIndustry, "OTHER">;
  title: string;
  subtitle: string;
  entityLabel: string;
  customerLabel: string;
  occupancyLabel: string;
  /** Property rows are this industry's units. Cars and bookings are not. */
  usePropertyInventory: boolean;
  /** Inventory comes from the Vehicle model (CAR_RENTAL only). */
  useVehicleInventory?: boolean;
  /** Occupancy comes from bookings, not property.status (HOTEL_HOSTEL / VILLA_RENTAL). */
  useBookingInventory?: boolean;
  stats: { key: IndustryKpiKey; label: string }[];
  blocks: { key: IndustryBlockKey; title: string; empty: string }[];
  quickActions: { href: string; label: string }[];
};

const MONEY_KEYS = new Set<IndustryKpiKey>(["monthlyIncome", "todayIncome"]);

const CONFIGS: Record<Exclude<RentalIndustry, "OTHER">, IndustryDashboardConfig> = {
  OFFICE_RENTAL: {
    industry: "OFFICE_RENTAL",
    title: "Ofis ijarasi boshqaruvi",
    subtitle: "Xonalar, to‘lovlar va shartnomalar bo‘yicha joriy holat.",
    entityLabel: "Xona",
    customerLabel: "Ijarachi",
    occupancyLabel: "Xonalar bandligi",
    usePropertyInventory: true,
    stats: [
      { key: "totalUnits", label: "Jami xonalar" },
      { key: "occupiedUnits", label: "Band xonalar" },
      { key: "vacantUnits", label: "Bo‘sh xonalar" },
      { key: "monthlyIncome", label: "Oylik tushum" },
      { key: "debt", label: "Qarzdorlik" },
    ],
    blocks: [
      { key: "occupancy", title: "Xonalar bandligi", empty: "Hozircha xona yo‘q." },
      { key: "recentPayments", title: "Oxirgi to‘lovlar", empty: "Hozircha to‘lov yo‘q." },
      {
        key: "upcomingContracts",
        title: "Yaqinlashayotgan shartnoma muddatlari",
        empty: "Yaqin 30 kunda tugaydigan shartnoma yo‘q.",
      },
      { key: "tasks", title: "Vazifalar", empty: "Vazifalar ro‘yxati hozircha bo‘sh." },
    ],
    quickActions: [
      { href: "/contracts", label: "Yangi shartnoma" },
      { href: "/payments", label: "To‘lov qo‘shish" },
      { href: "/tasks", label: "Vazifa yaratish" },
      { href: "/lwn-rooms", label: "Xona qo‘shish" },
    ],
  },
  APARTMENT_RENTAL: {
    industry: "APARTMENT_RENTAL",
    title: "Kvartira va uylar boshqaruvi",
    subtitle: "Obyektlar, ijarachilar, to‘lovlar va shartnoma muddatlari.",
    entityLabel: "Obyekt",
    customerLabel: "Ijarachi",
    occupancyLabel: "Obyektlar bandligi",
    usePropertyInventory: true,
    stats: [
      { key: "totalUnits", label: "Jami obyektlar" },
      { key: "occupiedUnits", label: "Ijaradagi obyektlar" },
      { key: "vacantUnits", label: "Bo‘sh obyektlar" },
      { key: "monthlyIncome", label: "Oylik tushum" },
      { key: "debt", label: "Qarzdorlik" },
    ],
    blocks: [
      { key: "occupancy", title: "Obyektlar bandligi", empty: "Hozircha obyekt yo‘q." },
      { key: "tenants", title: "Ijarachilar", empty: "Hozircha ijarachi yo‘q." },
      { key: "payments", title: "To‘lovlar", empty: "Hozircha to‘lov yo‘q." },
      {
        key: "contractDeadlines",
        title: "Shartnoma muddatlari",
        empty: "Yaqin 30 kunda tugaydigan shartnoma yo‘q.",
      },
    ],
    quickActions: [
      { href: "/properties", label: "Obyekt qo‘shish" },
      { href: "/contracts", label: "Yangi shartnoma" },
      { href: "/payments", label: "To‘lov qo‘shish" },
    ],
  },
  HOTEL_HOSTEL: {
    industry: "HOTEL_HOSTEL",
    title: "Mehmonxona boshqaruvi",
    subtitle: "Bandlik, check-in va check-out bronlardan olinadi. Tushum faqat to‘lovlardan.",
    entityLabel: "Xona",
    customerLabel: "Mehmon",
    occupancyLabel: "Xonalar holati",
    usePropertyInventory: true,
    useBookingInventory: true,
    stats: [
      { key: "totalUnits", label: "Jami xonalar" },
      { key: "occupiedUnits", label: "Bugun band" },
      { key: "todayGuests", label: "Bugungi mehmonlar" },
      { key: "todayCheckIns", label: "Bugungi check-in" },
      { key: "todayCheckOuts", label: "Bugungi check-out" },
      { key: "todayIncome", label: "Bugungi tushum" },
    ],
    blocks: [
      { key: "roomStatus", title: "Xonalar holati", empty: "Hozircha xona yo‘q." },
      { key: "todayCheckIn", title: "Bugungi check-in", empty: "Bugun keladigan mehmon yo‘q." },
      { key: "todayCheckOut", title: "Bugungi check-out", empty: "Bugun chiqadigan mehmon yo‘q." },
      { key: "upcomingBookings", title: "Yaqin bronlar", empty: "Yaqin 7 kunda bron yo‘q." },
      { key: "recentPayments", title: "So‘nggi to‘lovlar", empty: "Hozircha to‘lov yo‘q." },
    ],
    quickActions: [
      { href: "/bookings", label: "Bron yaratish" },
      { href: "/lwn-rooms", label: "Xona qo‘shish" },
      { href: "/payments", label: "To‘lov qo‘shish" },
    ],
  },
  CAR_RENTAL: {
    industry: "CAR_RENTAL",
    title: "Avtomobil ijarasi boshqaruvi",
    subtitle: "Avtomobillar holati va to‘lovlar bo‘yicha joriy holat.",
    entityLabel: "Avtomobil",
    customerLabel: "Mijoz",
    occupancyLabel: "Avtomobillar holati",
    usePropertyInventory: false,
    useVehicleInventory: true,
    stats: [
      { key: "totalUnits", label: "Jami avtomobillar" },
      { key: "occupiedUnits", label: "Ijaradagi avtomobillar" },
      { key: "vacantUnits", label: "Bo‘sh avtomobillar" },
      { key: "maintenanceUnits", label: "Texnik xizmatdagilar" },
      { key: "todayRentals", label: "Bugungi ijara" },
      { key: "monthlyIncome", label: "Oylik tushum" },
    ],
    blocks: [
      {
        key: "vehicleStatus",
        title: "Avtomobillar holati",
        empty: "Hali avtomobil qo‘shilmagan.",
      },
      { key: "activeRentals", title: "Faol ijaralar", empty: "Hozir faol ijara yo‘q." },
      {
        key: "upcomingReturns",
        title: "Yaqin qaytarishlar",
        empty: "Yaqin 7 kunda qaytariladigan avtomobil yo‘q.",
      },
      { key: "payments", title: "To‘lovlar", empty: "Hozircha to‘lov yo‘q." },
    ],
    quickActions: [
      { href: "/vehicles", label: "Avtomobil qo‘shish" },
      { href: "/payments", label: "To‘lov qo‘shish" },
    ],
  },
  RETAIL_RENTAL: {
    industry: "RETAIL_RENTAL",
    title: "Savdo joylari boshqaruvi",
    subtitle: "Savdo joylari, tushum va qarzdorlik.",
    entityLabel: "Joy",
    customerLabel: "Ijarachi",
    occupancyLabel: "Joylar bandligi",
    usePropertyInventory: true,
    stats: [
      { key: "totalUnits", label: "Jami joylar" },
      { key: "occupiedUnits", label: "Band joylar" },
      { key: "vacantUnits", label: "Bo‘sh joylar" },
      { key: "monthlyIncome", label: "Oylik tushum" },
      { key: "debt", label: "Qarzdorlik" },
    ],
    blocks: [
      { key: "occupancy", title: "Joylar bandligi", empty: "Hozircha savdo joyi yo‘q." },
      { key: "recentPayments", title: "Oxirgi to‘lovlar", empty: "Hozircha to‘lov yo‘q." },
      {
        key: "contractDeadlines",
        title: "Shartnoma muddatlari",
        empty: "Yaqin 30 kunda tugaydigan shartnoma yo‘q.",
      },
    ],
    quickActions: [
      { href: "/properties", label: "Joy qo‘shish" },
      { href: "/payments", label: "To‘lov qo‘shish" },
    ],
  },
  WAREHOUSE_RENTAL: {
    industry: "WAREHOUSE_RENTAL",
    title: "Ombor ijarasi boshqaruvi",
    subtitle: "Omborlar, tushum va qarzdorlik.",
    entityLabel: "Ombor",
    customerLabel: "Ijarachi",
    occupancyLabel: "Omborlar bandligi",
    usePropertyInventory: true,
    stats: [
      { key: "totalUnits", label: "Jami omborlar" },
      { key: "occupiedUnits", label: "Band omborlar" },
      { key: "vacantUnits", label: "Bo‘sh omborlar" },
      { key: "monthlyIncome", label: "Oylik tushum" },
      { key: "debt", label: "Qarzdorlik" },
    ],
    blocks: [
      { key: "occupancy", title: "Omborlar bandligi", empty: "Hozircha ombor yo‘q." },
      { key: "recentPayments", title: "Oxirgi to‘lovlar", empty: "Hozircha to‘lov yo‘q." },
      {
        key: "contractDeadlines",
        title: "Shartnoma muddatlari",
        empty: "Yaqin 30 kunda tugaydigan shartnoma yo‘q.",
      },
    ],
    quickActions: [
      { href: "/properties", label: "Ombor qo‘shish" },
      { href: "/payments", label: "To‘lov qo‘shish" },
    ],
  },
  VILLA_RENTAL: {
    industry: "VILLA_RENTAL",
    title: "Dacha va villalar boshqaruvi",
    subtitle: "Bandlik va bronlar real bron ma’lumotlaridan. Oylik tushum faqat to‘lovlardan.",
    entityLabel: "Dacha / Villa",
    customerLabel: "Mijoz",
    occupancyLabel: "Obyektlar bandligi",
    usePropertyInventory: true,
    useBookingInventory: true,
    stats: [
      { key: "totalUnits", label: "Jami obyektlar" },
      { key: "occupiedUnits", label: "Bugun band" },
      { key: "vacantUnits", label: "Bo‘sh obyektlar" },
      { key: "todayBookings", label: "Bugungi bronlar" },
      { key: "activeBookings", label: "Faol bronlar" },
      { key: "monthlyIncome", label: "Oylik tushum" },
    ],
    blocks: [
      { key: "occupancy", title: "Obyektlar bandligi", empty: "Hozircha obyekt yo‘q." },
      { key: "activeBookings", title: "Faol bronlar", empty: "Hozir faol bron yo‘q." },
      { key: "upcomingArrivals", title: "Yaqin kelishlar", empty: "Yaqin 7 kunda kelish yo‘q." },
      { key: "upcomingDepartures", title: "Yaqin chiqishlar", empty: "Yaqin 7 kunda chiqish yo‘q." },
      { key: "payments", title: "To‘lovlar", empty: "Hozircha to‘lov yo‘q." },
    ],
    quickActions: [
      { href: "/bookings", label: "Bron yaratish" },
      { href: "/properties", label: "Obyekt qo‘shish" },
      { href: "/payments", label: "To‘lov qo‘shish" },
    ],
  },
  COMMERCIAL_RENTAL: {
    industry: "COMMERCIAL_RENTAL",
    title: "Tijorat ko‘chmas mulki",
    subtitle: "Tijorat obyektlari, tushum va qarzdorlik.",
    entityLabel: "Obyekt",
    customerLabel: "Ijarachi",
    occupancyLabel: "Obyektlar bandligi",
    usePropertyInventory: true,
    stats: [
      { key: "totalUnits", label: "Jami obyektlar" },
      { key: "occupiedUnits", label: "Band obyektlar" },
      { key: "vacantUnits", label: "Bo‘sh obyektlar" },
      { key: "monthlyIncome", label: "Oylik tushum" },
      { key: "debt", label: "Qarzdorlik" },
    ],
    blocks: [
      { key: "occupancy", title: "Obyektlar bandligi", empty: "Hozircha obyekt yo‘q." },
      { key: "recentPayments", title: "Oxirgi to‘lovlar", empty: "Hozircha to‘lov yo‘q." },
      {
        key: "contractDeadlines",
        title: "Shartnoma muddatlari",
        empty: "Yaqin 30 kunda tugaydigan shartnoma yo‘q.",
      },
    ],
    quickActions: [
      { href: "/properties", label: "Obyekt qo‘shish" },
      { href: "/payments", label: "To‘lov qo‘shish" },
    ],
  },
};

export function resolveDashboardIndustry(value: unknown): RentalIndustry {
  return isRentalIndustry(value) ? value : "OTHER";
}

/** Null means the existing generic dashboard. */
export function getIndustryDashboardConfig(
  value: unknown
): IndustryDashboardConfig | null {
  const industry = resolveDashboardIndustry(value);
  if (industry === "OTHER") return null;
  return CONFIGS[industry];
}

export function isMoneyKpi(key: IndustryKpiKey): boolean {
  return MONEY_KEYS.has(key);
}

export function countPropertyInventory(
  properties: { status: string }[],
  usePropertyInventory: boolean
) {
  if (!usePropertyInventory) return { total: 0, occupied: 0, vacant: 0 };
  let occupied = 0;
  let vacant = 0;
  for (const property of properties) {
    if (property.status === "rented" || property.status === "reserved") occupied += 1;
    else if (property.status === "available") vacant += 1;
  }
  return { total: properties.length, occupied, vacant };
}

/**
 * Booking-based occupancy: a unit is busy today if a booking occupies it tonight.
 * property.status is ignored for busy/free (it carries long-term contract meaning); only
 * "maintenance" is respected so those units are neither busy nor free.
 */
export function countBookingInventory(
  properties: { id: string; status: string }[],
  bookings: Pick<Booking, "propertyId" | "status" | "checkInDate" | "checkOutDate">[],
  today: string
): IndustryInventory {
  const busyIds = selectOccupiedPropertyIds(bookings, today);
  let occupied = 0;
  let maintenance = 0;
  for (const property of properties) {
    if (busyIds.has(property.id)) occupied += 1;
    else if (property.status === "maintenance") maintenance += 1;
  }
  return { total: properties.length, occupied, vacant: properties.length - occupied - maintenance, maintenance };
}

/** Vehicle KPIs never read properties; property KPIs never read vehicles. */
export function resolveIndustryInventory(
  config: Pick<IndustryDashboardConfig, "usePropertyInventory" | "useVehicleInventory" | "useBookingInventory"> | null,
  properties: { id?: string; status: string }[],
  vehicles: { status: string }[],
  bookingState?: { bookings: Pick<Booking, "propertyId" | "status" | "checkInDate" | "checkOutDate">[]; today: string }
): IndustryInventory {
  if (config?.useVehicleInventory) {
    const v = countVehicleInventory(vehicles);
    return { total: v.total, occupied: v.rented, vacant: v.available, maintenance: v.maintenance };
  }
  if (config?.useBookingInventory && bookingState) {
    return countBookingInventory(
      properties.map((p) => ({ id: p.id ?? "", status: p.status })),
      bookingState.bookings,
      bookingState.today
    );
  }
  const p = countPropertyInventory(properties, config?.usePropertyInventory ?? false);
  return { ...p, maintenance: 0 };
}

const BOOKING_BLOCK_MODES: Partial<Record<IndustryBlockKey, IndustryBlockMode>> = {
  todayCheckIn: "todayCheckIns",
  todayBookings: "todayCheckIns",
  todayCheckOut: "todayCheckOuts",
  activeBookings: "activeBookings",
  upcomingBookings: "upcomingArrivals",
  upcomingArrivals: "upcomingArrivals",
  upcomingDepartures: "upcomingDepartures",
};

export function industryBlockMode(
  key: IndustryBlockKey,
  usePropertyInventory: boolean,
  useVehicleInventory = false,
  useBookingInventory = false
): IndustryBlockMode {
  if (key === "occupancy" || key === "roomStatus") {
    if (!usePropertyInventory) return "empty";
    return useBookingInventory ? "bookingUnits" : "units";
  }
  if (key in BOOKING_BLOCK_MODES) {
    return useBookingInventory ? BOOKING_BLOCK_MODES[key]! : "empty";
  }
  if (key === "vehicleStatus") return useVehicleInventory ? "vehicles" : "empty";
  if (key === "activeRentals") return useVehicleInventory ? "activeRentals" : "empty";
  if (key === "upcomingReturns") return useVehicleInventory ? "upcomingReturns" : "empty";
  if (key === "recentPayments" || key === "payments") return "payments";
  if (key === "upcomingContracts" || key === "contractDeadlines") return "contracts";
  if (key === "tenants") return "tenants";
  return "empty";
}

export function resolveIndustryKpiValue(
  key: IndustryKpiKey,
  input: {
    inventory: { total: number; occupied: number; vacant: number; maintenance?: number };
    monthlyIncome: number;
    debtCount: number;
    todayIncome: number;
    /** Vehicle rentals starting today (CAR_RENTAL). */
    todayRentals?: number;
    /** Booking counts (HOTEL_HOSTEL / VILLA_RENTAL); absent elsewhere → 0. */
    todayGuests?: number;
    todayCheckIns?: number;
    todayCheckOuts?: number;
    activeBookings?: number;
  }
): number {
  switch (key) {
    case "totalUnits":
      return input.inventory.total;
    case "occupiedUnits":
      return input.inventory.occupied;
    case "vacantUnits":
      return input.inventory.vacant;
    case "maintenanceUnits":
      return input.inventory.maintenance ?? 0;
    case "monthlyIncome":
      return input.monthlyIncome;
    case "debt":
      return input.debtCount;
    case "todayIncome":
      return input.todayIncome;
    case "todayRentals":
      return input.todayRentals ?? 0;
    case "todayGuests":
      return input.todayGuests ?? 0;
    case "todayBookings":
    case "todayCheckIns":
      return input.todayCheckIns ?? 0;
    case "todayCheckOuts":
      return input.todayCheckOuts ?? 0;
    case "activeBookings":
      return input.activeBookings ?? 0;
    default:
      return 0;
  }
}

function sameTashkentDay(date: string, now: Date): boolean {
  const a = getTashkentDateParts(date);
  const b = getTashkentDateParts(now);
  return a.year === b.year && a.month === b.month && a.day === b.day;
}

export function sumPaymentsOnTashkentDay(
  payments: { date: string; amount?: number }[],
  now: Date
): number {
  return payments.reduce((sum, payment) => {
    if (!payment.date || !sameTashkentDay(payment.date, now)) return sum;
    return sum + (payment.amount || 0);
  }, 0);
}

export function selectUpcomingContracts<T extends { status: string; endDate: string }>(
  contracts: T[],
  now: Date,
  withinDays = 30
): T[] {
  const start = now.getTime();
  const end = start + withinDays * 24 * 60 * 60 * 1000;
  return contracts
    .filter((contract) => {
      if (contract.status !== "active") return false;
      const time = new Date(contract.endDate).getTime();
      return Number.isFinite(time) && time >= start && time <= end;
    })
    .sort(
      (a, b) => new Date(a.endDate).getTime() - new Date(b.endDate).getTime()
    );
}
