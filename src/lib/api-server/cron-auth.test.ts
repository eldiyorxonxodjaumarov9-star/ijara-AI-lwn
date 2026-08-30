/**
 * Fail-closed cron auth — unit va route smoke testlari.
 */
import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { NextRequest } from "next/server";

import {
  assertFailClosedCronAuth,
  CRON_NOT_CONFIGURED_CODE,
  timingSafeSecretEqual,
} from "./cron-auth";
import { runCallbackRetrySweep } from "./ttlock/callback-retry-sweep";
import { GET, POST } from "@/app/api/cron/ttlock-callback-retry/route";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "../../..");

function reqWithAuth(auth: string | null): Request {
  const headers = new Headers();
  if (auth != null) headers.set("authorization", auth);
  return new Request("http://localhost/api/cron/ttlock-callback-retry", {
    headers,
  });
}

async function jsonBody(res: Response) {
  return (await res.json()) as {
    success: boolean;
    statusCode: number;
    error?: { code: string; message: string };
    message?: string;
    data?: { claimed?: number; processed?: number };
  };
}

describe("fail-closed cron auth", () => {
  const envBackup = { ...process.env };

  beforeEach(() => {
    delete process.env.CRON_SECRET;
  });

  afterEach(() => {
    process.env = { ...envBackup };
  });

  it("1: CRON_SECRET undefined → 503 CRON_NOT_CONFIGURED", async () => {
    delete process.env.CRON_SECRET;
    const res = assertFailClosedCronAuth(reqWithAuth("Bearer anything"))!;
    assert.ok(res);
    assert.equal(res.status, 503);
    const body = await jsonBody(res);
    assert.equal(body.error?.code, CRON_NOT_CONFIGURED_CODE);
    assert.equal(body.success, false);
  });

  it("2: CRON_SECRET bo‘sh → 503 CRON_NOT_CONFIGURED", async () => {
    process.env.CRON_SECRET = "   ";
    const res = assertFailClosedCronAuth(reqWithAuth("Bearer x"))!;
    assert.equal(res.status, 503);
    const body = await jsonBody(res);
    assert.equal(body.error?.code, CRON_NOT_CONFIGURED_CODE);
  });

  it("3: secret mavjud, header yo‘q → 403", async () => {
    process.env.CRON_SECRET = "test-secret-value";
    const res = assertFailClosedCronAuth(reqWithAuth(null))!;
    assert.equal(res.status, 403);
    const body = await jsonBody(res);
    assert.equal(body.success, false);
  });

  it("4: Bearer noto‘g‘ri → 403", async () => {
    process.env.CRON_SECRET = "correct-secret";
    const res = assertFailClosedCronAuth(
      reqWithAuth("Bearer wrong-secret")
    )!;
    assert.equal(res.status, 403);
  });

  it("5: noto‘g‘ri uzunlikdagi bearer → xavfsiz 403, exception yo‘q", () => {
    process.env.CRON_SECRET = "short";
    assert.doesNotThrow(() => {
      const res = assertFailClosedCronAuth(
        reqWithAuth("Bearer this-is-a-much-longer-token-than-expected")
      );
      assert.ok(res);
      assert.equal(res!.status, 403);
    });
    assert.equal(timingSafeSecretEqual("a", "bb"), false);
  });

  it("6: to‘g‘ri bearer → null (ruxsat)", () => {
    process.env.CRON_SECRET = "my-cron-secret";
    const res = assertFailClosedCronAuth(
      reqWithAuth("Bearer my-cron-secret")
    );
    assert.equal(res, null);
  });

  it("8: response’da secret chiqmaydi", async () => {
    process.env.CRON_SECRET = "super-secret-do-not-leak";
    const res = assertFailClosedCronAuth(
      reqWithAuth("Bearer wrong")
    )!;
    const text = JSON.stringify(await jsonBody(res));
    assert.equal(text.includes("super-secret-do-not-leak"), false);
    delete process.env.CRON_SECRET;
    const unconfigured = assertFailClosedCronAuth(reqWithAuth(null))!;
    const unconfiguredText = JSON.stringify(await jsonBody(unconfigured));
    assert.equal(unconfiguredText.includes("CRON_SECRET"), false);
    assert.equal(unconfiguredText.includes("super-secret"), false);
  });
});

