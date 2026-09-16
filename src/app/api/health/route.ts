import { NextResponse } from "next/server";

import { isDatabaseConfigured, prisma } from "@/lib/api-server/prisma";

/** Public probe — minimal payload only (no service names, counts, or stack traces). */
export async function GET() {
  const backend = process.env.BACKEND_URL?.replace(/\/$/, "");

  if (isDatabaseConfigured()) {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return NextResponse.json({ ok: true });
    } catch {
      return NextResponse.json({ ok: false }, { status: 502 });
    }
  }

  if (backend) {
    try {
      const res = await fetch(`${backend}/health`, { cache: "no-store" });
      if (!res.ok) {
        return NextResponse.json({ ok: false }, { status: 502 });
      }
      return NextResponse.json({ ok: true });
    } catch {
      return NextResponse.json({ ok: false }, { status: 502 });
    }
  }

  return NextResponse.json({ ok: false }, { status: 501 });
}
