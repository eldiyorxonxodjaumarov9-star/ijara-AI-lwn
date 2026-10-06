import type { ExpenseCategory } from "@prisma/client";

import { LWN_BUILDING } from "@/lib/constants";
import { getTashkentDateParts } from "@/lib/payment-due-schedule";
import { isRentalIndustry, type RentalIndustry } from "@/lib/rental-industry";
import type { VehicleStatus } from "@/lib/vehicles";
import { bookingNights, bookingTotal, type BookingArrivalStatus, type BookingStatus } from "@/lib/bookings";
import {
  addDays,
  initialRentalStatus,
  rentalDays,
  rentalTotal,
  tashkentToday,
  toStoredDate,
  type VehicleRentalStatus,
} from "@/lib/vehicle-rentals";

export const DEMO_SEED_VERSION = 1;
export const DEMO_SEED_NOTE = "Demo ma'lumot";

type UnitSeed = {
  title: string;
  rentPrice: number;
  area: number;
  rooms: number;
  occupied: boolean;
};

type ExpenseSeed = { title: string; amount: number; category: ExpenseCategory };

type VehicleSeed = {
  brand: string;
  model: string;
  year: number;
  status: VehicleStatus;
  dailyRate: number;
  color: string;
  mileage: number;
};

type BookingSeed = {
  unitIndex: number;
  customerIndex: number;
  checkInOffset: number;
  checkOutOffset: number;
  status: BookingStatus;
  guestCount: number;
  nightlyRate: number;
  /** Real payment received (never the booking total). */
  paid?: number;
  paidDaysAgo?: number;
};

type IndustrySeed = {
  address: string;
  units: UnitSeed[];
  customers: string[];
  /** Short stays (hotel/villa) live in Booking: no contracts, no payments, no property.status writes. */
  shortTerm: boolean;
  bookings?: BookingSeed[];
  expenses: ExpenseSeed[];
  vehicles?: VehicleSeed[];
  /** Day offsets are relative to today (Asia/Tashkent). */
  rentals?: {
    vehicleIndex: number;
    customerIndex: number;
    startOffset: number;
    endOffset: number;
    paid?: number;
    paidDaysAgo?: number;
  }[];
};

const OFFICE_EXPENSES: ExpenseSeed[] = [
  { title: "Internet", amount: 600_000, category: "UTILITIES" },
  { title: "Kommunal", amount: 1_800_000, category: "UTILITIES" },
  { title: "Tozalash", amount: 900_000, category: "OTHER" },
];

const unit = (title: string, rentPrice: number, area: number, occupied: boolean, rooms = 1): UnitSeed => ({
  title,
  rentPrice,
  area,
  rooms,
  occupied,
});

