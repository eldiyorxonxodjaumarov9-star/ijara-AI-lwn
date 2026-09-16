import { NextRequest, NextResponse } from "next/server";

import { requireUser } from "@/lib/api-server/auth";
import { fail } from "@/lib/api-server/http";
import { sanitizeAccountSyncState } from "@/lib/cloud/account-state-sanitize";
import type { AccountSyncState } from "@/lib/cloud/account-state";
import {
  detectSyncBackend,
  readAccountState,
  writeAccountState,
} from "@/lib/cloud/sync-storage";

export async function GET(req: NextRequest) {
  const auth = await requireUser(req);
  if (auth.error) return auth.error;

  if (detectSyncBackend() === "none") {
    return fail("Bulut sozlanmagan", 501);
  }

  try {
    const state = await readAccountState(auth.user.email);
    if (!state) {
      return NextResponse.json(null, { status: 404 });
    }
    return NextResponse.json(sanitizeAccountSyncState(state));
  } catch {
    return fail("O'qish xatosi", 500);
  }
}

export async function PUT(req: NextRequest) {
  const auth = await requireUser(req);
  if (auth.error) return auth.error;

  if (detectSyncBackend() === "none") {
    return fail("Bulut sozlanmagan", 501);
  }

  try {
    const body = (await req.json()) as {
      email?: string;
      state?: AccountSyncState;
    };

    if (body.email?.trim()) {
      const requested = body.email.trim().toLowerCase();
      if (requested !== auth.user.email.toLowerCase()) {
        return fail("Ruxsat yo'q", 403);
      }
    }

    if (!body.state) {
      return fail("Ma'lumot noto'g'ri", 400);
    }

    await writeAccountState(
      auth.user.email,
      sanitizeAccountSyncState(body.state)
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof Error && err.message === "SYNC_NOT_CONFIGURED") {
      return fail("Bulut sozlanmagan", 501);
    }
    return fail("Saqlash xatosi", 500);
  }
}

export async function HEAD() {
  const backend = detectSyncBackend();
  return new NextResponse(null, {
    status: backend === "none" ? 501 : 200,
    headers: { "X-Sync-Backend": backend },
  });
}
