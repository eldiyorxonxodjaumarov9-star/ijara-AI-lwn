import { NextResponse } from "next/server";

/** Vercel frontend → ahost backend holatini tekshirish */
export async function GET() {
  const backend = process.env.BACKEND_URL?.replace(/\/$/, "");
  if (!backend) {
    return NextResponse.json(
      { status: "offline", error: "BACKEND_URL sozlanmagan" },
      { status: 501 }
    );
  }

  try {
    const res = await fetch(`${backend}/health`, { cache: "no-store" });
    if (!res.ok) {
      return NextResponse.json(
        { status: "offline", error: "Backend javob bermadi" },
        { status: 502 }
      );
    }
    const data = await res.json();
    return NextResponse.json({ status: "ok", ...data });
  } catch {
    return NextResponse.json(
      { status: "offline", error: "Backendga ulanib bo'lmadi" },
      { status: 502 }
    );
  }
}
