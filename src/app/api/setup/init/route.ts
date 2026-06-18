import { NextResponse } from "next/server";
import { execSync } from "node:child_process";
import path from "node:path";

import { isDatabaseConfigured, prisma } from "@/lib/api-server/prisma";
import { ok, fail } from "@/lib/api-server/http";

/** Bir marta: jadvallar + demo ma'lumotlar (Vercel/Neon) */
export async function POST(req: Request) {
  const secret = req.headers.get("x-setup-secret");
  const expected = process.env.SETUP_SECRET ?? process.env.JWT_ACCESS_SECRET;
  if (!expected || secret !== expected) {
    return fail("Ruxsat yo'q", 403);
  }

  if (!isDatabaseConfigured()) {
    return fail("DATABASE_URL sozlanmagan", 501);
  }

  try {
    const schema = path.join(process.cwd(), "server", "prisma", "schema.prisma");
    execSync(`npx prisma db push --schema="${schema}" --accept-data-loss`, {
      stdio: "pipe",
      env: process.env,
    });

    const count = await prisma.user.count();
    if (count === 0) {
      execSync("npm run db:seed", { stdio: "pipe", env: process.env });
    }

    return ok({
      status: "ready",
      users: await prisma.user.count(),
      properties: await prisma.property.count(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Setup xatosi";
    return fail(message, 500);
  }
}

export async function GET() {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ ready: false, reason: "no_database" });
  }
  try {
    await prisma.$queryRaw`SELECT 1`;
    const users = await prisma.user.count();
    return NextResponse.json({ ready: true, users });
  } catch {
    return NextResponse.json({ ready: false, reason: "db_error" });
  }
}
