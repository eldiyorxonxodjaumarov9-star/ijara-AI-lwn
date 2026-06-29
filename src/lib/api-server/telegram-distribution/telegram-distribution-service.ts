import type { ListingPostInput } from "@/lib/posting/types";
import type {
  TelegramChannelView,
  TelegramPostingJobView,
  DistributeOptions,
} from "@/lib/telegram-distribution/types";
import type { TelegramChannelInput } from "@/lib/telegram-distribution/types";
import { prisma } from "@/lib/api-server/prisma";
import { getPostingChannels } from "@/lib/api-server/posting/channels";
import { routeTelegramChannels } from "@/lib/api-server/telegram-distribution/telegram-router";
import { generateTelegramDistributionCaption } from "@/lib/api-server/telegram-distribution/telegram-caption";
import {
  checkBotAdminStatus,
  resolveBotToken,
  sendTestChannelMessage,
} from "@/lib/api-server/telegram-distribution/telegram-service";
import { appendTelegramLog } from "@/lib/api-server/telegram-distribution/telegram-logs";
import {
  processTelegramJob,
  processTelegramQueue,
} from "@/lib/api-server/telegram-distribution/telegram-queue";

function mapChannel(row: {
  id: string;
  name: string;
  username: string | null;
  chatId: string;
  enabled: boolean;
  regionFilters: string[];
  propertyTypeFilters: string[];
  priority: number;
  isBotAdmin: boolean | null;
  lastAdminCheckAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): TelegramChannelView {
  return {
    id: row.id,
    name: row.name,
    username: row.username ?? undefined,
    chatId: row.chatId,
    enabled: row.enabled,
    regionFilters: row.regionFilters,
    propertyTypeFilters: row.propertyTypeFilters,
    priority: row.priority,
    isBotAdmin: row.isBotAdmin,
    lastAdminCheckAt: row.lastAdminCheckAt?.toISOString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mapJob(row: {
  id: string;
  listingId: string;
  channelId: string;
  status: string;
  caption: string | null;
  scheduledAt: Date | null;
  postedAt: Date | null;
  externalPostId: string | null;
  postUrl: string | null;
  errorMessage: string | null;
  retryCount: number;
  maxRetries: number;
  createdAt: Date;
  channel: { name: string; username: string | null };
}): TelegramPostingJobView {
  return {
    id: row.id,
    listingId: row.listingId,
    channelId: row.channelId,
    channelName: row.channel.name,
    channelUsername: row.channel.username ?? undefined,
    status: row.status as TelegramPostingJobView["status"],
    caption: row.caption ?? undefined,
    scheduledAt: row.scheduledAt?.toISOString(),
    postedAt: row.postedAt?.toISOString(),
    externalPostId: row.externalPostId ?? undefined,
    postUrl: row.postUrl ?? undefined,
    errorMessage: row.errorMessage ?? undefined,
    retryCount: row.retryCount,
    maxRetries: row.maxRetries,
    createdAt: row.createdAt.toISOString(),
  };
}

async function getBotTokenFromSettings() {
  const channels = await getPostingChannels();
  const tg = channels.find((c) => c.platform === "TELEGRAM");
  return resolveBotToken(tg?.secrets.botToken);
}

export async function listTelegramChannels(): Promise<TelegramChannelView[]> {
  const rows = await prisma.telegramChannel.findMany({
    orderBy: [{ priority: "desc" }, { name: "asc" }],
  });
  return rows.map(mapChannel);
}

export async function createTelegramChannel(
  input: TelegramChannelInput
): Promise<TelegramChannelView> {
  const row = await prisma.telegramChannel.create({
    data: {
      name: input.name.trim(),
      username: input.username?.replace(/^@/, "").trim() || null,
      chatId: input.chatId.trim(),
      enabled: input.enabled ?? true,
      regionFilters: input.regionFilters ?? [],
      propertyTypeFilters: input.propertyTypeFilters ?? [],
      priority: input.priority ?? 0,
    },
  });
  return mapChannel(row);
}

export async function updateTelegramChannel(
  id: string,
  input: Partial<TelegramChannelInput>
): Promise<TelegramChannelView> {
  const row = await prisma.telegramChannel.update({
    where: { id },
    data: {
      ...(input.name != null ? { name: input.name.trim() } : {}),
      ...(input.username != null
        ? { username: input.username.replace(/^@/, "").trim() || null }
        : {}),
      ...(input.chatId != null ? { chatId: input.chatId.trim() } : {}),
      ...(input.enabled != null ? { enabled: input.enabled } : {}),
      ...(input.regionFilters != null ? { regionFilters: input.regionFilters } : {}),
      ...(input.propertyTypeFilters != null
        ? { propertyTypeFilters: input.propertyTypeFilters }
        : {}),
      ...(input.priority != null ? { priority: input.priority } : {}),
    },
  });
  return mapChannel(row);
}

export async function deleteTelegramChannel(id: string) {
  await prisma.telegramChannel.delete({ where: { id } });
}

export async function verifyChannelBotAdmin(channelId: string) {
  const channel = await prisma.telegramChannel.findUniqueOrThrow({
    where: { id: channelId },
  });
  const token = await getBotTokenFromSettings();
  if (!token) {
    throw new Error("Telegram bot token sozlanmagan");
  }

  try {
    const result = await checkBotAdminStatus(token, channel.chatId);
    const updated = await prisma.telegramChannel.update({
      where: { id: channelId },
      data: {
        isBotAdmin: result.isAdmin,
        lastAdminCheckAt: new Date(),
      },
    });
    return {
      channel: mapChannel(updated),
      isAdmin: result.isAdmin,
      status: result.status,
      botUsername: result.botUsername,
    };
  } catch (err) {
    await prisma.telegramChannel.update({
      where: { id: channelId },
      data: { isBotAdmin: false, lastAdminCheckAt: new Date() },
    });
    throw err;
  }
}

export async function testTelegramChannel(channelId: string) {
  const channel = await prisma.telegramChannel.findUniqueOrThrow({
    where: { id: channelId },
  });
  const token = await getBotTokenFromSettings();
  if (!token) throw new Error("Telegram bot token sozlanmagan");

  const admin = await checkBotAdminStatus(token, channel.chatId);
  if (!admin.isAdmin) {
    throw new Error(
      `Bot kanalda admin emas (holat: ${admin.status}). Kanalga botni admin qiling.`
    );
  }

  const messageId = await sendTestChannelMessage(
    token,
    channel.chatId,
    channel.name
  );

  await prisma.telegramChannel.update({
    where: { id: channelId },
    data: { isBotAdmin: true, lastAdminCheckAt: new Date() },
  });

  return { messageId, channel: mapChannel(channel) };
}

export async function enqueueTelegramDistribution(
  listingId: string,
  listing: ListingPostInput & { region?: string | null },
  options: DistributeOptions = {}
) {
  const channels = await prisma.telegramChannel.findMany({
    where: { enabled: true },
  });

  const routed = routeTelegramChannels(listing, channels);
  const caption = generateTelegramDistributionCaption(listing);
  const scheduledAt = options.scheduledAt
    ? new Date(options.scheduledAt)
    : null;

  const jobs: TelegramPostingJobView[] = [];

  for (const ch of routed) {
    const row = await prisma.telegramPostingJob.upsert({
      where: {
        listingId_channelId: { listingId, channelId: ch.id },
      },
      create: {
        listingId,
        channelId: ch.id,
        status: "PENDING",
        caption,
        scheduledAt,
      },
      update: {
        status: "PENDING",
        caption,
        scheduledAt,
        errorMessage: null,
        postedAt: null,
        externalPostId: null,
        postUrl: null,
      },
      include: { channel: true },
    });

    await appendTelegramLog(
      row.id,
      `Kanal navbatga qo'shildi: ${ch.name} (@${ch.username ?? ch.chatId})`,
      "info",
      { channelId: ch.id, scheduledAt: scheduledAt?.toISOString() }
    );

    jobs.push(mapJob(row));
  }

  if (options.immediate !== false && (!scheduledAt || scheduledAt <= new Date())) {
    await processTelegramQueue({ listingId });
    return getListingTelegramJobs(listingId);
  }

  return jobs;
}

export async function getListingTelegramJobs(
  listingId: string
): Promise<TelegramPostingJobView[]> {
  const rows = await prisma.telegramPostingJob.findMany({
    where: { listingId },
    include: { channel: true },
    orderBy: [{ channel: { priority: "desc" } }, { createdAt: "asc" }],
  });
  return rows.map(mapJob);
}

export async function retryTelegramJob(jobId: string) {
  const job = await prisma.telegramPostingJob.update({
    where: { id: jobId },
    data: { status: "PENDING", retryCount: { increment: 1 } },
    include: { channel: true },
  });
  await appendTelegramLog(jobId, "Qayta yuborish navbatga qo'yildi", "info");
  await processTelegramJob(jobId);
  const updated = await prisma.telegramPostingJob.findUniqueOrThrow({
    where: { id: jobId },
    include: { channel: true },
  });
  return mapJob(updated);
}

export async function bulkRepostListing(listingId: string) {
  await prisma.telegramPostingJob.updateMany({
    where: { listingId },
    data: {
      status: "PENDING",
      errorMessage: null,
      postedAt: null,
      externalPostId: null,
      postUrl: null,
    },
  });
  await processTelegramQueue({ listingId });
  return getListingTelegramJobs(listingId);
}

