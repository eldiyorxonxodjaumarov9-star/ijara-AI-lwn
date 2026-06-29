import { fail, ok } from "@/lib/api-server/http";
import { testTelegramChannel } from "@/lib/api-server/telegram-distribution/telegram-distribution-service";

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const result = await testTelegramChannel(id);
    return ok({ messageId: result.messageId, channel: result.channel });
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Test xatosi", 500);
  }
}
