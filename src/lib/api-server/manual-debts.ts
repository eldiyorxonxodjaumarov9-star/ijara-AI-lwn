import type { Prisma, User } from "@prisma/client";
import type { NextRequest, NextResponse } from "next/server";

import {
  AMOUNT_BELOW_PAID_MESSAGE,
  deriveManualDebtState,
  roundMoney,
  type ManualDebtInput,
  type ManualDebtPaymentInput,
  type ManualDebtReminder,
  type ManualDebtStatus,
  type ManualDebtUpdateInput,
  type ManualDebtView,
} from "@/lib/manual-debts";
import { fromStoredDate, toStoredDate } from "@/lib/vehicle-rentals";

import { fail } from "./http";
import { prisma } from "./prisma";
import { requireResourceAccess, type RbacMethod } from "./rbac";
import { resolveUserWorkspaceContext } from "./workspace";

export class ManualDebtError extends Error {
  constructor(message: string, readonly status: number, readonly code: string) {
    super(message);
  }
}

const NOT_FOUND = () => new ManualDebtError("Qarz topilmadi", 404, "NOT_FOUND");
const CONFLICT = () =>
  new ManualDebtError("Qarz bir vaqtda o‘zgartirildi, qayta urinib ko‘ring", 409, "CONCURRENT_UPDATE");

type GuardOk = { user: User; workspaceId: string; error?: undefined };
type GuardErr = { error: NextResponse; user?: undefined; workspaceId?: undefined };

/**
 * Qo'lda qarz — moliyaviy yozuv: "payments" RBAC siyosati qayta ishlatiladi
 * (EMPLOYEE faqat ko'radi). Workspace server membership'dan olinadi.
 */
export async function requireManualDebtWorkspace(
  req: NextRequest,
  method: RbacMethod
): Promise<GuardOk | GuardErr> {
  const auth = await requireResourceAccess(req, "payments", method);
  if (auth.error) return { error: auth.error };
  const ctx = await resolveUserWorkspaceContext(auth.user);
  if (!ctx.hasAccess) {
    return { error: fail("Obuna talab qilinadi", 402, "SUBSCRIPTION_REQUIRED") };
  }
  return { user: auth.user, workspaceId: ctx.workspace.id };
}

export function manualDebtErrorResponse(err: unknown) {
  if (err instanceof ManualDebtError) return fail(err.message, err.status, err.code);
  return null;
}

type Db = Pick<Prisma.TransactionClient, "manualDebt" | "manualDebtPayment" | "property" | "tenant">;

const DEBT_INCLUDE = { property: { select: { title: true } } } as const;

type ManualDebtRow = {
  id: string;
  propertyId: string | null;
  debtorName: string;
  debtorPhone: string | null;
  debtorOccupation: string | null;
  description: string | null;
  originalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  debtDate: Date;
  status: ManualDebtStatus;
  telegramChatId: string | null;
  createdById: string | null;
  createdAt: Date;
  closedAt: Date | null;
  cancelledAt: Date | null;
  cancelReason: string | null;
  property?: { title: string } | null;
  payments?: {
    id: string;
    amount: number;
    paymentDate: Date;
    notes: string | null;
    createdById: string | null;
    createdAt: Date;
  }[];
};

export function toManualDebtView(row: ManualDebtRow): ManualDebtView {
  return {
    id: row.id,
    propertyId: row.propertyId,
    propertyName: row.property?.title ?? null,
    debtorName: row.debtorName,
    debtorPhone: row.debtorPhone,
    debtorOccupation: row.debtorOccupation,
    description: row.description,
    originalAmount: row.originalAmount,
    paidAmount: row.paidAmount,
    remainingAmount: row.remainingAmount,
    debtDate: fromStoredDate(row.debtDate),
    status: row.status,
    telegramLinked: !!row.telegramChatId,
    createdById: row.createdById,
    createdAt: row.createdAt.toISOString(),
    closedAt: row.closedAt?.toISOString() ?? null,
    cancelledAt: row.cancelledAt?.toISOString() ?? null,
    cancelReason: row.cancelReason,
    payments: row.payments?.map((p) => ({
      id: p.id,
      amount: p.amount,
      paymentDate: fromStoredDate(p.paymentDate),
      notes: p.notes,
      createdById: p.createdById,
      createdAt: p.createdAt.toISOString(),
    })),
  };
}

const phoneKey = (phone: string | null | undefined) => (phone ?? "").replace(/\D/g, "").slice(-9);

/**
 * Telefon bo'yicha Telegram chat — faqat SHU workspace ijarachilaridan.
 * Global telegram_bot_users jadvali ishlatilmaydi (workspace'siz).
 */
