import type {
  PostingJobStatus,
  RentalListingStatus,
} from "@prisma/client";

import type {
  ListingPostInput,
  ListingWithJobs,
  ManualPostingPackage,
  PostingJobView,
  PostingLogView,
  PostingPlatform,
} from "@/lib/posting/types";
import { POSTING_PLATFORMS } from "@/lib/posting/types";
import { generatePostText } from "@/lib/posting/copy-generator";
import {
  runPlatformAdapter,
  type PostingChannelConfig,
} from "@/lib/api-server/posting/adapters";
import { getPostingChannels } from "@/lib/api-server/posting/channels";
import { isPostingDbReady } from "@/lib/api-server/posting/db-ready";
import { saveJobResult } from "@/lib/api-server/posting/save-job-result";
import { prisma } from "@/lib/api-server/prisma";

export { generatePostText };

function toDbStatus(status: ListingPostInput["status"]): RentalListingStatus {
  switch (status) {
    case "draft":
      return "DRAFT";
    case "rented":
      return "RENTED";
    default:
      return "ACTIVE";
  }
}

function listingInputFromRow(row: {
  title: string;
  district: string;
  propertyType: string;
  rooms: number;
  area: number;
  price: number;
  description: string | null;
  status: RentalListingStatus;
  landlordEmail: string;
  landlordName: string | null;
  legacyLocalId: string | null;
  images: { url: string; sortOrder: number }[];
}): ListingPostInput {
  return {
    title: row.title,
    district: row.district,
    propertyType: row.propertyType,
    rooms: row.rooms,
    area: row.area,
    price: row.price,
    description: row.description ?? undefined,
    status:
      row.status === "DRAFT"
        ? "draft"
        : row.status === "RENTED"
          ? "rented"
          : "active",
    images: row.images.sort((a, b) => a.sortOrder - b.sortOrder).map((i) => i.url),
    landlordEmail: row.landlordEmail,
    landlordName: row.landlordName ?? undefined,
    legacyLocalId: row.legacyLocalId ?? undefined,
  };
}

function mapJob(row: {
  id: string;
  platform: PostingPlatform;
  status: PostingJobStatus;
  generatedText: string | null;
  manualPackage: unknown;
  errorMessage: string | null;
  retryCount: number;
  postedAt: Date | null;
  postUrl?: string | null;
  channelName?: string | null;
  externalPostId?: string | null;
}): PostingJobView {
  return {
    id: row.id,
    platform: row.platform,
    status: row.status,
    generatedText: row.generatedText ?? undefined,
    manualPackage: row.manualPackage as ManualPostingPackage | undefined,
    errorMessage: row.errorMessage ?? undefined,
    retryCount: row.retryCount,
    postedAt: row.postedAt?.toISOString(),
    postUrl: row.postUrl ?? undefined,
    channelName: row.channelName ?? undefined,
    externalPostId: row.externalPostId ?? undefined,
  };
}

export async function publishListing(
  input: ListingPostInput
): Promise<ListingWithJobs> {
  if (await isPostingDbReady()) {
    return publishListingDb(input);
  }
  return publishListingEphemeral(input);
}

async function publishListingDb(
  input: ListingPostInput
): Promise<ListingWithJobs> {
  const listing = await prisma.rentalListing.create({
    data: {
      title: input.title,
      district: input.district,
      propertyType: input.propertyType,
      rooms: input.rooms,
      area: input.area,
      price: input.price,
      description: input.description,
      status: toDbStatus(input.status),
      landlordEmail: input.landlordEmail.toLowerCase(),
      landlordName: input.landlordName,
      legacyLocalId: input.legacyLocalId,
      images: {
        create: (input.images ?? []).map((url, sortOrder) => ({
          url,
          sortOrder,
        })),
      },
    },
    include: { images: true },
  });

  await createPostingJobs(listing.id, input);
  const jobs = await runPostingQueue(listing.id, input);

  return {
    id: listing.id,
    title: listing.title,
    district: listing.district,
    propertyType: listing.propertyType,
    rooms: listing.rooms,
    area: listing.area,
    price: listing.price,
    description: listing.description ?? undefined,
    status: listing.status.toLowerCase(),
    landlordEmail: listing.landlordEmail,
    legacyLocalId: listing.legacyLocalId ?? undefined,
    images: listing.images.sort((a, b) => a.sortOrder - b.sortOrder).map((i) => i.url),
    jobs,
    createdAt: listing.createdAt.toISOString(),
  };
}

