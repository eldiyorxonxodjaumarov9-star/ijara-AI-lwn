import {
  TTLOCK_CALLBACK_CRON_BATCH_LIMIT,
  TTLOCK_CALLBACK_CRON_MAX_RUNTIME_MS,
} from "@/lib/api-server/ttlock/callback-config";
import { claimCallbackInboxBatch } from "@/lib/api-server/ttlock/callback-inbox";
import { processCallbackInbox } from "@/lib/api-server/ttlock/callback-processor";

export type CallbackRetrySweepDeps = {
  claimBatch: typeof claimCallbackInboxBatch;
  processInbox: typeof processCallbackInbox;
};

const defaultDeps: CallbackRetrySweepDeps = {
  claimBatch: claimCallbackInboxBatch,
  processInbox: processCallbackInbox,
};

export async function runCallbackRetrySweep(
  workerPrefix: string,
  deps: CallbackRetrySweepDeps = defaultDeps
) {
  const started = Date.now();
  const workerId = `${workerPrefix}-${Date.now()}`;
  let claimed = 0;
  let processed = 0;

  while (Date.now() - started < TTLOCK_CALLBACK_CRON_MAX_RUNTIME_MS) {
    const ids = await deps.claimBatch({
      limit: TTLOCK_CALLBACK_CRON_BATCH_LIMIT,
      workerId,
    });
    if (ids.length === 0) break;

    for (const inboxId of ids) {
      claimed += 1;
      const done = await deps.processInbox({
        inboxId,
        rawBody: "",
        workerId,
      });
      if (done) processed += 1;
    }

    if (ids.length < TTLOCK_CALLBACK_CRON_BATCH_LIMIT) break;
  }

  return { claimed, processed };
}