const SEEDS: Record<RentalIndustry, IndustrySeed> = {
  OFFICE_RENTAL: {
    address: "Demo Business Center",
    units: [
      unit("101", 4_500_000, 28, true),
      unit("102", 4_200_000, 25, true),
      unit("103", 3_800_000, 22, false),
      unit("201", 5_000_000, 32, true),
      unit("202", 4_000_000, 24, false),
      unit("203", 4_600_000, 29, true),
    ],
    customers: ["Nova Design", "Atlas Logistics", "Legal Partners", "Softline IT"],
    shortTerm: false,
    expenses: OFFICE_EXPENSES,
  },
  APARTMENT_RENTAL: {
    address: "Toshkent shahri",
    units: [
      unit("Chilonzor 2 xonali", 5_500_000, 54, true, 2),
      unit("Yunusobod 3 xonali", 8_000_000, 78, true, 3),
      unit("Mirzo Ulug‘bek 2 xonali", 6_000_000, 58, false, 2),
      unit("Sergeli 1 xonali", 3_500_000, 36, false, 1),
    ],
    customers: ["Aziz Karimov", "Dilnoza Rahimova", "Sardor Tursunov"],
    shortTerm: false,
    expenses: [
      { title: "Kommunal", amount: 700_000, category: "UTILITIES" },
      { title: "Ta'mirlash", amount: 1_200_000, category: "REPAIR" },
    ],
  },
  HOTEL_HOSTEL: {
    address: "Demo Hotel",
    units: [
      unit("101 Standard", 450_000, 18, true),
      unit("102 Standard", 450_000, 18, false),
      unit("201 Deluxe", 750_000, 26, true),
      unit("202 Deluxe", 750_000, 26, false),
      unit("301 Family", 950_000, 34, false),
      unit("302 Family", 950_000, 34, false),
    ],
    customers: ["Jasur Aliyev", "Malika Usmonova", "Bekzod Nazarov"],
    shortTerm: true,
    bookings: [
      { unitIndex: 0, customerIndex: 0, checkInOffset: -1, checkOutOffset: 2, status: "CHECKED_IN", guestCount: 2, nightlyRate: 450_000, paid: 1_350_000, paidDaysAgo: 0 },
      { unitIndex: 2, customerIndex: 1, checkInOffset: 0, checkOutOffset: 3, status: "CONFIRMED", guestCount: 2, nightlyRate: 750_000, paid: 750_000, paidDaysAgo: 0 },
      { unitIndex: 1, customerIndex: 2, checkInOffset: 4, checkOutOffset: 6, status: "PENDING", guestCount: 1, nightlyRate: 450_000 },
    ],
    expenses: [
      { title: "Kommunal", amount: 2_500_000, category: "UTILITIES" },
      { title: "Tozalash", amount: 1_500_000, category: "OTHER" },
    ],
  },
  // Cars live in the Vehicle model, never in properties; no vehicle contracts yet.
  CAR_RENTAL: {
    address: "",
    units: [],
    customers: ["Otabek Ergashev", "Nodira Saidova"],
    shortTerm: false,
    expenses: [{ title: "Internet", amount: 400_000, category: "UTILITIES" }],
    vehicles: [
      { brand: "Chevrolet", model: "Cobalt", year: 2023, status: "AVAILABLE", dailyRate: 350_000, color: "Oq", mileage: 18_500 },
      { brand: "Chevrolet", model: "Tracker", year: 2024, status: "RENTED", dailyRate: 550_000, color: "Kulrang", mileage: 9_200 },
      { brand: "Kia", model: "K5", year: 2022, status: "MAINTENANCE", dailyRate: 700_000, color: "Qora", mileage: 41_000 },
    ],
    rentals: [
      { vehicleIndex: 1, customerIndex: 0, startOffset: -2, endOffset: 3, paid: 2_000_000, paidDaysAgo: 1 },
      { vehicleIndex: 0, customerIndex: 1, startOffset: 5, endOffset: 7 },
    ],
  },
  RETAIL_RENTAL: {
    address: "Demo Savdo Markazi",
    units: [
      unit("A-01", 6_000_000, 20, true),
      unit("A-02", 5_500_000, 18, true),
      unit("B-01", 5_000_000, 16, false),
      unit("B-02", 5_000_000, 16, true),
      unit("C-01", 4_500_000, 14, false),
    ],
    customers: ["Coffee Point", "Mobile Store", "Kids Fashion"],
    shortTerm: false,
    expenses: OFFICE_EXPENSES,
  },
  WAREHOUSE_RENTAL: {
    address: "Demo Logistika Parki",
    units: [
      unit("Ombor A", 12_000_000, 400, true),
      unit("Ombor B", 9_000_000, 300, true),
      unit("Ombor C", 7_500_000, 250, false),
      unit("Ombor D", 15_000_000, 500, false),
    ],
    customers: ["Orient Logistics", "Market Distribution", "Express Cargo"],
    shortTerm: false,
    expenses: [
      { title: "Elektr energiya", amount: 3_000_000, category: "UTILITIES" },
      { title: "Qo'riqlash", amount: 2_000_000, category: "OTHER" },
    ],
  },
  VILLA_RENTAL: {
    address: "Chorvoq",
    units: [
      unit("Chorvoq Villa 1", 2_500_000, 180, true, 4),
      unit("Chorvoq Villa 2", 2_200_000, 160, false, 3),
      unit("Family Dacha", 1_500_000, 120, false, 3),
      unit("Mountain House", 3_000_000, 220, false, 5),
    ],
    customers: ["Ulug‘bek Qodirov", "Sevara Mirzayeva"],
    shortTerm: true,
    bookings: [
      { unitIndex: 0, customerIndex: 0, checkInOffset: -1, checkOutOffset: 2, status: "CHECKED_IN", guestCount: 6, nightlyRate: 2_500_000, paid: 5_000_000, paidDaysAgo: 1 },
      { unitIndex: 1, customerIndex: 1, checkInOffset: 3, checkOutOffset: 5, status: "CONFIRMED", guestCount: 4, nightlyRate: 2_200_000 },
    ],
    expenses: [{ title: "Tozalash", amount: 600_000, category: "OTHER" }],
  },
  COMMERCIAL_RENTAL: {
    address: "Demo Tijorat Kompleksi",
    units: [
      unit("Business Center A", 20_000_000, 300, true),
      unit("Store 1", 7_000_000, 80, true),
      unit("Warehouse Block", 10_000_000, 350, false),
      unit("Office Floor 2", 15_000_000, 250, false),
    ],
    customers: ["Prime Retail", "Delta Group", "Smart Office"],
    shortTerm: false,
    expenses: OFFICE_EXPENSES,
  },
  OTHER: {
    address: "Toshkent shahri",
    units: [
      unit("1-xona", 3_000_000, 20, true),
      unit("2-xona", 3_200_000, 22, true),
      unit("3-xona", 2_800_000, 18, false),
    ],
    customers: ["Alisher Sobirov", "Gulnora Yusupova"],
    shortTerm: false,
    expenses: [{ title: "Kommunal", amount: 800_000, category: "UTILITIES" }],
  },
};

