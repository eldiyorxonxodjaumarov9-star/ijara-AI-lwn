import { z } from "zod";

export const AI_AGENT_SCRIPT_CATEGORIES = [
  "GREETING",
  "PRICE_INFO",
  "CONTRACT",
  "VIEWING",
  "PAYMENT",
  "PARKING",
  "INTERNET",
  "GENERAL",
] as const;

export const AI_AGENT_MEDIA_CATEGORIES = [
  "ROOM",
  "OFFICE",
  "BUILDING",
  "ENTRANCE",
  "PARKING",
  "LOCATION",
  "OTHER",
] as const;

export type AiAgentScriptCategory = (typeof AI_AGENT_SCRIPT_CATEGORIES)[number];
export type AiAgentMediaCategory = (typeof AI_AGENT_MEDIA_CATEGORIES)[number];

export const aiAgentScriptSchema = z.object({
  title: z.string().trim().min(1).max(200),
  category: z.enum(AI_AGENT_SCRIPT_CATEGORIES),
  content: z.string().trim().min(1).max(20000),
  active: z.boolean().optional().default(true),
});

export const aiAgentLocationSchema = z.object({
  title: z.string().trim().min(1).max(200),
  address: z.string().trim().min(1).max(500),
  landmark: z.string().trim().max(500).nullable().optional(),
  mapUrl: z.string().trim().max(2000).nullable().optional(),
  workingHours: z.string().trim().max(200).nullable().optional(),
  description: z.string().trim().max(4000).nullable().optional(),
  active: z.boolean().optional().default(true),
});

export const aiAgentContactSchema = z.object({
  name: z.string().trim().min(1).max(200),
  role: z.string().trim().max(200).nullable().optional(),
  phone: z.string().trim().max(32).nullable().optional(),
  telegramUsername: z.string().trim().max(128).nullable().optional(),
  note: z.string().trim().max(2000).nullable().optional(),
  active: z.boolean().optional().default(true),
});

export const aiAgentMediaSchema = z.object({
  title: z.string().trim().min(1).max(200),
  category: z.enum(AI_AGENT_MEDIA_CATEGORIES),
  roomId: z.string().trim().min(1).max(64).nullable().optional(),
  description: z.string().trim().max(4000).nullable().optional(),
  fileUrl: z.string().trim().url().max(2000),
  active: z.boolean().optional().default(true),
  sortOrder: z.number().int().min(0).max(999999).optional().default(0),
});

export type AiAgentScriptInput = z.infer<typeof aiAgentScriptSchema>;
export type AiAgentLocationInput = z.infer<typeof aiAgentLocationSchema>;
export type AiAgentContactInput = z.infer<typeof aiAgentContactSchema>;
export type AiAgentMediaInput = z.infer<typeof aiAgentMediaSchema>;

/** Normalize empty strings to null for optional string fields. */
export function emptyToNull(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function normalizeLocationInput(input: AiAgentLocationInput) {
  const mapUrl = emptyToNull(input.mapUrl ?? null);
  if (mapUrl && !/^https?:\/\//i.test(mapUrl)) {
    throw new Error("INVALID_MAP_URL");
  }
  return {
    title: input.title.trim(),
    address: input.address.trim(),
    landmark: emptyToNull(input.landmark ?? null),
    mapUrl,
    workingHours: emptyToNull(input.workingHours ?? null),
    description: emptyToNull(input.description ?? null),
    active: input.active ?? true,
  };
}

export function normalizeContactInput(input: AiAgentContactInput) {
  const username = emptyToNull(input.telegramUsername ?? null);
  return {
    name: input.name.trim(),
    role: emptyToNull(input.role ?? null),
    phone: emptyToNull(input.phone ?? null),
    telegramUsername: username ? username.replace(/^@/, "") : null,
    note: emptyToNull(input.note ?? null),
    active: input.active ?? true,
  };
}

export function normalizeMediaInput(input: AiAgentMediaInput) {
  return {
    title: input.title.trim(),
    category: input.category,
    roomId: emptyToNull(input.roomId ?? null),
    description: emptyToNull(input.description ?? null),
    fileUrl: input.fileUrl.trim(),
    active: input.active ?? true,
    sortOrder: input.sortOrder ?? 0,
  };
}

export function matchesSearch(
  haystack: Array<string | null | undefined>,
  query: string
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return haystack.some((v) => (v ?? "").toLowerCase().includes(q));
}
