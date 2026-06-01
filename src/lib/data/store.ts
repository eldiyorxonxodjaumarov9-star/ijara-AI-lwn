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
import type { CollectionEntity } from "@/types";

export type CollectionName =
  | "properties"
  | "tenants"
  | "contracts"
  | "payments"
  | "expenses"
  | "maintenance"
  | "notifications";

export interface CrudApi<T extends CollectionEntity> {
  subscribe: (cb: (items: T[]) => void) => () => void;
  list: () => Promise<T[]>;
  create: (data: Omit<T, "id" | "createdAt"> & { createdAt?: string }) => Promise<string>;
  update: (id: string, data: Partial<T>) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

const STORAGE_PREFIX = "arendahub:";

function readLocal<T>(name: CollectionName): T[] {
  if (typeof window === "undefined") return (SEED_MAP[name] as T[]) ?? [];
  const raw = window.localStorage.getItem(STORAGE_PREFIX + name);
  if (raw) {
    try {
      return JSON.parse(raw) as T[];
    } catch {
      // fallthrough to seed
    }
  }
  const seeded = (SEED_MAP[name] as T[]) ?? [];
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

const cache: Partial<Record<CollectionName, CrudApi<CollectionEntity>>> = {};

export function getCollectionApi<T extends CollectionEntity>(
  name: CollectionName
): CrudApi<T> {
  if (!cache[name]) {
    cache[name] = (
      isFirebaseConfigured && db
        ? createFirestoreApi<CollectionEntity>(name)
        : createLocalApi<CollectionEntity>(name)
    );
  }
  return cache[name] as unknown as CrudApi<T>;
}
