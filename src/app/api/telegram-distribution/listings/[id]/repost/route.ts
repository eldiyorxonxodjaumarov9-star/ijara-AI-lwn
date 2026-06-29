import { fail, ok } from "@/lib/api-server/http";
import { bulkRepostListing } from "@/lib/api-server/telegram-distribution/telegram-distribution-service";

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const jobs = await bulkRepostListing(id);
    return ok(jobs);
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Qayta tarqatish xatosi", 500);
  }
}
