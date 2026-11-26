import type {
  Prisma,
  RobotRentApplicationStatus,
  RobotRentApplicationType,
} from "@prisma/client";

import { prisma } from "@/lib/api-server/prisma";
import { generateRobotRentTrackingCode, normalizeTrackingCode } from "@/lib/api-server/robotrent/tracking";
import type {
  CustomerApplicationInput,
  DistributorApplicationInput,
  ManufacturerApplicationInput,
} from "@/lib/api-server/robotrent/validation";

const DUPLICATE_WINDOW_MS = 120_000;

type CreateInput = {
  type: RobotRentApplicationType;
  data:
    | CustomerApplicationInput
    | DistributorApplicationInput
    | ManufacturerApplicationInput;
  submitIpHash: string | null;
};

function phoneFromData(
  data:
    | CustomerApplicationInput
    | DistributorApplicationInput
    | ManufacturerApplicationInput
) {
  if ("phone" in data) return data.phone;
  return null;
}

export async function createRobotRentApplication(input: CreateInput) {
  const phone = phoneFromData(input.data);
  const since = new Date(Date.now() - DUPLICATE_WINDOW_MS);

  if (phone) {
    const recent = await prisma.robotRentApplication.findFirst({
      where: {
        type: input.type,
        phone,
        createdAt: { gte: since },
      },
      select: { trackingCode: true },
    });
    if (recent) {
      return { trackingCode: recent.trackingCode, duplicate: true as const };
    }
  }

  const trackingCode = generateRobotRentTrackingCode();
  const base: Prisma.RobotRentApplicationCreateInput = {
    trackingCode,
    type: input.type,
    status: "RECEIVED",
    submitIpHash: input.submitIpHash,
    statusEvents: {
      create: {
        status: "RECEIVED",
        note: "Ariza tizim orqali qabul qilindi",
      },
    },
  };

  if (input.type === "CUSTOMER") {
    const d = input.data as CustomerApplicationInput;
    Object.assign(base, {
      companyName: d.companyName,
      city: d.city,
      phone: d.phone,
      objectType: d.objectType ?? undefined,
      areaSqm: d.areaSqm ?? undefined,
      startDate: d.startDate ? new Date(d.startDate) : undefined,
    });
  } else if (input.type === "DISTRIBUTOR") {
    const d = input.data as DistributorApplicationInput;
    Object.assign(base, {
      companyName: d.companyName,
      robotModel: d.robotModel,
      phone: d.phone,
      serviceCity: d.serviceCity ?? undefined,
      hasDemoRobot: d.hasDemoRobot ?? false,
      serviceCapability: d.serviceCapability ?? undefined,
    });
  } else {
    const d = input.data as ManufacturerApplicationInput;
    Object.assign(base, {
      companyName: d.companyName,
      country: d.country,
      email: d.email,
      robotModel: d.robotModel ?? undefined,
      techDocumentNote: d.techDocumentNote ?? undefined,
      monthlyRentalTerms: d.monthlyRentalTerms ?? undefined,
    });
  }

  const created = await prisma.robotRentApplication.create({
    data: base,
    select: { trackingCode: true },
  });

  return { trackingCode: created.trackingCode, duplicate: false as const };
}

