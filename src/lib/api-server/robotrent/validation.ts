import type { RobotRentApplicationType } from "@prisma/client";

import { isLeadHoneypotTriggered } from "@/lib/api-server/clients/public-lead";
import type { FormProfile } from "@/lib/robotrent/form-fields";

export type CustomerApplicationInput = {
  companyName: string;
  city: string;
  phone: string;
};

export type DistributorApplicationInput = {
  companyName: string;
  robotModel: string;
  phone: string;
  hasDemoRobot?: boolean;
};

export type ManufacturerApplicationInput = {
  companyName: string;
  country: string;
  email: string;
};

function normalizePhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 9 || digits.length > 15) return null;
  return phone.trim();
}

function requireString(value: unknown, min = 2, max = 200) {
  const s = String(value ?? "").trim();
  if (s.length < min || s.length > max) return null;
  return s;
}

function parseFormProfile(body: Record<string, unknown>): FormProfile {
  const raw = String(body.formProfile ?? "desktop").toLowerCase();
  return raw === "mobile" ? "mobile" : "desktop";
}

export function parseRobotRentApplicationBody(body: Record<string, unknown>):
  | {
      ok: true;
      type: RobotRentApplicationType;
      formProfile: FormProfile;
      data:
        | CustomerApplicationInput
        | DistributorApplicationInput
        | ManufacturerApplicationInput;
    }
  | { ok: false } {
  if (isLeadHoneypotTriggered(body)) return { ok: false };

  const formProfile = parseFormProfile(body);
  const type = String(body.type ?? "").toUpperCase();

  if (type === "CUSTOMER") {
    const companyName = requireString(body.companyName);
    const city = requireString(body.city);
    const phone = normalizePhone(String(body.phone ?? ""));
    if (!companyName || !city || !phone) return { ok: false };

    return {
      ok: true,
      type: "CUSTOMER",
      formProfile,
      data: { companyName, city, phone },
    };
  }

  if (type === "DISTRIBUTOR") {
    const companyName = requireString(body.companyName);
    const robotModel = requireString(body.robotModel);
    const phone = normalizePhone(String(body.phone ?? ""));
    if (!companyName || !robotModel || !phone) return { ok: false };

    return {
      ok: true,
      type: "DISTRIBUTOR",
      formProfile,
      data: { companyName, robotModel, phone, hasDemoRobot: false },
    };
  }

  if (type === "MANUFACTURER") {
    const companyName = requireString(body.companyName);
    const country = requireString(body.country);
    const email = requireString(body.email, 5, 120);
    if (!companyName || !country || !email) return { ok: false };
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false };

    return {
      ok: true,
      type: "MANUFACTURER",
      formProfile,
      data: { companyName, country, email },
    };
  }

  return { ok: false };
}
