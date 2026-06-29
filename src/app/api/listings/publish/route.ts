import { NextRequest } from "next/server";

import { fail, ok } from "@/lib/api-server/http";
import { publishListing } from "@/lib/api-server/posting/posting-service";
import type { ListingPostInput } from "@/lib/posting/types";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Partial<ListingPostInput>;

    if (!body.title?.trim() || !body.district?.trim() || !body.landlordEmail?.trim()) {
      return fail("Sarlavha, hudud va email talab qilinadi", 400);
    }

    const input: ListingPostInput = {
      title: body.title.trim(),
      district: body.district.trim(),
      propertyType: body.propertyType?.trim() || "Kvartira",
      rooms: Number(body.rooms) || 1,
      area: Number(body.area) || 0,
      price: Number(body.price) || 0,
      description: body.description?.trim() || undefined,
      status: body.status ?? "active",
      images: Array.isArray(body.images) ? body.images : undefined,
      landlordEmail: body.landlordEmail.trim().toLowerCase(),
      landlordName: body.landlordName?.trim() || undefined,
      legacyLocalId: body.legacyLocalId?.trim() || undefined,
    };

    if (!input.price) {
      return fail("Oylik narx kiriting", 400);
    }

    const result = await publishListing(input);
    return ok(result, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Tarqatish xatosi";
    return fail(message, 500);
  }
}
