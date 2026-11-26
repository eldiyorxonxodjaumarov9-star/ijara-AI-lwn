import type { RobotRentApplicationStatus, RobotRentApplicationType } from "@prisma/client";

export const ROBOTRENT_BRAND = "RobotRent Global";

export const ROBOTRENT_STATUS_ORDER: RobotRentApplicationStatus[] = [
  "RECEIVED",
  "SITE_INSPECTION",
  "TRIAL_OFFER",
  "MONTHLY_RENTAL",
];

export const ROBOTRENT_STATUS_LABELS: Record<RobotRentApplicationStatus, string> = {
  RECEIVED: "Ariza qabul qilindi",
  SITE_INSPECTION: "Obyektni tekshirish",
  TRIAL_OFFER: "Sinov taklifi",
  MONTHLY_RENTAL: "Oylik ijara",
  REJECTED: "Rad etildi",
};

export const ROBOTRENT_TYPE_LABELS: Record<RobotRentApplicationType, string> = {
  CUSTOMER: "Mijoz",
  DISTRIBUTOR: "Distribyutor",
  MANUFACTURER: "Ishlab chiqaruvchi",
};

export const ROBOTRENT_TRIAL_DAYS_DEFAULT = 14;

export const EMPTY_VALUE_LABEL = "Ma’lumot kiritilmagan";