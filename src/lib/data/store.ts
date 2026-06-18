"use client";

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";

import { db, isFirebaseConfigured } from "@/lib/firebase/config";
import { SEED_MAP } from "@/lib/data/seed";
import {
  apiFetch,
  API_URL,
  isApiConfigured,
  tokenStore,
} from "@/lib/api/client";
import { MAPPERS } from "@/lib/api/mappers";
import type { CollectionEntity } from "@/types";

export type CollectionName =
  | "properties"
  | "tenants"
  | "contracts"
  | "payments"
  | "expenses"
  | "maintenance"
  | "notifications"
  | "clients"
  | "analyses";

export interface CrudApi<T extends CollectionEntity> {
  subscribe: (cb: (items: T[]) => void) => () => void;
  list: () => Promise<T[]>;
  create: (data: Omit<T, "id" | "createdAt"> & { createdAt?: string }) => Promise<string>;
  update: (id: string, data: Partial<T>) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

const STORAGE_PREFIX = "arendahub:";
const DATA_VERSION = "2"; // v2: mulklarga namuna rasmlar qo'shildi
const VERSION_KEY = "arendahub:data-version";

function ensureDemoDataVersion() {
  if (typeof window === "undefined") return;
  const current = window.localStorage.getItem(VERSION_KEY);
  if (current === DATA_VERSION) return;
  for (const name of Object.keys(SEED_MAP) as CollectionName[]) {
    window.localStorage.removeItem(STORAGE_PREFIX + name);
  }
  window.localStorage.setItem(VERSION_KEY, DATA_VERSION);
}

function readLocal<T>(name: CollectionName): T[] {
  ensureDemoDataVersion();
  if (typeof window === "undefined") return (SEED_MAP[name] as T[]) ?? [];
  const raw = window.localStorage.getItem(STORAGE_PREFIX + name);
  const seeded = (SEED_MAP[name] as T[]) ?? [];
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as T[];
      // Demo AI tahlillari: bo'sh bo'lsa seed ko'rsatiladi
      if (name === "analyses" && parsed.length === 0 && seeded.length > 0) {
        writeLocal(name, seeded);
        return seeded;
      }
      return parsed;
    } catch {
      // fallthrough to seed
    }
  }
  window.localStorage.setItem(STORAGE_PREFIX + name, JSON.stringify(seeded));
  return seeded;
}

function writeLocal<T>(name: CollectionName, items: T[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_PREFIX + name, JSON.stringify(items));
}

const listeners: Record<string, Set<() => void>> = {};

function notify(name: CollectionName) {
  listeners[name]?.forEach((fn) => fn());
}

function sortByCreatedAt<T extends CollectionEntity>(items: T[]) {
  return [...items].sort(
    (a, b) =>
      new Date(b.createdAt ?? 0).getTime() -
      new Date(a.createdAt ?? 0).getTime()
  );
}

function createLocalApi<T extends CollectionEntity>(
  name: CollectionName
): CrudApi<T> {
  return {
    subscribe(cb) {
      listeners[name] ??= new Set();
      const handler = () => cb(sortByCreatedAt(readLocal<T>(name)));
      listeners[name].add(handler);
      handler();
      return () => {
        listeners[name]?.delete(handler);
      };
    },
    async list() {
      return sortByCreatedAt(readLocal<T>(name));
    },
    async create(data) {
      const items = readLocal<T>(name);
      const entity = {
        ...data,
        id:
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : Math.random().toString(36).slice(2),
        createdAt: data.createdAt ?? new Date().toISOString(),
      } as unknown as T;
      writeLocal(name, [entity, ...items]);
      notify(name);
      return entity.id;
    },
    async update(id, data) {
      const items = readLocal<T>(name).map((item) =>
        item.id === id ? { ...item, ...data } : item
      );
      writeLocal(name, items);
      notify(name);
    },
    async remove(id) {
      writeLocal(
        name,
        readLocal<T>(name).filter((item) => item.id !== id)
      );
      notify(name);
    },
  };
}

function createFirestoreApi<T extends CollectionEntity>(
  name: CollectionName
): CrudApi<T> {
  return {
    subscribe(cb) {
      const q = query(collection(db!, name), orderBy("createdAt", "desc"));
      return onSnapshot(
        q,
        (snap) => {
          const items = snap.docs.map(
            (d) => ({ id: d.id, ...d.data() }) as unknown as T
          );
          cb(items);
        },
        () => cb([])
      );
    },
    async list() {
      const q = query(collection(db!, name), orderBy("createdAt", "desc"));
      const snap = await getDocs(q);
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as unknown as T);
    },
    async create(data) {
      const ref = await addDoc(collection(db!, name), {
        ...data,
        createdAt: data.createdAt ?? new Date().toISOString(),
        serverCreatedAt: serverTimestamp(),
      });
      return ref.id;
    },
    async update(id, data) {
      await updateDoc(doc(db!, name, id), data as Record<string, unknown>);
    },
    async remove(id) {
      await deleteDoc(doc(db!, name, id));
    },
  };
}

