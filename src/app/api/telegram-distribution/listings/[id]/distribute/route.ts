import { NextRequest } from "next/server";

import { fail, ok } from "@/lib/api-server/http";
import { prisma } from "@/lib/api-server/prisma";
import { enqueueTelegramDistribution } from "@/lib/api-server/telegram-distribution/telegram-distribution-service";
import type { DistributeOptions } from "@/lib/telegram-distribution/types";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const body = (await req.json()) as DistributeOptions;
    const listing = await prisma.rentalListing.findUniqueOrThrow({
      where: { id },
      include: { images: true },
    });
    const jobs = await enqueueTelegramDistribution(
      id,
      {
        title: listing.title,
        district: listing.district,
        region: listing.region ?? undefined,
        propertyType: listing.propertyType,
        rooms: listing.rooms,
        area: listing.area,
        price: listing.price,
        description: listing.description ?? undefined,
        status: "active",
        images: listing.images
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((i) => i.url),
        landlordEmail: listing.landlordEmail,
        landlordName: listing.landlordName ?? undefined,
      },
      {
        scheduledAt: body.scheduledAt,
        immediate: body.scheduledAt ? false : true,
      }
    );
    return ok(jobs);
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Tarqatish xatosi", 500);
  }
}
