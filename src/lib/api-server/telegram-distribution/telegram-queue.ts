import { prisma } from "@/lib/api-server/prisma";
import { getPostingChannels } from "@/lib/api-server/posting/channels";
import {
  buildTelegramPostUrl,
  checkBotAdminStatus,
  resolveBotToken,
  sendTelegramMediaGroup,
} from "@/lib/api-server/telegram-distribution/telegram-service";
import { appendTelegramLog } from "@/lib/api-server/telegram-distribution/telegram-logs";
import { syncAggregateTelegramPostingJob } from "@/lib/api-server/telegram-distribution/telegram-sync";
import { generateTelegramDistributionCaption } from "@/lib/api-server/telegram-distribution/telegram-caption";
import type { ListingPostInput } from "@/lib/posting/types";

const BATCH_SIZE = 5;
const RETRY_DELAY_MS = 2000;

async function getBotToken() {
  const channels = await getPostingChannels();
  const tg = channels.find((c) => c.platform === "TELEGRAM");
  return resolveBotToken(tg?.secrets.botToken);
}

function listingFromRow(row: {
  title: string;
  district: string;
  region: string | null;
  propertyType: string;
  rooms: number;
  area: number;
  price: number;
  description: string | null;
  landlordEmail: string;
  landlordName: string | null;
  images: { url: string; sortOrder: number }[];
}): ListingPostInput & { region?: string | null } {
  return {
    title: row.title,
    district: row.district,
    region: row.region ?? undefined,
    propertyType: row.propertyType,
    rooms: row.rooms,
    area: row.area,
    price: row.price,
    description: row.description ?? undefined,
    status: "active",
    images: row.images.sort((a, b) => a.sortOrder - b.sortOrder).map((i) => i.url),
    landlordEmail: row.landlordEmail,
    landlordName: row.landlordName ?? undefined,
  };
}

export async function processTelegramJob(jobId: string) {
  const job = await prisma.telegramPostingJob.findUnique({
    where: { id: jobId },
    include: {
      channel: true,
      listing: { include: { images: true } },
    },
  });
  if (!job) throw new Error("Job topilmadi");
  if (job.status === "POSTED") return job;

  if (job.scheduledAt && job.scheduledAt > new Date()) {
    return job;
  }

  const token = await getBotToken();
  if (!token) {
    await failJob(jobId, "Telegram bot token sozlanmagan");
    return prisma.telegramPostingJob.findUniqueOrThrow({ where: { id: jobId } });
  }

  await prisma.telegramPostingJob.update({
    where: { id: jobId },
    data: { status: "SENDING" },
  });
  await appendTelegramLog(jobId, `Yuborilmoqda: ${job.channel.name}`, "info");

  try {
    const admin = await checkBotAdminStatus(token, job.channel.chatId);
    await prisma.telegramChannel.update({
      where: { id: job.channelId },
      data: {
        isBotAdmin: admin.isAdmin,
        lastAdminCheckAt: new Date(),
      },
    });

    if (!admin.isAdmin) {
      throw new Error(
        `Bot @${admin.botUsername ?? "bot"} kanalda admin emas (${admin.status})`
      );
    }

    const listing = listingFromRow(job.listing);
    const caption =
      job.caption ?? generateTelegramDistributionCaption(listing);
    const images = listing.images ?? [];

    const messageId = await sendTelegramMediaGroup(
      token,
      job.channel.chatId,
      images,
      caption
    );

    const postUrl = buildTelegramPostUrl(
      job.channel.chatId,
      messageId,
      job.channel.username
    );

    await prisma.telegramPostingJob.update({
      where: { id: jobId },
      data: {
        status: "POSTED",
        externalPostId: messageId,
        postUrl,
        postedAt: new Date(),
        errorMessage: null,
      },
    });

    await appendTelegramLog(
      jobId,
      `Muvaffaqiyatli joylandi: ${job.channel.name}`,
      "info",
      { postUrl, messageId }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Telegram xatosi";
    const isAdminError =
      /admin emas|not enough rights|CHAT_ADMIN_REQUIRED/i.test(message);

    if (job.retryCount < job.maxRetries) {
      await prisma.telegramPostingJob.update({
        where: { id: jobId },
        data: {
          status: "PENDING",
          errorMessage: message,
          retryCount: { increment: 1 },
          ...(isAdminError ? {} : {}),
        },
      });
      await appendTelegramLog(
        jobId,
        `Xato — qayta urinish (${job.retryCount + 1}/${job.maxRetries}): ${message}`,
        "warn"
      );
    } else {
      await failJob(jobId, message);
    }

    if (isAdminError) {
      await prisma.telegramChannel.update({
        where: { id: job.channelId },
        data: { isBotAdmin: false, lastAdminCheckAt: new Date() },
      });
    }
  }

  await syncAggregateTelegramPostingJob(job.listingId);
  return prisma.telegramPostingJob.findUniqueOrThrow({
    where: { id: jobId },
    include: { channel: true },
  });
}

async function failJob(jobId: string, message: string) {
  await prisma.telegramPostingJob.update({
    where: { id: jobId },
    data: { status: "FAILED", errorMessage: message },
  });
  await appendTelegramLog(jobId, message, "error");
}

export async function processTelegramQueue(opts?: {
  listingId?: string;
  limit?: number;
}) {
  const now = new Date();
  const jobs = await prisma.telegramPostingJob.findMany({
    where: {
      status: { in: ["PENDING", "FAILED"] },
      retryCount: { lt: 3 },
      ...(opts?.listingId ? { listingId: opts.listingId } : {}),
      OR: [{ scheduledAt: null }, { scheduledAt: { lte: now } }],
    },
    orderBy: [{ scheduledAt: "asc" }, { createdAt: "asc" }],
    take: opts?.limit ?? BATCH_SIZE,
    select: { id: true },
  });

  const results = [];
  for (const { id } of jobs) {
    if (results.length > 0) {
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
    }
    results.push(await processTelegramJob(id));
  }

  const listingIds = [
    ...new Set(
      results.map((j) => j.listingId).filter(Boolean) as string[]
    ),
  ];
  for (const lid of listingIds) {
    await syncAggregateTelegramPostingJob(lid);
  }

  return results;
}
