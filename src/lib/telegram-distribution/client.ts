import { apiFetch } from "@/lib/api/client";
import type {
  DistributeOptions,
  TelegramChannelInput,
  TelegramChannelView,
  TelegramPostingJobView,
  TelegramPostingLogView,
} from "@/lib/telegram-distribution/types";

export async function fetchTelegramChannels() {
  return apiFetch<TelegramChannelView[]>("/telegram-distribution/channels");
}

export async function createTelegramChannelApi(input: TelegramChannelInput) {
  return apiFetch<TelegramChannelView>("/telegram-distribution/channels", {
    method: "POST",
    body: input,
  });
}

export async function updateTelegramChannelApi(
  id: string,
  input: Partial<TelegramChannelInput>
) {
  return apiFetch<TelegramChannelView>(`/telegram-distribution/channels/${id}`, {
    method: "PATCH",
    body: input,
  });
}

export async function deleteTelegramChannelApi(id: string) {
  return apiFetch<{ ok: boolean }>(`/telegram-distribution/channels/${id}`, {
    method: "DELETE",
  });
}

export async function testTelegramChannelApi(id: string) {
  return apiFetch<{ messageId: string }>(
    `/telegram-distribution/channels/${id}/test`,
    { method: "POST" }
  );
}

export async function checkTelegramChannelAdminApi(id: string) {
  return apiFetch<{
    isAdmin: boolean;
    status: string;
    botUsername?: string;
    channel: TelegramChannelView;
  }>(`/telegram-distribution/channels/${id}/check-admin`, { method: "POST" });
}

export async function fetchListingTelegramJobs(listingId: string) {
  return apiFetch<{
    jobs: TelegramPostingJobView[];
    logs: TelegramPostingLogView[];
  }>(`/telegram-distribution/listings/${listingId}`);
}

export async function distributeListingTelegramApi(
  listingId: string,
  options?: DistributeOptions
) {
  return apiFetch<TelegramPostingJobView[]>(
    `/telegram-distribution/listings/${listingId}/distribute`,
    { method: "POST", body: options ?? {} }
  );
}

export async function bulkRepostTelegramApi(listingId: string) {
  return apiFetch<TelegramPostingJobView[]>(
    `/telegram-distribution/listings/${listingId}/repost`,
    { method: "POST" }
  );
}

export async function retryTelegramJobApi(jobId: string) {
  return apiFetch<TelegramPostingJobView>(
    `/telegram-distribution/jobs/${jobId}/retry`,
    { method: "POST" }
  );
}

export async function processTelegramQueueApi() {
  return apiFetch<{ processed: number }>("/telegram-distribution/queue/process", {
    method: "POST",
  });
}
