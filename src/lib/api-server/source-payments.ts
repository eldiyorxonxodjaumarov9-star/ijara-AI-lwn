import type { Prisma, User } from "@prisma/client";
import type { NextRequest, NextResponse } from "next/server";

import {
  getPaymentSummary,
  isPayableSource,
  sourceTypeForIndustry,
  type SourceBalance,
  type SourcePaymentIncome,
  type SourcePaymentInput,
  type SourcePaymentType,
  type SourcePaymentUpdateInput,
  type SourcePaymentView,
} from "@/lib/source-payments";
import { addDays, fromStoredDate, tashkentToday, toStoredDate } from "@/lib/vehicle-rentals";

import { fail } from "./http";
import { requireResourceAccess, type RbacMethod } from "./rbac";
import { resolveUserWorkspaceContext, type WorkspaceContext } from "./workspace";

export class SourcePaymentError extends Error {
  constructor(message: string, readonly status: number, readonly code: string) {
    super(message);
  }
}

const PAYMENT_NOT_FOUND = () => new SourcePaymentError("To‘lov topilmadi", 404, "NOT_FOUND");
const SOURCE_NOT_FOUND = () => new SourcePaymentError("To‘lov manbasi topilmadi", 404, "SOURCE_NOT_FOUND");

/** Source type is derived from the DB workspace industry, never from the request. */
export function allowedSourceType(ctx: Pick<WorkspaceContext, "workspace">): SourcePaymentType {
  const type = sourceTypeForIndustry(ctx.workspace.industry);
  if (!type) {
    throw new SourcePaymentError(
      "Bu to‘lov turi faqat avtomobil ijarasi, mehmonxona va dacha / villa uchun",
      403,
      "INDUSTRY_NOT_SUPPORTED"
    );
  }
  return type;
}

type GuardOk = { user: User; ctx: WorkspaceContext; sourceType: SourcePaymentType; error?: undefined };
type GuardErr = { error: NextResponse; user?: undefined; ctx?: undefined; sourceType?: undefined };

/** Same RBAC as legacy payments: EMPLOYEE read-only. */
export async function requireSourcePaymentWorkspace(req: NextRequest, method: RbacMethod): Promise<GuardOk | GuardErr> {
  const auth = await requireResourceAccess(req, "payments", method);
  if (auth.error) return { error: auth.error };
  const ctx = await resolveUserWorkspaceContext(auth.user);
  if (!ctx.hasAccess) {
    return { error: fail("Obuna talab qilinadi", 402, "SUBSCRIPTION_REQUIRED") };
  }
  try {
    return { user: auth.user, ctx, sourceType: allowedSourceType(ctx) };
  } catch (err) {
    return { error: sourcePaymentErrorResponse(err)! };
  }
}

export function sourcePaymentErrorResponse(err: unknown) {
  if (err instanceof SourcePaymentError) return fail(err.message, err.status, err.code);
  return null;
}

export type SourcePaymentDb = Pick<
  Prisma.TransactionClient,
  "sourcePayment" | "vehicleRental" | "booking" | "$queryRaw"
>;

type SourceRecord = {
  id: string;
  status: string;
  total: number;
  customerName: string;
  unitName: string;
  startDate: string;
  endDate: string;
};

const sourceKey = (type: SourcePaymentType) => (type === "VEHICLE_RENTAL" ? "vehicleRentalId" : "bookingId");

/** Locks the source row (serializes payments per source) and proves workspace ownership. */
async function lockSource(db: SourcePaymentDb, workspaceId: string, type: SourcePaymentType, id: string) {
  if (type === "VEHICLE_RENTAL") {
    await db.$queryRaw`SELECT id FROM vehicle_rentals WHERE id = ${id} AND "workspaceId" = ${workspaceId} FOR UPDATE`;
  } else {
    await db.$queryRaw`SELECT id FROM bookings WHERE id = ${id} AND "workspaceId" = ${workspaceId} FOR UPDATE`;
  }
  const source = await findSource(db, workspaceId, type, id);
  if (!source) throw SOURCE_NOT_FOUND();
  return source;
}

async function findSource(
  db: SourcePaymentDb,
  workspaceId: string,
  type: SourcePaymentType,
  id: string
): Promise<SourceRecord | null> {
  if (type === "VEHICLE_RENTAL") {
    const r = await db.vehicleRental.findFirst({
      where: { id, workspaceId },
      include: { vehicle: { select: { name: true, plateNumber: true } }, tenant: { select: { fullName: true } } },
    });
    return r ? rentalRecord(r) : null;
  }
  const b = await db.booking.findFirst({
    where: { id, workspaceId },
    include: { property: { select: { title: true } }, tenant: { select: { fullName: true } } },
  });
  return b ? bookingRecord(b) : null;
}

