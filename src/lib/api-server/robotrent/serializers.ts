import type { Prisma } from "@prisma/client";

import { ROBOTRENT_STATUS_LABELS, ROBOTRENT_TYPE_LABELS } from "@/lib/robotrent/constants";

type AppWithRelations = Prisma.RobotRentApplicationGetPayload<{
  include: {
    statusEvents: true;
    trial: { include: { robotModel: true } };
    rentalOffers: true;
  };
}>;

export function serializePublicTracking(app: AppWithRelations) {
  return {
    trackingCode: app.trackingCode,
    type: app.type,
    typeLabel: ROBOTRENT_TYPE_LABELS[app.type],
    status: app.status,
    statusLabel: ROBOTRENT_STATUS_LABELS[app.status],
    companyName: app.companyName,
    createdAt: app.createdAt.toISOString(),
    timeline: app.statusEvents.map((e) => ({
      status: e.status,
      label: ROBOTRENT_STATUS_LABELS[e.status],
      at: e.createdAt.toISOString(),
      note: e.note,
    })),
    trial: app.trial
      ? {
          robotName: app.trial.robotModel?.name ?? null,
          trialZone: app.trial.trialZone,
          startDate: app.trial.startDate?.toISOString() ?? null,
          trialDays: app.trial.trialDays,
          dailyRate: app.trial.dailyRate?.toString() ?? null,
          dailyCleanedAreaSqm: app.trial.dailyCleanedAreaSqm?.toString() ?? null,
          costNotes: app.trial.costNotes,
          reportSummary: app.trial.reportSummary,
        }
      : null,
    rentalOffer: app.rentalOffers[0]
      ? {
          monthlyAmount: app.rentalOffers[0].monthlyAmount?.toString() ?? null,
          currency: app.rentalOffers[0].currency,
          terms: app.rentalOffers[0].terms,
          validUntil: app.rentalOffers[0].validUntil?.toISOString() ?? null,
        }
      : null,
  };
}

export function serializeAdminApplication(app: AppWithRelations) {
  return {
    ...serializePublicTracking(app),
    id: app.id,
    phone: app.phone,
    email: app.email,
    city: app.city,
    objectType: app.objectType,
    areaSqm: app.areaSqm?.toString() ?? null,
    serviceCity: app.serviceCity,
    robotModel: app.robotModel,
    hasDemoRobot: app.hasDemoRobot,
    serviceCapability: app.serviceCapability,
    country: app.country,
    techDocumentNote: app.techDocumentNote,
    monthlyRentalTerms: app.monthlyRentalTerms,
    startDate: app.startDate?.toISOString() ?? null,
  };
}