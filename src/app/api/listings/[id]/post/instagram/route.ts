import { NextRequest } from "next/server";

import { fail, ok } from "@/lib/api-server/http";
import {
  InstagramError,
  publishInstagramPost,
} from "@/lib/api-server/integrations/instagram-service";
import { isPostingDbReady } from "@/lib/api-server/posting/db-ready";
import { saveJobResult } from "@/lib/api-server/posting/save-job-result";
import { prisma } from "@/lib/api-server/prisma";
import type { ListingPostInput } from "@/lib/posting/types";
import { generatePostText } from "@/lib/posting/copy-generator";

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;

  try {
    let input: ListingPostInput | null = null;
    let jobId: string | null = null;

    if (await isPostingDbReady()) {
      const listing = await prisma.rentalListing.findFirst({
        where: { OR: [{ id }, { legacyLocalId: id }] },
        include: { images: true, jobs: { where: { platform: "INSTAGRAM" } } },
      });

      if (listing) {
        input = {
          title: listing.title,
          district: listing.district,
          propertyType: listing.propertyType,
          rooms: listing.rooms,
          area: listing.area,
          price: listing.price,
          description: listing.description ?? undefined,
          status:
            listing.status === "DRAFT"
              ? "draft"
              : listing.status === "RENTED"
                ? "rented"
                : "active",
          images: listing.images
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map((i) => i.url),
          landlordEmail: listing.landlordEmail,
          landlordName: listing.landlordName ?? undefined,
          legacyLocalId: listing.legacyLocalId ?? listing.id,
        };
        jobId = listing.jobs[0]?.id ?? null;
      }
    }

    if (!input) {
      const body = (await req.json()) as { listing?: ListingPostInput };
      input = body.listing ?? null;
    }

    if (!input) {
      return fail("Listing topilmadi", 404);
    }

    const result = await publishInstagramPost(input);
    const generatedText = generatePostText(input, "INSTAGRAM");

    const adapterResult = {
      status: "POSTED" as const,
      externalPostId: result.mediaId,
      postUrl: result.postUrl ?? result.permalink,
      channelName: result.channelName,
      generatedText,
    };

    if (jobId && (await isPostingDbReady())) {
      const job = await saveJobResult(jobId, adapterResult);
      return ok({
        job: {
          id: job.id,
          platform: "INSTAGRAM",
          status: job.status,
          generatedText: job.generatedText,
          postUrl: result.postUrl ?? result.permalink,
          channelName: result.channelName,
          externalPostId: result.mediaId,
          postedAt: job.postedAt?.toISOString(),
          retryCount: job.retryCount,
        },
        mediaId: result.mediaId,
        postUrl: result.postUrl ?? result.permalink,
      });
    }

    return ok({
      job: {
        id: jobId ?? `${id}-INSTAGRAM`,
        platform: "INSTAGRAM",
        status: "POSTED",
        generatedText,
        postUrl: result.postUrl ?? result.permalink,
        channelName: result.channelName,
        externalPostId: result.mediaId,
        postedAt: new Date().toISOString(),
        retryCount: 0,
      },
      mediaId: result.mediaId,
      postUrl: result.postUrl ?? result.permalink,
    });
  } catch (err) {
    const message =
      err instanceof InstagramError
        ? err.message
        : err instanceof Error
          ? err.message
          : "Instagram post xatosi";
    return fail(message, 400);
  }
}