type RentalWithNames = {
  id: string;
  status: string;
  totalAmount: number;
  startDate: Date;
  endDate: Date;
  vehicle?: { name: string; plateNumber: string } | null;
  tenant?: { fullName: string } | null;
};

type BookingWithNames = {
  id: string;
  status: string;
  totalAmount: number;
  checkInDate: Date;
  checkOutDate: Date;
  property?: { title: string } | null;
  tenant?: { fullName: string } | null;
};

function rentalRecord(r: RentalWithNames): SourceRecord {
  const plate = r.vehicle?.plateNumber ? ` (${r.vehicle.plateNumber})` : "";
  return {
    id: r.id,
    status: r.status,
    total: r.totalAmount,
    customerName: r.tenant?.fullName ?? "—",
    unitName: `${r.vehicle?.name ?? "—"}${plate}`,
    startDate: fromStoredDate(r.startDate),
    endDate: fromStoredDate(r.endDate),
  };
}

function bookingRecord(b: BookingWithNames): SourceRecord {
  return {
    id: b.id,
    status: b.status,
    total: b.totalAmount,
    customerName: b.tenant?.fullName ?? "—",
    unitName: b.property?.title ?? "—",
    startDate: fromStoredDate(b.checkInDate),
    endDate: fromStoredDate(b.checkOutDate),
  };
}

async function paidFor(db: SourcePaymentDb, workspaceId: string, type: SourcePaymentType, id: string, exceptId?: string) {
  const agg = await db.sourcePayment.aggregate({
    where: { workspaceId, sourceType: type, [sourceKey(type)]: id, ...(exceptId ? { NOT: { id: exceptId } } : {}) },
    _sum: { amount: true },
  });
  return agg._sum.amount ?? 0;
}

function resolvePaymentDate(date: string | undefined, now: Date) {
  if (!date) return now;
  const today = tashkentToday(now);
  if (date > today) {
    throw new SourcePaymentError("Kelajak sanasi bilan to‘lov kiritib bo‘lmaydi", 400, "VALIDATION_ERROR");
  }
  return date === today ? now : toStoredDate(date);
}

function assertWithinRemaining(amount: number, total: number, paid: number) {
  const { remaining } = getPaymentSummary(total, paid);
  if (amount > remaining) {
    throw new SourcePaymentError(
      remaining <= 0
        ? "Bu manba to‘liq to‘langan"
        : `Summa qolgan qarzdan oshmasligi kerak (qolgan: ${remaining})`,
      409,
      "OVERPAYMENT"
    );
  }
}

type PaymentRow = {
  id: string;
  sourceType: SourcePaymentType;
  vehicleRentalId: string | null;
  bookingId: string | null;
  amount: number;
  paymentDate: Date;
  paymentMethod: SourcePaymentView["paymentMethod"];
  notes: string | null;
  createdAt: Date;
};

function toPaymentView(row: PaymentRow, source: Pick<SourceRecord, "customerName" | "unitName"> | undefined): SourcePaymentView {
  return {
    id: row.id,
    sourceType: row.sourceType,
    sourceId: (row.vehicleRentalId ?? row.bookingId)!,
    amount: row.amount,
    paymentDate: new Date(row.paymentDate).toISOString(),
    paymentMethod: row.paymentMethod,
    notes: row.notes,
    customerName: source?.customerName ?? "—",
    unitName: source?.unitName ?? "—",
    createdAt: new Date(row.createdAt).toISOString(),
  };
}

export async function createSourcePayment(
  db: SourcePaymentDb,
  workspaceId: string,
  allowed: SourcePaymentType,
  input: SourcePaymentInput,
  now = new Date()
) {
  if (input.sourceType && input.sourceType !== allowed) {
    throw new SourcePaymentError("Bu biznes turi uchun bunday to‘lov manbasi mumkin emas", 400, "SOURCE_NOT_ALLOWED");
  }
  const source = await lockSource(db, workspaceId, allowed, input.sourceId);
  if (source.status === "CANCELLED") {
    throw new SourcePaymentError("Bekor qilingan manbaga to‘lov qo‘shib bo‘lmaydi", 409, "SOURCE_CLOSED");
  }
  const paymentDate = resolvePaymentDate(input.paymentDate, now);
  const paid = await paidFor(db, workspaceId, allowed, source.id);
  assertWithinRemaining(input.amount, source.total, paid);

  const row = await db.sourcePayment.create({
    data: {
      workspaceId,
      sourceType: allowed,
      [sourceKey(allowed)]: source.id,
      amount: input.amount,
      paymentDate,
      paymentMethod: input.paymentMethod,
      notes: input.notes,
    },
  });
  return {
    payment: toPaymentView(row as PaymentRow, source),
    summary: getPaymentSummary(source.total, paid + input.amount),
  };
}

