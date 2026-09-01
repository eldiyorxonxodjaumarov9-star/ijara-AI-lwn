import { after } from "next/server";
import { NextRequest } from "next/server";

import { isDatabaseConfigured } from "@/lib/api-server/prisma";
import {
  TTLOCK_CALLBACK_MAX_BODY_BYTES,
  TTLOCK_CALLBACK_SUCCESS_BODY,
} from "@/lib/api-server/ttlock/callback-config";
import { receiveCallbackInbox } from "@/lib/api-server/ttlock/callback-inbox";
import {
  buildSanitizedMetadata,
  inferPrimarySemanticEvent,
  processCallbackInbox,
  resolveLockConnection,
} from "@/lib/api-server/ttlock/callback-processor";
import {
  CallbackParseError,
  parseCallbackFormBody,
} from "@/lib/api-server/ttlock/callback-parse";
import {
  findActiveLockMatchesByExternalId,
  isMissingTtlockTableError,
} from "@/lib/api-server/ttlock/db";

function callbackSuccessResponse() {
  return new Response(TTLOCK_CALLBACK_SUCCESS_BODY, {
    status: 200,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

function isFormContentType(req: NextRequest): boolean {
  const ct = req.headers.get("content-type")?.toLowerCase() ?? "";
  return ct.includes("application/x-www-form-urlencoded");
}

async function readLimitedBody(req: NextRequest): Promise<string> {
  const buf = await req.arrayBuffer();
  if (buf.byteLength > TTLOCK_CALLBACK_MAX_BODY_BYTES) {
    throw new Error("BODY_TOO_LARGE");
  }
  return new TextDecoder("utf-8").decode(buf);
}

function scheduleInboxProcessing(inboxId: string, rawBody: string) {
  after(async () => {
    try {
      await processCallbackInbox({
        inboxId,
        rawBody,
        workerId: `after-${inboxId.slice(0, 8)}`,
      });
    } catch {
      /* lease/cron recovery — ACK allaqachon qaytarilgan */
    }
  });
}

/**
 * ACK oqimi (provider fetch KUTILMAYDI):
 * 1. parse + minimal validatsiya
 * 2. inbox RECEIVED (transaction)
 * 3. darhol raw `success`
 * 4. after() → claim + verify-by-fetch + upsert
 */
export async function handleTtlockCallbackReceive(
  rawBody: string
): Promise<Response> {
  if (!isDatabaseConfigured()) {
    return new Response("Service Unavailable", { status: 503 });
  }

  let parsed;
  try {
    parsed = parseCallbackFormBody(rawBody);
  } catch (err) {
    if (err instanceof CallbackParseError) {
      return new Response("Bad Request", { status: 400 });
    }
    return new Response("Bad Request", { status: 400 });
  }

  let connectionId: string | null = null;
  if (parsed.lockId) {
    const matches = await findActiveLockMatchesByExternalId(parsed.lockId);
    const resolved = resolveLockConnection(matches);
    if (resolved.ok) connectionId = resolved.match.connection.id;
  }

  const providerEventAt =
    parsed.records[0]?.serverDate != null
      ? new Date(parsed.records[0].serverDate!)
      : null;

  let receiveResult;
  try {
    receiveResult = await receiveCallbackInbox({
      rawBody,
      parsed,
      connectionId,
      semanticEventType: inferPrimarySemanticEvent(parsed),
      providerEventAt,
      sanitizedMetadata: buildSanitizedMetadata(parsed),
    });
  } catch (err) {
    if (isMissingTtlockTableError(err)) {
      return new Response("Service Unavailable", { status: 503 });
    }
    throw err;
  }

  if (receiveResult.kind === "duplicate") {
    return callbackSuccessResponse();
  }

  scheduleInboxProcessing(receiveResult.inboxId, rawBody);
  return callbackSuccessResponse();
}

/** TTLock cloud callback — JWT talab qilinmaydi */
export async function POST(req: NextRequest) {
  if (!isFormContentType(req)) {
    return new Response("Unsupported Media Type", { status: 415 });
  }

  let rawBody: string;
  try {
    rawBody = await readLimitedBody(req);
  } catch (err) {
    if (err instanceof Error && err.message === "BODY_TOO_LARGE") {
      return new Response("Payload Too Large", { status: 413 });
    }
    return new Response("Bad Request", { status: 400 });
  }

  if (!rawBody.trim()) {
    return new Response("Bad Request", { status: 400 });
  }

  try {
    return await handleTtlockCallbackReceive(rawBody);
  } catch {
    return new Response("Internal Server Error", { status: 500 });
  }
}

export async function GET() {
  return new Response("Method Not Allowed", { status: 405 });
}
