import { tokenStore } from "@/lib/api/client";
import type {
  DistributeOptions,
  TelegramChannelInput,
  TelegramChannelView,
  TelegramPostingJobView,
  TelegramPostingLogView,
} from "@/lib/telegram-distribution/types";

function authHeaders(): Record<string, string> {
  const token = tokenStore.access;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function tdFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/telegram-distribution${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
      ...init?.headers,
    },
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json?.message ?? "So'rov xatosi");
  }
  return (json?.data ?? json) as T;
}

export async function fetchTelegramChannels() {
  return tdFetch<TelegramChannelView[]>("/channels");
}

export async function createTelegramChannelApi(input: TelegramChannelInput) {
  return tdFetch<TelegramChannelView>("/channels", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function updateTelegramChannelApi(
  id: string,
  input: Partial<TelegramChannelInput>
) {
  return tdFetch<TelegramChannelView>(`/channels/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export async function deleteTelegramChannelApi(id: string) {
  return tdFetch<{ ok: boolean }>(`/channels/${id}`, { method: "DELETE" });
}

export async function testTelegramChannelApi(id: string) {
  return tdFetch<{ messageId: string }>(`/channels/${id}/test`, {
    method: "POST",
  });
}

export async function checkTelegramChannelAdminApi(id: string) {
  return tdFetch<{
    isAdmin: boolean;
    status: string;
    botUsername?: string;
    channel: TelegramChannelView;
  }>(`/channels/${id}/check-admin`, { method: "POST" });
}

export async function fetchListingTelegramJobs(listingId: string) {
  return tdFetch<{
    jobs: TelegramPostingJobView[];
    logs: TelegramPostingLogView[];
  }>(`/listings/${listingId}`);
}

export async function distributeListingTelegramApi(
  listingId: string,
  options?: DistributeOptions
) {
  return tdFetch<TelegramPostingJobView[]>(`/listings/${listingId}/distribute`, {
    method: "POST",
    body: JSON.stringify(options ?? {}),
  });
}

export async function bulkRepostTelegramApi(listingId: string) {
  return tdFetch<TelegramPostingJobView[]>(`/listings/${listingId}/repost`, {
    method: "POST",
  });
}

export async function retryTelegramJobApi(jobId: string) {
  return tdFetch<TelegramPostingJobView>(`/jobs/${jobId}/retry`, {
    method: "POST",
  });
}

export async function processTelegramQueueApi() {
  return tdFetch<{ processed: number }>("/queue/process", { method: "POST" });
}