async function publishListingEphemeral(
  input: ListingPostInput
): Promise<ListingWithJobs> {
  const channels = await getPostingChannels();
  const id = input.legacyLocalId ?? crypto.randomUUID();
  const jobs: PostingJobView[] = [];

  for (const platform of POSTING_PLATFORMS) {
    const channel = channels.find((c) => c.platform === platform) ?? null;
    const generatedText = generatePostText(input, platform);
    const pendingJob: PostingJobView = {
      id: `${id}-${platform}`,
      platform,
      status: "PENDING",
      generatedText,
      retryCount: 0,
    };
    const result = await runPlatformAdapter(platform, input, channel);
    jobs.push({
      ...pendingJob,
      status: result.status,
      generatedText: result.generatedText,
      manualPackage: result.manualPackage,
      errorMessage: result.errorMessage,
      postUrl: result.postUrl,
      channelName: result.channelName,
      externalPostId: result.externalPostId,
      retryCount: 0,
      postedAt: result.status === "POSTED" ? new Date().toISOString() : undefined,
    });
  }

  return {
    id,
    title: input.title,
    district: input.district,
    propertyType: input.propertyType,
    rooms: input.rooms,
    area: input.area,
    price: input.price,
    description: input.description,
    status: input.status,
    landlordEmail: input.landlordEmail,
    legacyLocalId: id,
    images: input.images ?? [],
    jobs,
    createdAt: new Date().toISOString(),
  };
}

export async function createPostingJobs(
  listingId: string,
  input: ListingPostInput
): Promise<PostingJobView[]> {
  const jobs: PostingJobView[] = [];

  for (const platform of POSTING_PLATFORMS) {
    const generatedText = generatePostText(input, platform);
    const row = await prisma.postingJob.upsert({
      where: { listingId_platform: { listingId, platform } },
      create: {
        listingId,
        platform,
        status: "PENDING",
        generatedText,
      },
      update: {
        status: "PENDING",
        generatedText,
        errorMessage: null,
      },
    });
    jobs.push(mapJob(row));
  }

  return jobs;
}

export async function runPostingQueue(
  listingId: string,
  input: ListingPostInput
): Promise<PostingJobView[]> {
  const channels = await getPostingChannels();
  const existing = await prisma.postingJob.findMany({ where: { listingId } });
  const results: PostingJobView[] = [];

  for (const job of existing) {
    const channel = channels.find((c) => c.platform === job.platform) ?? null;
    const processed = await executePlatformJob(
      job.id,
      job.platform,
      input,
      channel,
      job.retryCount
    );
    results.push(processed);
  }

  return results;
}

async function executePlatformJob(
  jobId: string,
  platform: PostingPlatform,
  input: ListingPostInput,
  channel: PostingChannelConfig | null,
  retryCount: number
): Promise<PostingJobView> {
  await prisma.postingJob.update({
    where: { id: jobId },
    data: { status: "PENDING", retryCount },
  });

  const result = await runPlatformAdapter(platform, input, channel);

  const updated = await saveJobResult(jobId, result);

  await writePostingLog(jobId, platform, result.status, result.errorMessage, {
    externalPostId: result.externalPostId,
    postUrl: result.postUrl,
  });

  return mapJob(updated);
}

async function writePostingLog(
  jobId: string,
  platform: PostingPlatform,
  status: string,
  errorMessage?: string,
  meta?: Record<string, unknown>
) {
  await prisma.postingLog.create({
    data: {
      jobId,
      level: status === "FAILED" ? "error" : "info",
      message:
        status === "POSTED"
          ? `${platform} ga muvaffaqiyatli joylandi`
          : errorMessage ?? `${platform} — ${status}`,
      meta: { platform, action: status, ...meta },
    },
  });
}

export async function retryPostingJob(jobId: string): Promise<PostingJobView> {
  if (!(await isPostingDbReady())) {
    throw new Error("Posting jadvallari migratsiya qilinmagan");
  }

  const job = await prisma.postingJob.findUnique({
    where: { id: jobId },
    include: { listing: { include: { images: true } } },
  });
  if (!job) throw new Error("Job topilmadi");

  const input = listingInputFromRow(job.listing);
  const channels = await getPostingChannels();
  const channel = channels.find((c) => c.platform === job.platform) ?? null;

  return executePlatformJob(
    job.id,
    job.platform,
    input,
    channel,
    job.retryCount + 1
  );
}

export async function retryAllPostingJobs(
  listingId: string,
  input?: ListingPostInput
): Promise<PostingJobView[]> {
  if (!(await isPostingDbReady())) {
    throw new Error("Posting DB tayyor emas");
  }

  const listing = await prisma.rentalListing.findUnique({
    where: { id: listingId },
    include: { images: true, jobs: true },
  });
  if (!listing && !input) throw new Error("Listing topilmadi");

  const postInput = input ?? listingInputFromRow(listing!);
  const id = listing?.id ?? input!.legacyLocalId!;
  return runPostingQueue(id, postInput);
}

