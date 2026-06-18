import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import { Redis } from "@upstash/redis";
import { head, put } from "@vercel/blob";

import type { AccountSyncState } from "@/lib/cloud/account-state";

export type SyncBackend = "neon" | "redis" | "blob" | "none";

let neonSql: NeonQueryFunction<false, false> | null = null;
let neonReady = false;

function getNeon() {
  const url =
    process.env.DATABASE_URL ??
    process.env.POSTGRES_URL ??
    process.env.NEON_DATABASE_URL;
  if (!url) return null;
  if (!neonSql) neonSql = neon(url);
  return neonSql;
}

async function ensureNeonTable() {
  if (neonReady) return;
  const sql = getNeon();
  if (!sql) return;
  await sql`
    CREATE TABLE IF NOT EXISTS account_sync (
      email TEXT PRIMARY KEY,
      state JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  neonReady = true;
}

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

function blobPath(email: string) {
  return `arendahub-sync/${email.toLowerCase()}.json`;
}

export function detectSyncBackend(): SyncBackend {
  if (getNeon()) return "neon";
  if (getRedis()) return "redis";
  if (process.env.BLOB_READ_WRITE_TOKEN) return "blob";
  return "none";
}

export async function readAccountState(
  email: string
): Promise<AccountSyncState | null> {
  const key = storageKey(email);

  const sql = getNeon();
  if (sql) {
    await ensureNeonTable();
    const rows = await sql`
      SELECT state FROM account_sync WHERE email = ${email.toLowerCase()}
    `;
    const row = rows[0] as { state: AccountSyncState | string } | undefined;
    if (!row?.state) return null;
    const state =
      typeof row.state === "string"
        ? (JSON.parse(row.state) as AccountSyncState)
        : row.state;
    return state?.updatedAt ? state : null;
  }

  const redis = getRedis();
  if (redis) {
    const state = await redis.get<AccountSyncState>(key);
    return state?.updatedAt ? state : null;
  }

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      const meta = await head(blobPath(email));
      const res = await fetch(meta.url, { cache: "no-store" });
      if (!res.ok) return null;
      const state = (await res.json()) as AccountSyncState;
      return state?.updatedAt ? state : null;
    } catch {
      return null;
    }
  }

  return null;
}

export async function writeAccountState(
  email: string,
  state: AccountSyncState
): Promise<void> {
  const key = storageKey(email);
  const payload: AccountSyncState = {
    ...state,
    updatedAt: new Date().toISOString(),
  };

  const sql = getNeon();
  if (sql) {
    await ensureNeonTable();
    await sql`
      INSERT INTO account_sync (email, state, updated_at)
      VALUES (${email.toLowerCase()}, ${JSON.stringify(payload)}::jsonb, NOW())
      ON CONFLICT (email) DO UPDATE SET
        state = EXCLUDED.state,
        updated_at = NOW()
    `;
    return;
  }

  const redis = getRedis();
  if (redis) {
    await redis.set(key, payload);
    return;
  }

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    await put(blobPath(email), JSON.stringify(payload), {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json",
    });
    return;
  }

  throw new Error("SYNC_NOT_CONFIGURED");
}
