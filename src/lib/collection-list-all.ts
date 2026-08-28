import { apiFetch, isApiConfigured } from "@/lib/api/client";
import { MAPPERS } from "@/lib/api/mappers";
import type { CollectionName } from "@/lib/data/store";
import type { CollectionEntity } from "@/types";

export interface PaginatedApiPayload {
  data?: unknown[];
  meta?: {
    total?: number;
    page?: number;
    limit?: number;
    totalPages?: number;
    hasNextPage?: boolean;
  };
}

function parsePaginatedResponse(res: PaginatedApiPayload | unknown[]): {
  batch: Record<string, unknown>[];
  totalPages: number;
} {
  if (Array.isArray(res)) {
    return {
      batch: res as Record<string, unknown>[],
      totalPages: 1,
    };
  }
  const batch = (res as PaginatedApiPayload).data ?? [];
  const meta = (res as PaginatedApiPayload).meta;
  const totalPages =
    meta?.totalPages ??
    (meta?.total != null && meta?.limit
      ? Math.max(1, Math.ceil(meta.total / meta.limit))
      : 1);
  return { batch: batch as Record<string, unknown>[], totalPages };
}

/**
 * API rejimida barcha sahifalarni yuklaydi.
 * Bir xil endpoint va mapper — useCollection / Arendatorlar sahifasi bilan.
 */
export async function fetchCollectionAllPages(
  name: CollectionName
): Promise<CollectionEntity[]> {
  if (!isApiConfigured) {
    throw new Error("API sozlanmagan");
  }
  const mapper = MAPPERS[name];
  if (!mapper) {
    throw new Error(`Mapper topilmadi: ${name}`);
  }

  const limit = 100;
  let page = 1;
  let totalPages = 1;
  const rawItems: Record<string, unknown>[] = [];
  const seenIds = new Set<string>();

  while (page <= totalPages) {
    const res = await apiFetch<PaginatedApiPayload | unknown[]>(
      `${mapper.path}?page=${page}&limit=${limit}&sortBy=createdAt&order=desc`
    );
    const { batch, totalPages: tp } = parsePaginatedResponse(res);
    totalPages = tp;

    for (const item of batch) {
      const id = String(item.id ?? "");
      if (id && seenIds.has(id)) continue;
      if (id) seenIds.add(id);
      rawItems.push(item);
    }

    page += 1;
    if (batch.length === 0) break;
  }

  return rawItems.map((item) => mapper.fromApi(item) as CollectionEntity);
}
