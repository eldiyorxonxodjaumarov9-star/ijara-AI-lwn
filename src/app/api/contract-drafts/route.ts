import { NextRequest } from "next/server";

import { requireUser } from "@/lib/api-server/auth";
import {
  createAndSendContractRequest,
} from "@/lib/api-server/contract-draft/create";
import {
  assertContractStaff,
  listContractRequests,
  listEligibleTenants,
  toPublicRequestView,
} from "@/lib/api-server/contract-draft/queries";
import { fail, ok } from "@/lib/api-server/http";
import { isDatabaseConfigured } from "@/lib/api-server/prisma";

export async function GET(req: NextRequest) {
  if (!isDatabaseConfigured()) return fail("DATABASE_URL sozlanmagan", 501);
  const auth = await requireUser(req);
  if (auth.error) return auth.error;
  try {
    assertContractStaff(auth.user);
    const url = new URL(req.url);
    if (url.searchParams.get("eligible") === "1") {
      const tenants = await listEligibleTenants();
      return ok(tenants);
    }
    const rows = await listContractRequests();
    return ok(rows.map((r) => toPublicRequestView(r)));
  } catch (err) {
    const status = (err as { status?: number }).status ?? 500;
    return fail(
      err instanceof Error ? err.message : "So‘rovlarni o‘qib bo‘lmadi",
      status
    );
  }
}

export async function POST(req: NextRequest) {
  if (!isDatabaseConfigured()) return fail("DATABASE_URL sozlanmagan", 501);
  const auth = await requireUser(req);
  if (auth.error) return auth.error;
  try {
    const body = await req.json();
    const result = await createAndSendContractRequest(auth.user, body);
    return ok(result, 201);
  } catch (err) {
    const status = (err as { status?: number }).status ?? 400;
    return fail(
      err instanceof Error ? err.message : "So‘rov yaratib bo‘lmadi",
      status,
      (err as { code?: string }).code
    );
  }
}