export async function resolveWorkspaceTelegramChat(
  db: Pick<Db, "tenant">,
  workspaceId: string,
  phone: string | null | undefined
): Promise<string | null> {
  const key = phoneKey(phone);
  if (key.length !== 9) return null;
  const tenants = await db.tenant.findMany({
    where: { workspaceId, telegramChatId: { not: null } },
    select: { phone: true, telegramChatId: true },
  });
  return tenants.find((t) => phoneKey(t.phone) === key)?.telegramChatId ?? null;
}

async function assertPropertyInWorkspace(db: Db, workspaceId: string, propertyId: string | null | undefined) {
  if (!propertyId) return;
  const property = await db.property.findFirst({ where: { id: propertyId, workspaceId }, select: { id: true } });
  if (!property) throw new ManualDebtError("Xona yoki obyekt topilmadi", 404, "PROPERTY_NOT_FOUND");
}

async function findOwned(db: Db, workspaceId: string, id: string) {
  const row = await db.manualDebt.findFirst({ where: { id, workspaceId } });
  if (!row) throw NOT_FOUND();
  return row;
}

export async function listManualDebts(db: Db, workspaceId: string, opts: { activeOnly?: boolean } = {}) {
  const rows = await db.manualDebt.findMany({
    where: {
      workspaceId,
      ...(opts.activeOnly ? { status: { in: ["OPEN", "PARTIAL"] }, remainingAmount: { gt: 0 } } : {}),
    },
    include: DEBT_INCLUDE,
    orderBy: { debtDate: "desc" },
    take: 1000,
  });
  return rows.map(toManualDebtView);
}

export async function getManualDebt(db: Db, workspaceId: string, id: string) {
  const row = await db.manualDebt.findFirst({
    where: { id, workspaceId },
    include: { ...DEBT_INCLUDE, payments: { orderBy: { paymentDate: "asc" } } },
  });
  if (!row) throw NOT_FOUND();
  return toManualDebtView(row);
}

export async function createManualDebt(db: Db, workspaceId: string, userId: string, input: ManualDebtInput) {
  await assertPropertyInWorkspace(db, workspaceId, input.propertyId);
  const telegramChatId = await resolveWorkspaceTelegramChat(db, workspaceId, input.debtorPhone);
  const row = await db.manualDebt.create({
    data: {
      workspaceId,
      propertyId: input.propertyId,
      debtorName: input.debtorName,
      debtorPhone: input.debtorPhone,
      debtorOccupation: input.debtorOccupation,
      description: input.description,
      originalAmount: input.originalAmount,
      paidAmount: 0,
      remainingAmount: input.originalAmount,
      debtDate: toStoredDate(input.debtDate),
      status: "OPEN",
      telegramChatId,
      createdById: userId,
    },
    include: DEBT_INCLUDE,
  });
  return toManualDebtView(row);
}

export async function updateManualDebt(db: Db, workspaceId: string, id: string, input: ManualDebtUpdateInput) {
  const existing = await findOwned(db, workspaceId, id);
  if (existing.status === "CANCELLED") {
    throw new ManualDebtError("Bekor qilingan qarzni tahrirlab bo‘lmaydi", 409, "CANCELLED");
  }
  if (input.propertyId !== undefined) await assertPropertyInWorkspace(db, workspaceId, input.propertyId);

  const originalAmount = input.originalAmount ?? existing.originalAmount;
  if (originalAmount < existing.paidAmount) {
    throw new ManualDebtError(AMOUNT_BELOW_PAID_MESSAGE, 409, "AMOUNT_BELOW_PAID");
  }
  const { remainingAmount, status } = deriveManualDebtState(originalAmount, existing.paidAmount);
  const telegramChatId =
    input.debtorPhone !== undefined
      ? await resolveWorkspaceTelegramChat(db, workspaceId, input.debtorPhone)
      : undefined;

  const updated = await db.manualDebt.updateMany({
    where: { id, workspaceId, paidAmount: existing.paidAmount, status: existing.status },
    data: {
      propertyId: input.propertyId,
      debtorName: input.debtorName,
      debtorPhone: input.debtorPhone,
      debtorOccupation: input.debtorOccupation,
      description: input.description,
      debtDate: input.debtDate ? toStoredDate(input.debtDate) : undefined,
      originalAmount,
      remainingAmount,
      status,
      closedAt: status === "PAID" ? (existing.closedAt ?? new Date()) : null,
      telegramChatId,
    },
  });
  if (updated.count === 0) throw CONFLICT();
  return getManualDebt(db, workspaceId, id);
}