async function findPayment(db: SourcePaymentDb, workspaceId: string, allowed: SourcePaymentType, id: string) {
  const row = await db.sourcePayment.findFirst({ where: { id, workspaceId, sourceType: allowed } });
  if (!row) throw PAYMENT_NOT_FOUND();
  return row as PaymentRow;
}

export async function updateSourcePayment(
  db: SourcePaymentDb,
  workspaceId: string,
  allowed: SourcePaymentType,
  id: string,
  input: SourcePaymentUpdateInput,
  now = new Date()
) {
  const existing = await findPayment(db, workspaceId, allowed, id);
  const sourceId = (existing.vehicleRentalId ?? existing.bookingId)!;
  const source = await lockSource(db, workspaceId, allowed, sourceId);

  const data: Prisma.SourcePaymentUncheckedUpdateManyInput = {};
  if (input.amount !== undefined && input.amount !== existing.amount) {
    const paidOthers = await paidFor(db, workspaceId, allowed, sourceId, id);
    assertWithinRemaining(input.amount, source.total, paidOthers);
    data.amount = input.amount;
  }
  if (input.paymentDate !== undefined) data.paymentDate = resolvePaymentDate(input.paymentDate, now);
  if (input.paymentMethod !== undefined) data.paymentMethod = input.paymentMethod;
  if (input.notes !== undefined) data.notes = input.notes;

  if (Object.keys(data).length > 0) {
    const { count } = await db.sourcePayment.updateMany({ where: { id, workspaceId, sourceType: allowed }, data });
    if (count === 0) throw PAYMENT_NOT_FOUND();
  }
  const row = await findPayment(db, workspaceId, allowed, id);
  const paid = await paidFor(db, workspaceId, allowed, sourceId);
  return { payment: toPaymentView(row, source), summary: getPaymentSummary(source.total, paid) };
}

export async function deleteSourcePayment(
  db: SourcePaymentDb,
  workspaceId: string,
  allowed: SourcePaymentType,
  id: string
) {
  const existing = await findPayment(db, workspaceId, allowed, id);
  const sourceId = (existing.vehicleRentalId ?? existing.bookingId)!;
  const source = await lockSource(db, workspaceId, allowed, sourceId);
  const { count } = await db.sourcePayment.deleteMany({ where: { id, workspaceId, sourceType: allowed } });
  if (count === 0) throw PAYMENT_NOT_FOUND();
  const paid = await paidFor(db, workspaceId, allowed, sourceId);
  return { id, summary: getPaymentSummary(source.total, paid) };
}

/** Tashkent day/month boundaries as stored instants. */
export function incomeWindows(now = new Date()) {
  const today = tashkentToday(now);
  const [y, m] = today.split("-").map(Number);
  const nextMonth = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
  return {
    dayStart: toStoredDate(today),
    dayEnd: toStoredDate(addDays(today, 1)),
    monthStart: toStoredDate(`${today.slice(0, 7)}-01`),
    monthEnd: toStoredDate(nextMonth),
  };
}

/** Real payment amounts only — rental/booking totalAmount is never revenue. */
export async function getSourcePaymentIncome(
  db: Pick<SourcePaymentDb, "sourcePayment">,
  workspaceId: string,
  allowed: SourcePaymentType,
  now = new Date()
): Promise<SourcePaymentIncome> {
  const w = incomeWindows(now);
  const [today, month] = await Promise.all([
    db.sourcePayment.aggregate({
      where: { workspaceId, sourceType: allowed, paymentDate: { gte: w.dayStart, lt: w.dayEnd } },
      _sum: { amount: true },
    }),
    db.sourcePayment.aggregate({
      where: { workspaceId, sourceType: allowed, paymentDate: { gte: w.monthStart, lt: w.monthEnd } },
      _sum: { amount: true },
    }),
  ]);
  return { today: today._sum.amount ?? 0, month: month._sum.amount ?? 0 };
}

