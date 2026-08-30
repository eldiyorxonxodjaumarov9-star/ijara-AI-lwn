import type { User } from "@prisma/client";
import { NextRequest } from "next/server";

import {
  findLwnPropertyOrFail,
  mapLockSettings,
} from "@/lib/api-server/lwn-room-lock";
import { requireUser } from "@/lib/api-server/auth";
import { fail, ok } from "@/lib/api-server/http";
import { isDatabaseConfigured, prisma } from "@/lib/api-server/prisma";
import { TtlockError } from "@/lib/api-server/ttlock/errors";
import {
  assignTtlockLockToRoom,
  listAssignableTtlockLocks,
  mapUniqueToAlreadyAssigned,
  unassignTtlockLockFromRoom,
} from "@/lib/api-server/ttlock/room-lock-assign";
import { isTtlockProviderName } from "@/lib/ttlock-room-lock-view";

type Ctx = { params: Promise<{ propertyId: string }> };

const NOTES_MAX = 2000;

function normalizeNotes(value: unknown): string | null {
  if (value == null) return null;
  const text = String(value).trim();
  if (!text) return null;
  return text.slice(0, NOTES_MAX);
}

function failFromTtlock(err: unknown) {
  if (err instanceof TtlockError) {
    return fail(err.message, err.httpStatus, err.code);
  }
  const mapped = mapUniqueToAlreadyAssigned(err);
  if (mapped) {
    return fail(mapped.message, mapped.httpStatus, mapped.code);
  }
  return fail("Qulf sozlamalarini saqlab bo'lmadi", 500);
}

async function loadMappedSettings(propertyId: string, user: User) {
  const row = await prisma.roomLockSettings.findUnique({
    where: { propertyId },
  });
  if (!row) return null;

  const base = mapLockSettings(row);
  if (!row.ttlockCachedLockId) {
    return { ...base, linkedLock: null };
  }

  try {
    const locks = await listAssignableTtlockLocks(user, propertyId);
    const linkedLock =
      locks.find((l) => l.id === row.ttlockCachedLockId) ?? null;
    return { ...base, linkedLock };
  } catch {
    return { ...base, linkedLock: null };
  }
}

export async function GET(req: NextRequest, ctx: Ctx) {
  if (!isDatabaseConfigured()) return fail("DATABASE_URL sozlanmagan", 501);
  const auth = await requireUser(req);
  if (auth.error) return auth.error;

  const { propertyId } = await ctx.params;
  const found = await findLwnPropertyOrFail(propertyId);
  if ("error" in found && found.error) return found.error;

  return ok(await loadMappedSettings(propertyId, auth.user));
}

export async function PUT(req: NextRequest, ctx: Ctx) {
  if (!isDatabaseConfigured()) return fail("DATABASE_URL sozlanmagan", 501);
  const auth = await requireUser(req);
  if (auth.error) return auth.error;

  const { propertyId } = await ctx.params;
  const found = await findLwnPropertyOrFail(propertyId);
  if ("error" in found && found.error) return found.error;

  try {
    const body = (await req.json()) as Record<string, unknown>;
    const notes = normalizeNotes(body.notes);
    const providerRaw = String(body.providerName ?? "").trim();
    const isTtlock = isTtlockProviderName(providerRaw);
    const hasTtlockField = "ttlockCachedLockId" in body;
    const ttlockRaw =
      body.ttlockCachedLockId == null
        ? null
        : String(body.ttlockCachedLockId).trim() || null;

    // Client lockName / battery / online e’tiborga olinmaydi
    if (isTtlock && ttlockRaw) {
      await assignTtlockLockToRoom({
        user: auth.user,
        propertyId,
        ttlockCachedLockId: ttlockRaw,
        notes,
      });
      return ok(await loadMappedSettings(propertyId, auth.user));
    }

    if (isTtlock && hasTtlockField && !ttlockRaw) {
      await unassignTtlockLockFromRoom({
        user: auth.user,
        propertyId,
        clearNotes: body.clearNotes === true,
      });
      if (body.clearNotes !== true && "notes" in body) {
        await prisma.roomLockSettings.upsert({
          where: { propertyId },
          create: {
            propertyId,
            notes,
            providerName: null,
            lockName: null,
            deviceId: null,
            ttlockCachedLockId: null,
          },
          update: { notes },
        });
      }
      return ok(await loadMappedSettings(propertyId, auth.user));
    }

    const dataManual = {
      providerName: providerRaw || null,
      lockName: String(body.lockName ?? "").trim() || null,
      deviceId: String(body.deviceId ?? "").trim() || null,
      notes,
      ttlockCachedLockId: null as null,
    };

    const current = await prisma.roomLockSettings.findUnique({
      where: { propertyId },
    });
    if (current?.ttlockCachedLockId) {
      await unassignTtlockLockFromRoom({
        user: auth.user,
        propertyId,
        clearNotes: false,
      });
    }

    const row = await prisma.roomLockSettings.upsert({
      where: { propertyId },
      create: { propertyId, ...dataManual },
      update: dataManual,
    });

    return ok({ ...mapLockSettings(row), linkedLock: null });
  } catch (err) {
    return failFromTtlock(err);
  }
}
