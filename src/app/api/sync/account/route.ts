import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

import type { AccountSyncState } from "@/lib/cloud/account-state";

function getRedis() {
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

function storageKey(email: string) {
  return `arendahub:account:${email.toLowerCase()}`;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const email = searchParams.get("email")?.trim().toLowerCase();
  if (!email) {
    return NextResponse.json({ error: "Email kerak" }, { status: 400 });
  }

  const redis = getRedis();
  if (!redis) {
    return NextResponse.json({ error: "Redis sozlanmagan" }, { status: 501 });
  }

  try {
    const state = await redis.get<AccountSyncState>(storageKey(email));
    if (!state) {
      return NextResponse.json(null, { status: 404 });
    }
    return NextResponse.json(state);
  } catch {
    return NextResponse.json({ error: "O'qish xatosi" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  const redis = getRedis();
  if (!redis) {
    return NextResponse.json({ error: "Redis sozlanmagan" }, { status: 501 });
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

    const state: AccountSyncState = {
      ...body.state,
      updatedAt: new Date().toISOString(),
    };
    await redis.set(storageKey(email), state);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Saqlash xatosi" }, { status: 500 });
  }
}