// ============ API (NestJS backend) rejimi ============

const apiCache: Partial<Record<CollectionName, CollectionEntity[]>> = {};
const apiListeners: Record<string, Set<(items: CollectionEntity[]) => void>> =
  {};
const sseStarted: Partial<Record<CollectionName, boolean>> = {};

function notifyApi(name: CollectionName) {
  const items = apiCache[name] ?? [];
  apiListeners[name]?.forEach((cb) => cb(items));
}

async function refetchApi(name: CollectionName) {
  const mapper = MAPPERS[name];
  if (!mapper) return;
  try {
    const res = await apiFetch<unknown>(
      `${mapper.path}?limit=100&sortBy=createdAt&order=desc`
    );
    const rawList = Array.isArray(res)
      ? res
      : ((res as { data?: unknown[] })?.data ?? []);
    const items = (rawList as Record<string, unknown>[])
      .map((item) => mapper.fromApi(item) as unknown as CollectionEntity)
      .sort(
        (a, b) =>
          new Date(b.createdAt ?? 0).getTime() -
          new Date(a.createdAt ?? 0).getTime()
      );
    apiCache[name] = items;
    notifyApi(name);
  } catch {
    apiCache[name] = apiCache[name] ?? [];
    notifyApi(name);
  }
}

function startNotificationsSse(name: CollectionName) {
  if (name !== "notifications" || sseStarted[name]) return;
  if (typeof window === "undefined" || typeof EventSource === "undefined")
    return;
  sseStarted[name] = true;
  try {
    const source = new EventSource(`${API_URL}/notifications/stream`);
    source.onmessage = () => {
      void refetchApi("notifications");
    };
    source.onerror = () => {
      /* brauzer avtomatik qayta ulanadi */
    };
  } catch {
    // SSE qo'llab-quvvatlanmasa, faqat mutatsiyalardan keyin yangilanadi
  }
}

function createApiCollection<T extends CollectionEntity>(
  name: CollectionName
): CrudApi<T> {
  const mapper = MAPPERS[name];
  if (!mapper) {
    throw new Error(`API mapper topilmadi: ${name}`);
  }

  return {
    subscribe(cb) {
      apiListeners[name] ??= new Set();
      const handler = (items: CollectionEntity[]) =>
        cb(items as unknown as T[]);
      apiListeners[name].add(handler);
      if (apiCache[name]) handler(apiCache[name]!);
      void refetchApi(name);
      startNotificationsSse(name);
      return () => {
        apiListeners[name]?.delete(handler);
      };
    },
    async list() {
      await refetchApi(name);
      return (apiCache[name] ?? []) as unknown as T[];
    },
    async create(data) {
      const created = await apiFetch<Record<string, unknown>>(mapper.path, {
        method: "POST",
        body: mapper.toCreate(data as Record<string, unknown>),
      });
      await refetchApi(name);
      return String(created?.id ?? "");
    },
    async update(id, data) {
      // Notifications: "o'qildi" maxsus endpoint
      if (name === "notifications" && (data as { read?: boolean }).read) {
        await apiFetch(`/notifications/${id}/read`, { method: "PATCH" });
      } else {
        await apiFetch(`${mapper.path}/${id}`, {
          method: "PATCH",
          body: mapper.toUpdate(data as Record<string, unknown>),
        });
      }
      await refetchApi(name);
    },
    async remove(id) {
      await apiFetch(`${mapper.path}/${id}`, { method: "DELETE" });
      await refetchApi(name);
    },
  };
}

// ============ Tanlash ============

const cache: Partial<Record<CollectionName, CrudApi<CollectionEntity>>> = {};

export function getCollectionApi<T extends CollectionEntity>(
  name: CollectionName
): CrudApi<T> {
  if (!cache[name]) {
    // CRM klientlar hozircha faqat lokal (demo) rejimda
    if (name === "clients" || name === "analyses") {
      cache[name] = createLocalApi<CollectionEntity>(name);
      return cache[name] as unknown as CrudApi<T>;
    }
    if (isApiConfigured && tokenStore) {
      cache[name] = createApiCollection<CollectionEntity>(name);
    } else if (isFirebaseConfigured && db) {
      cache[name] = createFirestoreApi<CollectionEntity>(name);
    } else {
      cache[name] = createLocalApi<CollectionEntity>(name);
    }
  }
  return cache[name] as unknown as CrudApi<T>;
}
