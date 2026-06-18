import {
  accountSyncKey,
  SYNC_COLLECTIONS,
  type AccountSyncState,
} from "@/lib/cloud/account-state";
import {
  pullFromFirestore,
  pushToFirestore,
} from "@/lib/cloud/firestore-sync";
import type { CollectionName } from "@/lib/data/store";
import type { AppUser } from "@/types";

const STORAGE_PREFIX = "arendahub:";
const DEMO_USERS_KEY = "arendahub:users";
const DEMO_SESSION_KEY = "arendahub:session";
const SYNC_META_KEY = "arendahub:sync-updated-at";

function readDemoUsers(): (AppUser & { password: string })[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(DEMO_USERS_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as (AppUser & { password: string })[];
  } catch {
    return [];
  }
}

function readLocalCollection<T>(name: CollectionName): T[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(STORAGE_PREFIX + name);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as T[];
  } catch {
    return [];
  }
}

export function collectLocalAccountState(): AccountSyncState {
  const profileRaw =
    typeof window !== "undefined"
      ? window.localStorage.getItem(DEMO_SESSION_KEY)
      : null;
  let profile: AppUser | null = null;
  if (profileRaw) {
    try {
      profile = JSON.parse(profileRaw) as AppUser;
    } catch {
      profile = null;
    }
  }

  const collections: Partial<Record<CollectionName, unknown[]>> = {};
  for (const name of SYNC_COLLECTIONS) {
    collections[name] = readLocalCollection(name);
  }

  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    profile,
    demoUsers: readDemoUsers(),
    collections,
  };
}

export function applyAccountState(state: AccountSyncState) {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(DEMO_USERS_KEY, JSON.stringify(state.demoUsers));

  if (state.profile) {
    window.localStorage.setItem(
      DEMO_SESSION_KEY,
      JSON.stringify(state.profile)
    );
  }

  for (const name of SYNC_COLLECTIONS) {
    const items = state.collections[name];
    if (items) {
      window.localStorage.setItem(
        STORAGE_PREFIX + name,
        JSON.stringify(items)
      );
    }
  }

  window.localStorage.setItem(SYNC_META_KEY, state.updatedAt);
}

export function getLocalSyncUpdatedAt(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(SYNC_META_KEY);
}

export async function pullAccountState(
  email: string
): Promise<AccountSyncState | null> {
  const res = await fetch(
    `/api/sync/account?email=${encodeURIComponent(accountSyncKey(email))}`,
    { cache: "no-store" }
  );
  if (res.ok) {
    const data = (await res.json()) as AccountSyncState | null;
    return data?.updatedAt ? data : null;
  }
  if (res.status === 501 || res.status === 404) {
    return pullFromFirestore(email);
  }
  return null;
}

export async function pushAccountState(email: string, state?: AccountSyncState) {
  const payload = state ?? collectLocalAccountState();
  const res = await fetch("/api/sync/account", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: accountSyncKey(email),
      state: payload,
    }),
  });
  if (res.ok) {
    window.localStorage.setItem(SYNC_META_KEY, payload.updatedAt);
    return true;
  }
  if (res.status === 501) {
    const ok = await pushToFirestore(email, {
      ...payload,
      updatedAt: new Date().toISOString(),
    });
    if (ok) {
      window.localStorage.setItem(SYNC_META_KEY, payload.updatedAt);
    }
    return ok;
  }
  return false;
}

let pushTimer: ReturnType<typeof setTimeout> | null = null;

export function scheduleCloudPush(email: string | undefined) {
  if (!email || typeof window === "undefined") return;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    void pushAccountState(email);
  }, 1200);
}

export async function mergeCloudOnLogin(email: string): Promise<AppUser | null> {
  const remote = await pullAccountState(email);
  const localAt = getLocalSyncUpdatedAt();
  const remoteAt = remote?.updatedAt ?? null;

  if (remote && (!localAt || new Date(remoteAt!) >= new Date(localAt))) {
    applyAccountState(remote);
    window.dispatchEvent(new Event("arendahub:sync-applied"));
    return remote.profile;
  }

  await pushAccountState(email);
  return collectLocalAccountState().profile;
}

export async function refreshFromCloud(email: string | undefined) {
  if (!email) return;
  const remote = await pullAccountState(email);
  const localAt = getLocalSyncUpdatedAt();
  if (
    remote &&
    (!localAt || new Date(remote.updatedAt) > new Date(localAt))
  ) {
    applyAccountState(remote);
    window.dispatchEvent(new Event("arendahub:sync-applied"));
  }
}
