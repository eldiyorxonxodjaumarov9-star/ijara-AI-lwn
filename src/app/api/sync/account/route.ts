import { NextResponse } from "next/server";

import type { AccountSyncState } from "@/lib/cloud/account-state";
import {
  detectSyncBackend,
  readAccountState,
  writeAccountState,
} from "@/lib/cloud/sync-storage";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const email = searchParams.get("email")?.trim().toLowerCase();
  if (!email) {
    return NextResponse.json({ error: "Email kerak" }, { status: 400 });
  }

  if (detectSyncBackend() === "none") {
    return NextResponse.json({ error: "Bulut sozlanmagan" }, { status: 501 });
  }

  try {
    const state = await readAccountState(email);
    if (!state) {
      return NextResponse.json(null, { status: 404 });
    }
    return NextResponse.json(state);
  } catch {
    return NextResponse.json({ error: "O'qish xatosi" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  if (detectSyncBackend() === "none") {
    return NextResponse.json({ error: "Bulut sozlanmagan" }, { status: 501 });
  }

  try {
    const body = (await req.json()) as {
      email?: string;
      state?: AccountSyncState;
    };
    const email = body.email?.trim().toLowerCase();
    if (!email || !body.state) {
      return NextResponse.json({ error: "Ma'lumot noto'g'ri" }, { status: 400 });
    }

    await writeAccountState(email, body.state);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof Error && err.message === "SYNC_NOT_CONFIGURED") {
      return NextResponse.json({ error: "Bulut sozlanmagan" }, { status: 501 });
    }
    return NextResponse.json({ error: "Saqlash xatosi" }, { status: 500 });
  }
}

export async function HEAD() {
  const backend = detectSyncBackend();
  return new NextResponse(null, {
    status: backend === "none" ? 501 : 200,
    headers: { "X-Sync-Backend": backend },
  });
}