export async function markJobPosted(jobId: string): Promise<PostingJobView> {
  if (!(await isPostingDbReady())) {
    throw new Error("Posting DB tayyor emas");
  }

  const updated = await prisma.postingJob.update({
    where: { id: jobId },
    data: {
      status: "POSTED",
      postedAt: new Date(),
      errorMessage: null,
    },
  });

  await writePostingLog(jobId, updated.platform, "POSTED", "Qo'lda joylandi deb belgilandi", {
    action: "mark_posted",
  });

  return mapJob(updated);
}

export async function getListingsByEmail(
  email: string
): Promise<ListingWithJobs[]> {
  if (!(await isPostingDbReady())) return [];

  const rows = await prisma.rentalListing.findMany({
    where: { landlordEmail: email.toLowerCase() },
    include: { images: true, jobs: true },
    orderBy: { createdAt: "desc" },
  });

  return rows.map((listing) => ({
    id: listing.id,
    title: listing.title,
    district: listing.district,
    propertyType: listing.propertyType,
    rooms: listing.rooms,
    area: listing.area,
    price: listing.price,
    description: listing.description ?? undefined,
    status: listing.status.toLowerCase(),
    landlordEmail: listing.landlordEmail,
    legacyLocalId: listing.legacyLocalId ?? undefined,
    images: listing.images.sort((a, b) => a.sortOrder - b.sortOrder).map((i) => i.url),
    jobs: listing.jobs.map(mapJob),
    createdAt: listing.createdAt.toISOString(),
  }));
}

export async function getPostingLogs(jobId: string): Promise<PostingLogView[]> {
  if (!(await isPostingDbReady())) return [];
  const rows = await prisma.postingLog.findMany({
    where: { jobId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return rows.map((r) => ({
    id: r.id,
    jobId: r.jobId,
    platform: (r.meta as { platform?: PostingPlatform })?.platform,
    level: r.level,
    action: (r.meta as { action?: string })?.action,
    message: r.message,
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function getPostingLogsByListingId(
  listingId: string
): Promise<PostingLogView[]> {
  if (!(await isPostingDbReady())) return [];
  const jobs = await prisma.postingJob.findMany({
    where: { listingId },
    select: { id: true },
  });
  const jobIds = jobs.map((j) => j.id);
  if (!jobIds.length) return [];

  const rows = await prisma.postingLog.findMany({
    where: { jobId: { in: jobIds } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return rows.map((r) => ({
    id: r.id,
    jobId: r.jobId,
    platform: (r.meta as { platform?: PostingPlatform })?.platform,
    level: r.level,
    action: (r.meta as { action?: string })?.action,
    message: r.message,
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function getJobsByLegacyLocalId(
  legacyLocalId: string
): Promise<PostingJobView[]> {
  if (!(await isPostingDbReady())) return [];
  const listing = await prisma.rentalListing.findFirst({
    where: { legacyLocalId },
    include: { jobs: true },
  });
  return listing?.jobs.map(mapJob) ?? [];
}

export async function retryEphemeralJob(
  legacyLocalId: string,
  platform: PostingPlatform,
  input: ListingPostInput
): Promise<PostingJobView> {
  const channels = await getPostingChannels();
  const channel = channels.find((c) => c.platform === platform) ?? null;
  const result = await runPlatformAdapter(platform, input, channel);
  return {
    id: `${legacyLocalId}-${platform}`,
    platform,
    status: result.status,
    generatedText: result.generatedText,
    manualPackage: result.manualPackage,
    errorMessage: result.errorMessage,
    postUrl: result.postUrl,
    channelName: result.channelName,
    externalPostId: result.externalPostId,
    retryCount: 1,
    postedAt: result.status === "POSTED" ? new Date().toISOString() : undefined,
  };
}

export async function markEphemeralJobPosted(
  legacyLocalId: string,
  platform: PostingPlatform,
  jobId: string
): Promise<PostingJobView> {
  return {
    id: jobId,
    platform,
    status: "POSTED",
    retryCount: 0,
    postedAt: new Date().toISOString(),
  };
}

export async function retryAllEphemeral(
  legacyLocalId: string,
  input: ListingPostInput
): Promise<PostingJobView[]> {
  const channels = await getPostingChannels();
  const jobs: PostingJobView[] = [];

  for (const platform of POSTING_PLATFORMS) {
    const channel = channels.find((c) => c.platform === platform) ?? null;
    const result = await runPlatformAdapter(platform, input, channel);
    jobs.push({
      id: `${legacyLocalId}-${platform}`,
      platform,
      status: result.status,
      generatedText: result.generatedText,
      manualPackage: result.manualPackage,
      errorMessage: result.errorMessage,
      postUrl: result.postUrl,
      channelName: result.channelName,
      externalPostId: result.externalPostId,
      retryCount: 1,
      postedAt: result.status === "POSTED" ? new Date().toISOString() : undefined,
    });
  }

  return jobs;
}