export async function getRobotRentByTrackingCode(trackingCodeRaw: string) {
  const trackingCode = normalizeTrackingCode(trackingCodeRaw);
  return prisma.robotRentApplication.findUnique({
    where: { trackingCode },
    include: {
      statusEvents: { orderBy: { createdAt: "asc" } },
      trial: { include: { robotModel: true } },
      rentalOffers: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
}

export async function listRobotRentApplications(opts: {
  q?: string;
  type?: RobotRentApplicationType;
  status?: RobotRentApplicationStatus;
  take?: number;
}) {
  const take = Math.min(opts.take ?? 50, 100);
  const q = opts.q?.trim();

  return prisma.robotRentApplication.findMany({
    where: {
      ...(opts.type ? { type: opts.type } : {}),
      ...(opts.status ? { status: opts.status } : {}),
      ...(q
        ? {
            OR: [
              { trackingCode: { contains: q, mode: "insensitive" } },
              { companyName: { contains: q, mode: "insensitive" } },
              { phone: { contains: q, mode: "insensitive" } },
              { email: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take,
    include: {
      statusEvents: { orderBy: { createdAt: "asc" } },
      trial: { include: { robotModel: true } },
      rentalOffers: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
}

export type AdminStatusUpdate = {
  applicationId: string;
  status: RobotRentApplicationStatus;
  note?: string;
  actorUserId: string;
  trial?: {
    robotModelId?: string | null;
    trialZone?: string | null;
    startDate?: string | null;
    trialDays?: number | null;
    dailyRate?: number | null;
    dailyCleanedAreaSqm?: number | null;
    costNotes?: string | null;
    reportSummary?: string | null;
  };
  rentalOffer?: {
    monthlyAmount?: number | null;
    terms?: string | null;
    validUntil?: string | null;
  };
};

export async function adminUpdateRobotRentApplication(input: AdminStatusUpdate) {
  const existing = await prisma.robotRentApplication.findUnique({
    where: { id: input.applicationId },
    select: { id: true, status: true },
  });
  if (!existing) {
    throw Object.assign(new Error("Ariza topilmadi"), { status: 404 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.robotRentApplication.update({
      where: { id: input.applicationId },
      data: { status: input.status },
    });

    await tx.robotRentStatusEvent.create({
      data: {
        applicationId: input.applicationId,
        status: input.status,
        note: input.note?.trim() || null,
        actorUserId: input.actorUserId,
      },
    });

    if (input.trial) {
      const t = input.trial;
      await tx.robotRentTrial.upsert({
        where: { applicationId: input.applicationId },
        create: {
          applicationId: input.applicationId,
          robotModelId: t.robotModelId ?? undefined,
          trialZone: t.trialZone ?? undefined,
          startDate: t.startDate ? new Date(t.startDate) : undefined,
          trialDays: t.trialDays ?? undefined,
          dailyRate: t.dailyRate ?? undefined,
          dailyCleanedAreaSqm: t.dailyCleanedAreaSqm ?? undefined,
          costNotes: t.costNotes ?? undefined,
          reportSummary: t.reportSummary ?? undefined,
        },
        update: {
          robotModelId: t.robotModelId ?? undefined,
          trialZone: t.trialZone ?? undefined,
          startDate: t.startDate ? new Date(t.startDate) : undefined,
          trialDays: t.trialDays ?? undefined,
          dailyRate: t.dailyRate ?? undefined,
          dailyCleanedAreaSqm: t.dailyCleanedAreaSqm ?? undefined,
          costNotes: t.costNotes ?? undefined,
          reportSummary: t.reportSummary ?? undefined,
        },
      });
    }

    if (input.rentalOffer) {
      const r = input.rentalOffer;
      await tx.robotRentRentalOffer.create({
        data: {
          applicationId: input.applicationId,
          monthlyAmount: r.monthlyAmount ?? undefined,
          terms: r.terms ?? undefined,
          validUntil: r.validUntil ? new Date(r.validUntil) : undefined,
        },
      });
    }
  });

  await prisma.auditLog.create({
    data: {
      userId: input.actorUserId,
      action: "ROBOTRENT_STATUS_UPDATE",
      entity: "robotrent_application",
      entityId: input.applicationId,
      meta: { status: input.status, note: input.note ?? null },
    },
  });

  return getRobotRentApplicationById(input.applicationId);
}

export async function getRobotRentApplicationById(id: string) {
  return prisma.robotRentApplication.findUnique({
    where: { id },
    include: {
      statusEvents: { orderBy: { createdAt: "asc" } },
      trial: { include: { robotModel: true } },
      rentalOffers: { orderBy: { createdAt: "desc" } },
    },
  });
}

export async function listRobotRentRobotModels(publicOnly: boolean) {
  return prisma.robotRentRobotModel.findMany({
    where: publicOnly ? { active: true } : undefined,
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
}