describe("ttlock callback retry cron route auth", () => {
  const envBackup = { ...process.env };

  afterEach(() => {
    process.env = { ...envBackup };
  });

  it("7: GET va POST bir xil fail-closed himoya", () => {
    const routeSrc = readFileSync(
      join(repoRoot, "src/app/api/cron/ttlock-callback-retry/route.ts"),
      "utf8"
    );
    assert.match(routeSrc, /assertFailClosedCronAuth/);
    assert.match(routeSrc, /handleCallbackRetryCron/);
    assert.match(routeSrc, /export async function GET/);
    assert.match(routeSrc, /export async function POST/);
    assert.match(routeSrc, /return handleCallbackRetryCron\(req/);
  });

  it("1–2 route: secret yo‘q → processor chaqirilmaydi", async () => {
    delete process.env.CRON_SECRET;
    process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";

    for (const handler of [GET, POST]) {
      const res = await handler(
        new NextRequest("http://localhost/api/cron/ttlock-callback-retry", {
          headers: { authorization: "Bearer anything" },
        })
      );
      assert.equal(res.status, 503);
      const body = await jsonBody(res);
      assert.equal(body.error?.code, CRON_NOT_CONFIGURED_CODE);
    }
  });

  it("3–4 route: noto‘g‘ri auth → processor chaqirilmaydi", async () => {
    process.env.CRON_SECRET = "route-test-secret";
    process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";

    const noHeader = await GET(
      new NextRequest("http://localhost/api/cron/ttlock-callback-retry")
    );
    assert.equal(noHeader.status, 403);

    const wrong = await GET(
      new NextRequest("http://localhost/api/cron/ttlock-callback-retry", {
        headers: { authorization: "Bearer wrong-value" },
      })
    );
    assert.equal(wrong.status, 403);
  });

  it("6 sweep: to‘g‘ri deps → processor bir marta chaqiriladi", async () => {
    let claimCalls = 0;
    let processCalls = 0;

    const result = await runCallbackRetrySweep("test", {
      claimBatch: async () => {
        claimCalls += 1;
        return claimCalls === 1 ? ["inbox-abc"] : [];
      },
      processInbox: async () => {
        processCalls += 1;
        return true;
      },
    });

    assert.equal(claimCalls, 1);
    assert.equal(processCalls, 1);
    assert.equal(result.claimed, 1);
    assert.equal(result.processed, 1);
  });

  it("6b route: to‘g‘ri bearer auth o‘tadi (503 emas, 403 emas)", async () => {
    process.env.CRON_SECRET = "route-test-secret";
    delete process.env.DATABASE_URL;
    delete process.env.POSTGRES_PRISMA_URL;

    const res = await POST(
      new NextRequest("http://localhost/api/cron/ttlock-callback-retry", {
        method: "POST",
        headers: { authorization: "Bearer route-test-secret" },
      })
    );
    assert.notEqual(res.status, 403);
    const body = await jsonBody(res);
    assert.notEqual(body.error?.code, CRON_NOT_CONFIGURED_CODE);
    assert.equal(JSON.stringify(body).includes("route-test-secret"), false);
  });

  it("9: callback public endpoint buzilmagan", () => {
    const callbackRoute = readFileSync(
      join(repoRoot, "src/app/api/integrations/ttlock/callback/route.ts"),
      "utf8"
    );
    assert.equal(callbackRoute.includes("assertFailClosedCronAuth"), false);
    assert.equal(callbackRoute.includes("requireUser"), false);
  });

  it("10: boshqa integration endpointlar auth talab qiladi", () => {
    const status = readFileSync(
      join(repoRoot, "src/app/api/integrations/ttlock/status/route.ts"),
      "utf8"
    );
    assert.match(status, /requireUser/);
  });
});
