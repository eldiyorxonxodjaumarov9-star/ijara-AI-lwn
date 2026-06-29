import type { TelegramPostingStatus } from "@prisma/client";
import { prisma } from "@/lib/api-server/prisma";

export async function syncAggregateTelegramPostingJob(listingId: string) {
  const jobs = await prisma.telegramPostingJob.findMany({
    where: { listingId },
    include: { channel: true },
  });
  if (!jobs.length) return;

  const posted = jobs.filter(
    (j: { status: TelegramPostingStatus }) => j.status === "POSTED"
  );
  const failed = jobs.filter(
    (j: { status: TelegramPostingStatus }) => j.status === "FAILED"
  );
  const pending = jobs.filter(
    (j: { status: TelegramPostingStatus }) =>
      j.status === "PENDING" || j.status === "SENDING"
  );

  let status: "POSTED" | "FAILED" | "PENDING" = "PENDING";
  if (posted.length && !failed.length && !pending.length) status = "POSTED";
  else if (failed.length && !posted.length && !pending.length) status = "FAILED";
  else if (posted.length && failed.length) status = "FAILED";

  const channelNames = posted.map((j) => j.channel.name).join(", ");
  const postUrl = posted[0]?.postUrl ?? undefined;

  await prisma.postingJob.updateMany({
    where: { listingId, platform: "TELEGRAM" },
    data: {
      status,
      channelName: channelNames || undefined,
      postUrl,
      errorMessage:
        failed.length > 0 ? `${failed.length} ta kanalda xato` : null,
      postedAt: posted.length ? new Date() : null,
    },
  });
}