/** Qisman/to'liq to'lov. Ortiqcha to'lov rad etiladi; to'lov alohida jadvalda (Payment emas). */
export async function addManualDebtPayment(
  db: Db,
  workspaceId: string,
  id: string,
  userId: string,
  input: ManualDebtPaymentInput,
  now: Date = new Date()
) {
  const existing = await findOwned(db, workspaceId, id);
  if (existing.status !== "OPEN" && existing.status !== "PARTIAL") {
    throw new ManualDebtError("Bu qarz yopilgan — to‘lov qo‘shib bo‘lmaydi", 409, "DEBT_CLOSED");
  }
  if (input.amount > existing.remainingAmount + 0.001) {
    throw new ManualDebtError("To‘lov summasi qolgan qarzdan oshmasligi kerak", 400, "OVERPAYMENT");
  }
  const paidAmount = roundMoney(existing.paidAmount + input.amount);
  const { remainingAmount, status } = deriveManualDebtState(existing.originalAmount, paidAmount);

  const updated = await db.manualDebt.updateMany({
    where: { id, workspaceId, paidAmount: existing.paidAmount, status: existing.status },
    data: { paidAmount, remainingAmount, status, closedAt: status === "PAID" ? now : null },
  });
  if (updated.count === 0) throw CONFLICT();

  await db.manualDebtPayment.create({
    data: {
      manualDebtId: id,
      workspaceId,
      amount: input.amount,
      paymentDate: toStoredDate(input.paymentDate),
      notes: input.notes,
      createdById: userId,
    },
  });
  return getManualDebt(db, workspaceId, id);
}

/** Bekor qilish — o'chirmaydi; kim, qachon, nima uchun saqlanadi. */
export async function cancelManualDebt(
  db: Db,
  workspaceId: string,
  id: string,
  userId: string,
  reason: string | null,
  now: Date = new Date()
) {
  const existing = await findOwned(db, workspaceId, id);
  if (existing.status === "CANCELLED") {
    throw new ManualDebtError("Qarz allaqachon bekor qilingan", 409, "ALREADY_CANCELLED");
  }
  if (existing.status === "PAID") {
    throw new ManualDebtError("To‘langan qarzni bekor qilib bo‘lmaydi", 409, "DEBT_PAID");
  }
  const updated = await db.manualDebt.updateMany({
    where: { id, workspaceId, status: existing.status },
    data: {
      status: "CANCELLED",
      cancelledAt: now,
      cancelledById: userId,
      cancelReason: reason?.trim() || "Admin tomonidan bekor qilindi",
    },
  });
  if (updated.count === 0) throw CONFLICT();
  return getManualDebt(db, workspaceId, id);
}

export type ManualDebtReminderTarget = ManualDebtReminder & { chatId: string | null };

/**
 * Eslatma uchun faol qo'lda qarzlar (OPEN/PARTIAL, qoldiq > 0, sanasi kelgan).
 * Chat: saqlangan yoki telefon bo'yicha SHU workspace ijarachisidan.
 */
export async function computeManualDebtReminders(
  scope: { workspaceId?: string; now?: Date } = {}
): Promise<ManualDebtReminderTarget[]> {
  const now = scope.now ?? new Date();
  const rows = await prisma.manualDebt.findMany({
    where: {
      status: { in: ["OPEN", "PARTIAL"] },
      remainingAmount: { gt: 0 },
      debtDate: { lte: now },
      ...(scope.workspaceId ? { workspaceId: scope.workspaceId } : {}),
    },
    include: DEBT_INCLUDE,
    orderBy: { debtDate: "asc" },
  });

  const needLookup = rows.filter((r) => !r.telegramChatId && phoneKey(r.debtorPhone).length === 9);
  const chatByWorkspacePhone = new Map<string, string>();
  if (needLookup.length > 0) {
    const tenants = await prisma.tenant.findMany({
      where: {
        workspaceId: { in: [...new Set(needLookup.map((r) => r.workspaceId))] },
        telegramChatId: { not: null },
      },
      select: { workspaceId: true, phone: true, telegramChatId: true },
    });
    for (const t of tenants) {
      if (t.workspaceId && t.telegramChatId) {
        chatByWorkspacePhone.set(`${t.workspaceId}:${phoneKey(t.phone)}`, t.telegramChatId);
      }
    }
  }

  return rows.map((r) => ({
    manualDebtId: r.id,
    workspaceId: r.workspaceId,
    debtorName: r.debtorName,
    propertyName: r.property?.title ?? null,
    debtorOccupation: r.debtorOccupation,
    debtDate: fromStoredDate(r.debtDate),
    remainingAmount: r.remainingAmount,
    chatId:
      r.telegramChatId ?? chatByWorkspacePhone.get(`${r.workspaceId}:${phoneKey(r.debtorPhone)}`) ?? null,
  }));
}