/** Every customer name the seed can write (seeded tenants carry no note column). */
export const DEMO_SEED_CUSTOMER_NAMES: readonly string[] = [
  ...new Set(Object.values(SEEDS).flatMap((s) => s.customers)),
];

/** Seeded tenant phones are "+99890000" + 4-digit index; only meaningful together with name and seed time. */
export const DEMO_SEED_TENANT_PHONE = /^\+99890000\d{4}$/;

export type DemoSeedPlan = {
  industry: RentalIndustry;
  properties: {
    key: string;
    title: string;
    address: string;
    region: string;
    district: string;
    building: string;
    rentPrice: number;
    area: number;
    rooms: number;
    status: "RENTED" | "AVAILABLE";
    description: string;
  }[];
  tenants: {
    key: string;
    fullName: string;
    phone: string;
    passport: string;
    rentAmount: number;
    contractDuration: number | null;
    entryDate: Date | null;
    paymentDueDate: Date | null;
  }[];
  contracts: {
    key: string;
    propertyKey: string;
    tenantKey: string;
    startDate: Date;
    endDate: Date;
    monthlyRent: number;
    status: "ACTIVE";
    notes: string;
  }[];
  payments: {
    contractKey: string;
    amount: number;
    paymentDate: Date;
    periodYear: number;
    periodMonth: number;
    paymentMethod: "CASH" | "CARD" | "BANK";
    notes: string;
  }[];
  expenses: {
    title: string;
    amount: number;
    category: ExpenseCategory;
    date: Date;
    notes: string;
  }[];
  rentals: {
    key: string;
    vehicleKey: string;
    tenantKey: string;
    startDate: Date;
    endDate: Date;
    days: number;
    dailyRate: number;
    totalAmount: number;
    status: VehicleRentalStatus;
    notes: string;
  }[];
  bookings: {
    key: string;
    propertyKey: string;
    tenantKey: string;
    guestName: string;
    guestPhone: string | null;
    arrivalStatus: BookingArrivalStatus;
    checkInDate: Date;
    checkOutDate: Date;
    nights: number;
    nightlyRate: number;
    totalAmount: number;
    status: BookingStatus;
    guestCount: number;
    notes: string;
  }[];
  sourcePayments: {
    sourceType: "VEHICLE_RENTAL" | "BOOKING";
    sourceKey: string;
    amount: number;
    paymentDate: Date;
    paymentMethod: "CASH" | "CARD" | "BANK";
    notes: string;
  }[];
  vehicles: {
    key: string;
    name: string;
    brand: string;
    model: string;
    year: number;
    plateNumber: string;
    status: VehicleStatus;
    dailyRate: number;
    color: string;
    mileage: number;
    notes: string;
  }[];
};

