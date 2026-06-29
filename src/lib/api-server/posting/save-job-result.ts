import type { Prisma } from "@prisma/client";

import type { AdapterResult } from "@/lib/api-server/posting/adapters";
import { prisma } from "@/lib/api-server/prisma";

type JobRow = {
  id: string;
  platform: import("@/lib/posting/types").PostingPlatform;
  status: import("@prisma/client").PostingJobStatus;
  generatedText: string | null;
  manualPackage: unknown;
  errorMessage: string | null;
  retryCount: number;
  postedAt: Date | null;
  postUrl?: string | null;
  channelName?: string | null;
  externalPostId?: string | null;
};

/** Prisma client eski bo'lsa postUrl/channelName siz saqlaydi */
export async function saveJobResult(
  jobId: string,
  result: AdapterResult & { status: JobRow["status"] }
): Promise<JobRow> {
  const base: Prisma.PostingJobUpdateInput = {
    status: result.status,
    generatedText: result.generatedText,
    manualPackage: result.manualPackage ?? undefined,
    externalPostId: result.externalPostId,
    errorMessage: result.errorMessage,
    postedAt: result.status === "POSTED" ? new Date() : null,
  };

  const extended = {
    ...base,
    postUrl: result.postUrl,
    channelName: result.channelName,
  } as Prisma.PostingJobUpdateInput;

  try {
    return await prisma.postingJob.update({
      where: { id: jobId },
      data: extended,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!msg.includes("postUrl") && !msg.includes("channelName")) {
      throw err;
    }
    const row = await prisma.postingJob.update({
      where: { id: jobId },
      data: base,
    });
    return {
      ...row,
      postUrl: result.postUrl ?? null,
      channelName: result.channelName ?? null,
    };
  }
}
