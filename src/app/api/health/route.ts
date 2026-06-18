import { NextResponse } from "next/server";

import { isDatabaseConfigured, prisma } from "@/lib/api-server/prisma";

export async function GET() {
  const backend = process.env.BACKEND_URL?.replace(/\/$/, "");

  if (isDatabaseConfigured()) {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return NextResponse.json({
        status: "ok",
        service: "arendahub-api",
        mode: "embedded",
        timestamp: new Date().toISOString(),
      });
    } catch {
      return NextResponse.json(
        { status: "offline", error: "PostgreSQL ulanmagan" },
        { status: 502 }
      );
    }
  }

  if (backend) {
    try {
      const res = await fetch(`${backend}/health`, { cache: "no-store" });
      if (!res.ok) {
        return NextResponse.json(
          { status: "offline", error: "Backend javob bermadi" },
          { status: 502 }
        );
      }
      const data = await res.json();
      return NextResponse.json({ status: "ok", mode: "proxy", ...data });
    } catch {
      return NextResponse.json(
        { status: "offline", error: "Backendga ulanib bo'lmadi" },
        { status: 502 }
      );
    }
  }

  return NextResponse.json(
    { status: "offline", error: "DATABASE_URL yoki BACKEND_URL kerak" },
    { status: 501 }
  );
}