const DAY = 24 * 60 * 60 * 1000;
const PLATE_LETTERS = "ABDEHKMNPSTXYZ";

/** "01 A 482 KM": the 3 digits and 2 letters come from `plateSeed`, so runs don't collide. */
export function demoPlateNumber(plateSeed: number, index: number): string {
  const seed = Math.abs(Math.floor(plateSeed)) + index * 7919;
  const digits = String(100 + (seed % 900));
  const l = PLATE_LETTERS;
  const first = l[index % l.length];
  const tail = l[Math.floor(seed / 900) % l.length] + l[Math.floor(seed / 12_600) % l.length];
  return `01 ${first} ${digits} ${tail}`;
}

function tashkentMidnight(year: number, month: number, day: number): Date {
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return new Date(`${year}-${mm}-${dd}T00:00:00+05:00`);
}

function addMonths(year: number, month: number, delta: number) {
  const index = year * 12 + (month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

export function resolveSeedIndustry(value: unknown): RentalIndustry {
  return isRentalIndustry(value) ? value : "OTHER";
}

/** Pure plan: all dates relative to `now` in Asia/Tashkent; counts capped by plan limits. */
export function buildDemoSeedPlan(
  industryValue: unknown,
  now: Date,
  limits: { properties: number | null; tenants: number | null; vehicles?: number | null },
  plateSeed = 0
): DemoSeedPlan {
  const industry = resolveSeedIndustry(industryValue);
  const seed = SEEDS[industry];
  const today = getTashkentDateParts(now);
  const monthStart = tashkentMidnight(today.year, today.month, 1);
  const prev = addMonths(today.year, today.month, -1);
  const prevMonthStart = tashkentMidnight(prev.year, prev.month, 1);
  const inMonth = (daysAgo: number) =>
    new Date(Math.max(monthStart.getTime(), now.getTime() - daysAgo * DAY));

  const units = seed.units.slice(0, limits.properties ?? seed.units.length);
  const customers = seed.customers.slice(0, limits.tenants ?? seed.customers.length);

  const plan: DemoSeedPlan = {
    industry,
    properties: [],
    tenants: [],
    contracts: [],
    payments: [],
    expenses: [],
    vehicles: [],
    rentals: [],
    bookings: [],
    sourcePayments: [],
  };
  const paidAt = (daysAgo = 0) => (daysAgo === 0 ? now : inMonth(daysAgo));

  const vehicleSeeds = seed.vehicles ?? [];
  vehicleSeeds.slice(0, limits.vehicles ?? vehicleSeeds.length).forEach((v, i) => {
    plan.vehicles.push({
      ...v,
      key: `v${i}`,
      name: `${v.brand} ${v.model}`,
      plateNumber: demoPlateNumber(plateSeed, i),
      notes: DEMO_SEED_NOTE,
    });
  });

  // Short stays never become contracts, so their units stay AVAILABLE and nobody owes rent.
  const occupiedUnits = seed.shortTerm ? [] : units.filter((u) => u.occupied);
  const pairs = occupiedUnits.slice(0, customers.length);
  const pairedTitles = new Set(pairs.map((u) => u.title));

  units.forEach((u, i) => {
    plan.properties.push({
      key: `p${i}`,
      title: u.title,
      address: seed.address,
      region: "Toshkent shahri",
      district: LWN_BUILDING,
      building: LWN_BUILDING,
      rentPrice: u.rentPrice,
      area: u.area,
      rooms: u.rooms,
      status: pairedTitles.has(u.title) ? "RENTED" : "AVAILABLE",
      description: DEMO_SEED_NOTE,
    });
  });

  customers.forEach((name, i) => {
    const pairedUnit = pairs[i];
    const isDebtor = !seed.shortTerm && pairs.length > 1 && i === pairs.length - 1;
    const start = !pairedUnit
      ? null
      : seed.shortTerm
        ? inMonth(1)
        : isDebtor
          ? prevMonthStart
          : monthStart;
    plan.tenants.push({
      key: `t${i}`,
      fullName: name,
      phone: `+99890000${String(i + 1).padStart(4, "0")}`,
      passport: "",
      rentAmount: pairedUnit?.rentPrice ?? 0,
      contractDuration: pairedUnit && !seed.shortTerm ? 12 : null,
      entryDate: start,
      paymentDueDate: start,
    });
  });

  pairs.forEach((u, i) => {
    const propertyKey = `p${units.indexOf(u)}`;
    const tenantKey = `t${i}`;
    const key = `c${i}`;
    const startDate = plan.tenants[i].entryDate!;
    const startParts = getTashkentDateParts(startDate);
    const end = addMonths(startParts.year, startParts.month, 12);
    const endDate = seed.shortTerm
      ? new Date(now.getTime() + 3 * DAY)
      : tashkentMidnight(end.year, end.month, 1);
    const amount = seed.shortTerm ? u.rentPrice * 3 : u.rentPrice;
    plan.contracts.push({
      key,
      propertyKey,
      tenantKey,
      startDate,
      endDate,
      monthlyRent: amount,
      status: "ACTIVE",
      notes: DEMO_SEED_NOTE,
    });
    plan.payments.push({
      contractKey: key,
      amount,
      paymentDate: seed.shortTerm ? now : inMonth(i + 1),
      periodYear: today.year,
      periodMonth: today.month,
      paymentMethod: i % 2 === 0 ? "BANK" : "CARD",
      notes: DEMO_SEED_NOTE,
    });
  });

  const todayDate = tashkentToday(now);
  for (const r of seed.rentals ?? []) {
    const vehicle = plan.vehicles[r.vehicleIndex];
    if (!vehicle || r.customerIndex >= plan.tenants.length) continue;
    const startDate = addDays(todayDate, r.startOffset);
    const endDate = addDays(todayDate, r.endOffset);
    const days = rentalDays(startDate, endDate)!;
    const key = `r${plan.rentals.length}`;
    if (r.paid) {
      plan.sourcePayments.push({
        sourceType: "VEHICLE_RENTAL",
        sourceKey: key,
        amount: r.paid,
        paymentDate: paidAt(r.paidDaysAgo),
        paymentMethod: "CASH",
        notes: DEMO_SEED_NOTE,
      });
    }
    plan.rentals.push({
      key,
      vehicleKey: vehicle.key,
      tenantKey: `t${r.customerIndex}`,
      startDate: toStoredDate(startDate),
      endDate: toStoredDate(endDate),
      days,
      dailyRate: vehicle.dailyRate,
      totalAmount: rentalTotal(days, vehicle.dailyRate),
      status: initialRentalStatus(startDate, endDate, todayDate),
      notes: DEMO_SEED_NOTE,
    });
  }

  for (const b of seed.bookings ?? []) {
    if (b.unitIndex >= plan.properties.length || b.customerIndex >= plan.tenants.length) continue;
    const checkInDate = addDays(todayDate, b.checkInOffset);
    const checkOutDate = addDays(todayDate, b.checkOutOffset);
    const nights = bookingNights(checkInDate, checkOutDate)!;
    const key = `b${plan.bookings.length}`;
    if (b.paid) {
      plan.sourcePayments.push({
        sourceType: "BOOKING",
        sourceKey: key,
        amount: b.paid,
        paymentDate: paidAt(b.paidDaysAgo),
        paymentMethod: "CARD",
        notes: DEMO_SEED_NOTE,
      });
    }
    const guest = plan.tenants[b.customerIndex];
    plan.bookings.push({
      key,
      propertyKey: `p${b.unitIndex}`,
      tenantKey: `t${b.customerIndex}`,
      guestName: guest.fullName,
      guestPhone: guest.phone || null,
      arrivalStatus: b.status === "CHECKED_IN" || b.status === "CHECKED_OUT" ? "ARRIVED" : "EXPECTED",
      checkInDate: toStoredDate(checkInDate),
      checkOutDate: toStoredDate(checkOutDate),
      nights,
      nightlyRate: b.nightlyRate,
      totalAmount: bookingTotal(nights, b.nightlyRate),
      status: b.status,
      guestCount: b.guestCount,
      notes: DEMO_SEED_NOTE,
    });
  }

  seed.expenses.forEach((e, i) => {
    plan.expenses.push({ ...e, date: inMonth(i + 2), notes: DEMO_SEED_NOTE });
  });

  return plan;
}
