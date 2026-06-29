import { fail, ok } from "@/lib/api-server/http";
import { disconnectInstagram } from "@/lib/api-server/integrations/instagram-service";

export async function POST() {
  try {
    await disconnectInstagram();
    return ok({ disconnected: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Uzish xatosi";
    return fail(message, 500);
  }
}
