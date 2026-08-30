"use client";

import { apiFetch, isApiConfigured } from "@/lib/api/client";
import type {
  SmsLinkedTenant,
  SmsNotificationSettings,
} from "@/types/sms-notifications";

export type SmsLinksListResponse = {
  data: SmsLinkedTenant[];
  meta: { total: number };
};

export type SmsLinksAssignResponse = {
  created: SmsLinkedTenant[];
  skippedCount: number;
  data: SmsLinkedTenant[];
};

export type SmsLinkAssignInput = {
  tenantId: string;
  contractId?: string | null;
  propertyId?: string | null;
  propertyLabel?: string;
  smsEnabled?: boolean;
  settings?: SmsNotificationSettings;
};

function unwrapList(payload: unknown): SmsLinkedTenant[] {
  if (!payload || typeof payload !== "object") return [];
  const root = payload as {
    data?: unknown;
    meta?: { total?: number };
  };
  if (Array.isArray(root.data)) {
    return root.data as SmsLinkedTenant[];
  }
  if (
    root.data &&
    typeof root.data === "object" &&
    Array.isArray((root.data as { data?: unknown }).data)
  ) {
    return (root.data as { data: SmsLinkedTenant[] }).data;
  }
  return [];
}

export async function fetchSmsLinks(): Promise<SmsLinkedTenant[]> {
  if (!isApiConfigured) {
    throw new Error("API sozlanmagan — biriktirishlar serverda saqlanadi");
  }
  const res = await apiFetch<SmsLinksListResponse | SmsLinkedTenant[]>(
    "/sms-links",
    { method: "GET" }
  );
  if (Array.isArray(res)) return res;
  return unwrapList(res);
}

export async function assignSmsLinks(
  items: SmsLinkAssignInput[]
): Promise<SmsLinksAssignResponse> {
  if (!isApiConfigured) {
    throw new Error("API sozlanmagan — biriktirishlar serverda saqlanadi");
  }
  const res = await apiFetch<SmsLinksAssignResponse>("/sms-links", {
    method: "POST",
    body: { items },
  });
  return {
    created: res.created ?? [],
    skippedCount: res.skippedCount ?? 0,
    data: Array.isArray(res.data) ? res.data : unwrapList(res),
  };
}

export async function updateSmsLink(
  id: string,
  patch: {
    smsEnabled?: boolean;
    settings?: Partial<SmsNotificationSettings>;
  }
): Promise<SmsLinkedTenant> {
  if (!isApiConfigured) {
    throw new Error("API sozlanmagan");
  }
  return apiFetch<SmsLinkedTenant>(`/sms-links/${id}`, {
    method: "PATCH",
    body: patch,
  });
}

export async function deleteSmsLink(id: string): Promise<SmsLinkedTenant[]> {
  if (!isApiConfigured) {
    throw new Error("API sozlanmagan");
  }
  const res = await apiFetch<{ id: string; data: SmsLinkedTenant[] }>(
    `/sms-links/${id}`,
    { method: "DELETE" }
  );
  return Array.isArray(res.data) ? res.data : [];
}
