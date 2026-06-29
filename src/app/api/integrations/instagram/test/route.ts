import { fail, ok } from "@/lib/api-server/http";
import { testInstagramConnection } from "@/lib/api-server/integrations/instagram-service";

export async function POST() {
  const result = await testInstagramConnection();
  if (!result.ok) {
    return fail(result.message, 400);
  }
  return ok(result);
}