/** Latest payments with names via one include query (no N+1). */
export async function listRecentSourcePayments(
  db: Pick<SourcePaymentDb, "sourcePayment">,
  workspaceId: string,
  allowed: SourcePaymentType,
  take = 5
): Promise<SourcePaymentView[]> {
  const rows = await db.sourcePayment.findMany({
    where: { workspaceId, sourceType: allowed },
    orderBy: { paymentDate: "desc" },
    take,
    include: {
      vehicleRental: {
        include: { vehicle: { select: { name: true, plateNumber: true } }, tenant: { select: { fullName: true } } },
      },
      booking: { include: { property: { select: { title: true } }, tenant: { select: { fullName: true } } } },
    },
  });
  return rows.map((r) =>
    toPaymentView(
      r as PaymentRow,
      r.vehicleRental ? rentalRecord(r.vehicleRental) : r.booking ? bookingRecord(r.booking) : undefined
    )
  );
}

/** Fixed number of queries regardless of row count (no N+1). */
export async function listSourcePayments(
  db: SourcePaymentDb,
  workspaceId: string,
  allowed: SourcePaymentType,
  now = new Date()
) {
  const key = sourceKey(allowed);
  const [sources, grouped, rows, income] = await Promise.all([
    allowed === "VEHICLE_RENTAL"
      ? db.vehicleRental
          .findMany({
            where: { workspaceId },
            orderBy: { startDate: "desc" },
            include: { vehicle: { select: { name: true, plateNumber: true } }, tenant: { select: { fullName: true } } },
          })
          .then((list) => list.map(rentalRecord))
      : db.booking
          .findMany({
            where: { workspaceId },
            orderBy: { checkInDate: "desc" },
            include: { property: { select: { title: true } }, tenant: { select: { fullName: true } } },
          })
          .then((list) => list.map(bookingRecord)),
    db.sourcePayment.groupBy({
      by: [key],
      where: { workspaceId, sourceType: allowed },
      _sum: { amount: true },
      _max: { paymentDate: true },
      _count: { _all: true },
    }),
    db.sourcePayment.findMany({
      where: { workspaceId, sourceType: allowed },
      orderBy: { paymentDate: "desc" },
      take: 500,
    }),
    getSourcePaymentIncome(db, workspaceId, allowed, now),
  ]);

  type Group = { _sum: { amount: number | null }; _max: { paymentDate: Date | null }; _count: { _all: number } } & Record<string, unknown>;
  const byId = new Map((grouped as Group[]).map((g) => [g[key] as string, g]));
  const sourceById = new Map(sources.map((s) => [s.id, s]));

  const balances: SourceBalance[] = sources.map((s) => {
    const g = byId.get(s.id);
    return {
      ...getPaymentSummary(s.total, g?._sum.amount ?? 0),
      sourceType: allowed,
      sourceId: s.id,
      sourceStatus: s.status,
      customerName: s.customerName,
      unitName: s.unitName,
      startDate: s.startDate,
      endDate: s.endDate,
      lastPaymentDate: g?._max.paymentDate ? new Date(g._max.paymentDate).toISOString() : null,
      paymentCount: g?._count._all ?? 0,
    };
  });

  const payments = (rows as PaymentRow[]).map((r) =>
    toPaymentView(r, sourceById.get((r.vehicleRentalId ?? r.bookingId)!))
  );
  return { sourceType: allowed, balances, payments, income, payableCount: balances.filter((b) => isPayableSource(b.sourceStatus, b.remaining)).length };
}

type HistoryDb = Pick<Prisma.TransactionClient, "sourcePayment">;

/** Delete guards for rentals/bookings/tenants. Null = no payment history. */
export async function sourcePaymentHistoryResponse(
  db: HistoryDb,
  where: { vehicleRentalId: string } | { bookingId: string } | { tenantId: string },
  workspaceId?: string
) {
  const filter: Prisma.SourcePaymentWhereInput =
    "tenantId" in where
      ? { OR: [{ vehicleRental: { tenantId: where.tenantId } }, { booking: { tenantId: where.tenantId } }] }
      : where;
  const n = await db.sourcePayment.count({ where: workspaceId ? { ...filter, workspaceId } : filter });
  if (n === 0) return null;
  const message =
    "vehicleRentalId" in where
      ? "Bu ijarada to‘lovlar bor. To‘lov tarixi saqlanishi uchun o‘chirib bo‘lmaydi — bekor qiling."
      : "bookingId" in where
        ? "Bu bronda to‘lovlar bor. To‘lov tarixi saqlanishi uchun o‘chirib bo‘lmaydi."
        : "Bu mijozning to‘lov tarixi bor, uni o‘chirib bo‘lmaydi.";
  return fail(message, 409, "HAS_PAYMENT_HISTORY");
}
