import { NextRequest } from "next/server";

import { requireUser } from "@/lib/api-server/auth";
import {
  loadCompanyLessorRow,
  missingLessorLabels,
} from "@/lib/api-server/contract-draft/lessor";
import { assertContractStaff } from "@/lib/api-server/contract-draft/queries";
import { LESSOR_REQUIRED_FIELDS } from "@/lib/api-server/contract-draft/validation";
import { fail, ok } from "@/lib/api-server/http";
import { isDatabaseConfigured, prisma } from "@/lib/api-server/prisma";

function publicLessorView(row: Record<string, unknown>) {
  const out: Record<string, string> = {};
  for (const k of LESSOR_REQUIRED_FIELDS) {
    out[k] = String(row[k] ?? "").trim();
  }
  return {
    ...out,
    missing: missingLessorLabels(row),
  };
}

export async function GET(req: NextRequest) {
  if (!isDatabaseConfigured()) return fail("DATABASE_URL sozlanmagan", 501);
  const auth = await requireUser(req);
  if (auth.error) return auth.error;
  try {
    assertContractStaff(auth.user);
    const row = await loadCompanyLessorRow();
    return ok(publicLessorView(row as unknown as Record<string, unknown>));
  } catch (err) {
    const status = (err as { status?: number }).status ?? 500;
    return fail(err instanceof Error ? err.message : "Xato", status);
  }
}

export async function PUT(req: NextRequest) {
  if (!isDatabaseConfigured()) return fail("DATABASE_URL sozlanmagan", 501);
  const auth = await requireUser(req);
  if (auth.error) return auth.error;
  try {
    assertContractStaff(auth.user);
    const body = (await req.json()) as Record<string, unknown>;
    const data: Record<string, string | null> = {};
    for (const k of LESSOR_REQUIRED_FIELDS) {
      if (k in body) {
        const v = String(body[k] ?? "").trim();
        data[k] = v || null;
      }
    }
    const existing = await loadCompanyLessorRow();
    const updated = await prisma.company.update({
      where: { id: existing.id },
      data,
    });
    return ok(publicLessorView(updated as unknown as Record<string, unknown>));
  } catch (err) {
    const status = (err as { status?: number }).status ?? 500;
    return fail(err instanceof Error ? err.message : "Saqlab bo‘lmadi", status);
  }
}
