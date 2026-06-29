"use client";

import type {
  ListingPostInput,
  ListingWithJobs,
  PostingJobView,
  PostingLogView,
  PostingPlatform,
} from "@/lib/posting/types";
import { tokenStore } from "@/lib/api/client";

const JOBS_KEY = "arenda:posting-jobs";
const LOGS_KEY = "arenda:posting-logs";

type StoredJobs = Record<string, PostingJobView[]>;
type StoredLogs = Record<string, PostingLogView[]>;

function readJobs(): StoredJobs {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(JOBS_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as StoredJobs;
  } catch {
    return {};
  }
}

function writeJobs(data: StoredJobs) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(JOBS_KEY, JSON.stringify(data));
}

function readLogs(): StoredLogs {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(LOGS_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as StoredLogs;
  } catch {
    return {};
  }
}

function appendLocalLog(listingId: string, log: PostingLogView) {
  const all = readLogs();
  all[listingId] = [log, ...(all[listingId] ?? [])].slice(0, 100);
  if (typeof window !== "undefined") {
    window.localStorage.setItem(LOGS_KEY, JSON.stringify(all));
  }
}

export function saveLocalPostingJobs(legacyLocalId: string, jobs: PostingJobView[]) {
  const all = readJobs();
  all[legacyLocalId] = jobs;
  writeJobs(all);
}

export function getLocalPostingJobs(legacyLocalId: string): PostingJobView[] | undefined {
  return readJobs()[legacyLocalId];
}

export function updateLocalPostingJob(legacyLocalId: string, job: PostingJobView) {
  const all = readJobs();
  const jobs = all[legacyLocalId] ?? [];
  const idx = jobs.findIndex((j) => j.platform === job.platform);
  if (idx >= 0) jobs[idx] = job;
  else jobs.push(job);
  all[legacyLocalId] = jobs;
  writeJobs(all);
}

export function getLocalPostingLogs(listingId: string): PostingLogView[] {
  return readLogs()[listingId] ?? [];
}

function authHeaders(): Record<string, string> {
  const token = tokenStore.access;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function parseResponse<T>(res: Response): Promise<T> {
  const json = await res.json();
  if (!res.ok) throw new Error(json?.message ?? "So'rov xatosi");
  return (json?.data ?? json) as T;
}

export async function publishListingToPlatforms(
  input: ListingPostInput & { legacyLocalId: string }
): Promise<ListingWithJobs> {
  const res = await fetch("/api/listings/publish", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(input),
  });
  const result = await parseResponse<ListingWithJobs>(res);
  saveLocalPostingJobs(input.legacyLocalId, result.jobs);
  return result;
}

export async function retryPostingJobClient(
  jobId: string,
  opts?: {
    platform?: PostingPlatform;
    listing?: ListingPostInput;
    legacyLocalId?: string;
  }
): Promise<PostingJobView> {
  const res = await fetch(`/api/posting/jobs/${jobId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ action: "retry", ...opts }),
  });
  const job = await parseResponse<PostingJobView>(res);
  if (opts?.legacyLocalId) updateLocalPostingJob(opts.legacyLocalId, job);
  return job;
}

export async function retryAllPostingClient(
  listingId: string,
  listing: ListingPostInput
): Promise<PostingJobView[]> {
  const res = await fetch(`/api/posting/listings/${listingId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ listing }),
  });
  const jobs = await parseResponse<PostingJobView[]>(res);
  saveLocalPostingJobs(listingId, jobs);
  return jobs;
}

export async function markJobPostedClient(
  jobId: string,
  opts: { platform: PostingPlatform; legacyLocalId: string }
): Promise<PostingJobView> {
  const res = await fetch(`/api/posting/jobs/${jobId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ action: "mark-posted", ...opts }),
  });
  const job = await parseResponse<PostingJobView>(res);
  updateLocalPostingJob(opts.legacyLocalId, job);
  appendLocalLog(opts.legacyLocalId, {
    id: crypto.randomUUID(),
    platform: opts.platform,
    level: "info",
    action: "mark_posted",
    message: `${opts.platform} — qo'lda joylandi deb belgilandi`,
    createdAt: new Date().toISOString(),
  });
  return job;
}

export type PublicChannel = {
  platform: PostingJobView["platform"];
  enabled: boolean;
  settings: Record<string, string>;
  hasBotToken: boolean;
  hasChannelId: boolean;
};

export async function fetchPostingChannels(): Promise<PublicChannel[]> {
  const res = await fetch("/api/posting/channels", { cache: "no-store" });
  return parseResponse<PublicChannel[]>(res);
}

export async function updatePostingChannelClient(
  platform: PostingJobView["platform"],
  data: {
    enabled?: boolean;
    settings?: Record<string, string>;
    secrets?: Record<string, string>;
  }
) {
  const res = await fetch("/api/posting/channels", {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ platform, ...data }),
  });
  return parseResponse<PublicChannel>(res);
}

export async function fetchPostingLogsByJob(jobId: string): Promise<PostingLogView[]> {
  const res = await fetch(`/api/posting/jobs/${jobId}`, { cache: "no-store" });
  return parseResponse<PostingLogView[]>(res);
}

export async function fetchPostingLogsByListing(
  listingId: string
): Promise<PostingLogView[]> {
  try {
    const res = await fetch(`/api/posting/listings/${listingId}`, { cache: "no-store" });
    const logs = await parseResponse<PostingLogView[]>(res);
    if (logs.length) return logs;
  } catch {
    /* fallback local */
  }
  return getLocalPostingLogs(listingId);
}

export async function fetchListingsWithJobs(
  email: string
): Promise<ListingWithJobs[]> {
  try {
    const res = await fetch(
      `/api/listings?landlordEmail=${encodeURIComponent(email)}`,
      { cache: "no-store" }
    );
    return parseResponse<ListingWithJobs[]>(res);
  } catch {
    return [];
  }
}
