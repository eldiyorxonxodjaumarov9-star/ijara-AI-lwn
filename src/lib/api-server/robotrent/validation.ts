import type { RobotRentApplicationType } from "@prisma/client";

import { isLeadHoneypotTriggered } from "@/lib/api-server/clients/public-lead";

export type CustomerApplicationInput = {
  companyName: string;
  city: string;
  objectType: string;
  areaSqm: number;
  phone: string;
  startDate: string;
};

export type DistributorApplicationInput = {
  companyName: string;
  serviceCity: string;
  robotModel: string;
  hasDemoRobot: boolean;
  serviceCapability: string;
  phone: string;
};

export type ManufacturerApplicationInput = {
  companyName: string;
  country: string;
  robotModel: string;
  techDocumentNote: string;
  monthlyRentalTerms: string;
  email: string;
};

function normalizePhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 9 || digits.length > 15) return null;
  return phone.trim();
}

function parseDate(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function parseArea(value: unknown) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0 || n > 1_000_000) return null;
  return n;
}

function requireString(value: unknown, min = 2, max = 200) {
  const s = String(value ?? "").trim();
  if (s.length < min || s.length > max) return null;
  return s;
}

export function parseRobotRentApplicationBody(body: Record<string, unknown>):
  | {
      ok: true;
      type: RobotRentApplicationType;
      data:
        | CustomerApplicationInput
        | DistributorApplicationInput
        | ManufacturerApplicationInput;
    }
  | { ok: false } {
  if (isLeadHoneypotTriggered(body)) return { ok: false };

  const type = String(body.type ?? "").toUpperCase();
  if (type === "CUSTOMER") {
    const companyName = requireString(body.companyName);
    const city = requireString(body.city);
    const objectType = requireString(body.objectType);
    const areaSqm = parseArea(body.areaSqm);
    const phone = normalizePhone(String(body.phone ?? ""));
    const startDate = requireString(body.startDate, 8, 32);
    const parsedStart = startDate ? parseDate(startDate) : null;
    if (!companyName || !city || !objectType || !areaSqm || !phone || !startDate || !parsedStart) {
      return { ok: false };
    }
    return {
      ok: true,
      type: "CUSTOMER",
      data: { companyName, city, objectType, areaSqm, phone, startDate },
    };
  }

  if (type === "DISTRIBUTOR") {
    const companyName = requireString(body.companyName);
    const serviceCity = requireString(body.serviceCity);
    const robotModel = requireString(body.robotModel);
    const serviceCapability = requireString(body.serviceCapability);
    const phone = normalizePhone(String(body.phone ?? ""));
    const hasDemoRobot = Boolean(body.hasDemoRobot);
    if (!companyName || !serviceCity || !robotModel || !serviceCapability || !phone) {
      return { ok: false };
    }
    return {
      ok: true,
      type: "DISTRIBUTOR",
      data: {
        companyName,
        serviceCity,
        robotModel,
        hasDemoRobot,
        serviceCapability,
        phone,
      },
    };
  }

  if (type === "MANUFACTURER") {
    const companyName = requireString(body.companyName);
    const country = requireString(body.country);
    const robotModel = requireString(body.robotModel);
    const techDocumentNote = requireString(body.techDocumentNote, 2, 500);
    const monthlyRentalTerms = requireString(body.monthlyRentalTerms, 2, 500);
    const email = requireString(body.email, 5, 120);
    if (!companyName || !country || !robotModel || !techDocumentNote || !monthlyRentalTerms || !email) {
      return { ok: false };
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false };
    return {
      ok: true,
      type: "MANUFACTURER",
      data: {
        companyName,
        country,
        robotModel,
        techDocumentNote,
        monthlyRentalTerms,
        email,
      },
    };
  }

  return { ok: false };
}