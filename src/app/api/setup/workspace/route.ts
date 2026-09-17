import { NextResponse } from "next/server";

import { fail, ok } from "@/lib/api-server/http";
import { isDatabaseConfigured, prisma } from "@/lib/api-server/prisma";
import { ensureWorkspaceBootstrap } from "@/lib/api-server/workspace";
import { applyWorkspaceSchemaAdditive } from "@/lib/api-server/workspace-schema-sql";

/**
 * Production-safe workspace schema + backfill.
 * Additive only — never DROP / DELETE.
 * Auth: x-setup-secret === SETUP_SECRET
 */
export async function POST(req: Request) {
  const secret = req.headers.get("x-setup-secret");
  const expected = process.env.SETUP_SECRET;
  if (!expected || secret !== expected) {
    return fail("Ruxsat yo'q", 403);
  }

  if (!isDatabaseConfigured()) {
    return fail("DATABASE_URL sozlanmagan", 501);
  }

  try {
    const schemaResult = await applyWorkspaceSchemaAdditive(prisma);
    const workspace = await ensureWorkspaceBootstrap();
    return ok({
      status: "ready",
      schema: schemaResult,
      workspaceId: workspace.id,
      workspaceName: workspace.name,
      isInternal: workspace.isInternal,
    });
  } catch (err) {
    console.error("[setup/workspace]", err);
    return fail("Workspace setup xatosi", 500);
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: "/api/setup/workspace",
    method: "POST",
    note: "Additive workspace schema + internal backfill. Requires x-setup-secret.",
  });
}
