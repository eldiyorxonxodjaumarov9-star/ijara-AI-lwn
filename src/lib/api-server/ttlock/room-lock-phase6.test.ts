/**
 * TTLock 6-bosqich — xonaga qulf biriktirish unit testlari (Neon/TTLock API yo‘q).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import {
  assertCanManageTtlockRole,
  isIdempotentSameRoomAssign,
  isPrismaUniqueViolation,
  isTerminalAccessSyncStatus,
  mapUniqueToAlreadyAssigned,
  serverLockFieldsFromCached,
  simulateUniqueRaceConflict,
  toAssignable,
  TTLOCK_ACCESS_TERMINAL_STATUSES,
  TTLOCK_PROVIDER_LABEL,
} from "./room-lock-assign";
import { TtlockError } from "./errors";
import { mapLockSettings } from "@/lib/api-server/lwn-room-lock";
import {
  filterAssignableLocks,
  isTtlockProviderName,
  lockDetailRows,
  lockSelectSecondaryLabel,
  mapGatewayStatusLabel,
  sanitizeAssignableLocks,
  TTLOCK_MIGRATION_REQUIRED_MESSAGE,
  TTLOCK_NO_LOCKS_MESSAGE,
  TTLOCK_NOT_CONNECTED_ROOM_MESSAGE,
  TTLOCK_UNLINK_CONFIRM,
} from "@/lib/ttlock-room-lock-view";
import {
  formatTtlockBattery,
  mapOnlineStatusLabel,
  mapTtlockUiError,
} from "@/lib/ttlock-settings-view";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "../../../..");
const assignSrc = () =>
  readFileSync(join(__dirname, "room-lock-assign.ts"), "utf8");
const routeSrc = () =>
  readFileSync(
    join(repoRoot, "src/app/api/lwn-rooms/[propertyId]/lock-settings/route.ts"),
    "utf8"
  );
const dialogSrc = () =>
  readFileSync(
    join(repoRoot, "src/components/lwn/lwn-room-link-lock-dialog.tsx"),
    "utf8"
  );

function baseRow(overrides: Partial<Parameters<typeof toAssignable>[0]> = {}) {
  return {
    id: "lock-1",
    name: "Asosiy eshik",
    externalLockId: "12345678",
    mac: "AA:BB",
    battery: 80,
    onlineStatus: "ONLINE",
    hasGateway: true,
    isActive: true,
    lastSyncedAt: new Date("2026-08-29T10:00:00Z"),
    gatewayName: "GW1",
    gatewayExternalId: "99",
    gatewayOnlineStatus: "ONLINE",
    assignedPropertyId: null as string | null,
    assignedPropertyName: null as string | null,
    ...overrides,
  };
}

describe("TTLock phase6 room lock assign", () => {
  it("available: biriktirilmagan faol qulf tanlanadi", () => {
    const lock = toAssignable(baseRow(), "room-a");
    assert.equal(lock.selectable, true);
    assert.equal(lock.assignedToOtherRoom, false);
    assert.equal(lock.assignedToCurrentRoom, false);
  });

  it("current: joriy xonaga biriktirilgan qulf tanlangan/selectable", () => {
    const lock = toAssignable(
      baseRow({
        assignedPropertyId: "room-a",
        assignedPropertyName: "101",
      }),
      "room-a"
    );
    assert.equal(lock.assignedToCurrentRoom, true);
    assert.equal(lock.selectable, true);
  });

  it("assigned: boshqa xonaga biriktirilgan — disabled + xona nomi", () => {
    const lock = toAssignable(
      baseRow({
        assignedPropertyId: "room-b",
        assignedPropertyName: "202-xona",
      }),
      "room-a"
    );
    assert.equal(lock.assignedToOtherRoom, true);
    assert.equal(lock.selectable, false);
    assert.match(lock.disabledReason ?? "", /Boshqa xonaga biriktirilgan: 202-xona/);
    assert.match(lockSelectSecondaryLabel(lock), /Boshqa xonaga/);
  });

  it("inactive: yangi biriktirish blok; joriy xonada ko‘rinadi", () => {
    const freeInactive = toAssignable(baseRow({ isActive: false }), "room-a");
    assert.equal(freeInactive.selectable, false);
    const currentInactive = toAssignable(
      baseRow({
        isActive: false,
        assignedPropertyId: "room-a",
        assignedPropertyName: "101",
      }),
      "room-a"
    );
    assert.equal(currentInactive.assignedToCurrentRoom, true);
    assert.equal(currentInactive.selectable, true);
    assert.equal(
      lockSelectSecondaryLabel(currentInactive),
      "TTLock hisobida hozir topilmadi"
    );
  });

  it("idempotent save: shu xona + shu lock conflict emas", () => {
    assert.equal(isIdempotentSameRoomAssign("lock-1", "lock-1"), true);
    assert.equal(isIdempotentSameRoomAssign("lock-1", "lock-2"), false);
    assert.equal(isIdempotentSameRoomAssign(null, "lock-1"), false);
    const lock = toAssignable(
      baseRow({ assignedPropertyId: "room-a", assignedPropertyName: "101" }),
      "room-a"
    );
    assert.equal(lock.assignedToOtherRoom, false);
  });

  it("boshqa xonaga biriktirish → TTLOCK_LOCK_ALREADY_ASSIGNED 409", () => {
    const other = toAssignable(
      baseRow({
        assignedPropertyId: "room-b",
        assignedPropertyName: "X",
      }),
      "room-a"
    );
    assert.equal(other.selectable, false);
    const mapped = mapUniqueToAlreadyAssigned({ code: "P2002" });
    assert.ok(mapped instanceof TtlockError);
    assert.equal(mapped!.code, "TTLOCK_LOCK_ALREADY_ASSIGNED");
    assert.equal(mapped!.httpStatus, 409);
    assert.match(assignSrc(), /TTLOCK_LOCK_ALREADY_ASSIGNED/);
    assert.match(assignSrc(), /\$transaction/);
  });

  it("unique error mapping: P2002 → 409 ALREADY_ASSIGNED", () => {
    assert.equal(isPrismaUniqueViolation({ code: "P2002" }), true);
    assert.equal(
      isPrismaUniqueViolation({
        message: "Unique constraint failed on ttlockCachedLockId",
      }),
      true
    );
    const mapped = mapUniqueToAlreadyAssigned({ code: "P2002" });
    assert.equal(mapped!.code, "TTLOCK_LOCK_ALREADY_ASSIGNED");
    assert.equal(mapped!.httpStatus, 409);
    assert.match(mapped!.message, /boshqa xonaga biriktirilgan/i);
  });

  it("service-level parallel race: unique → 409 (DB concurrency emas)", () => {
    const race = simulateUniqueRaceConflict();
    assert.equal(race.code, "TTLOCK_LOCK_ALREADY_ASSIGNED");
    assert.equal(race.httpStatus, 409);
    assert.match(assignSrc(), /mapUniqueToAlreadyAssigned/);
    assert.match(assignSrc(), /\$transaction/);
  });

  it("boshqa user scope: ownerUserId tekshiruvi + TTLOCK_LOCK_NOT_FOUND", () => {
    const src = assignSrc();
    assert.match(src, /c\."ownerUserId" = \$2/);
    assert.match(src, /TTLOCK_LOCK_NOT_FOUND/);
    assert.match(src, /404/);
  });

  it("rollar: SUPER_ADMIN/ADMIN/MANAGER ruxsat; EMPLOYEE rad", () => {
    assert.throws(
      () => assertCanManageTtlockRole("EMPLOYEE"),
      (err: unknown) =>
        err instanceof TtlockError && err.code === "TTLOCK_FORBIDDEN"
    );
    for (const role of ["SUPER_ADMIN", "ADMIN", "MANAGER"] as const) {
      assert.doesNotThrow(() => assertCanManageTtlockRole(role));
    }
  });

  it("server-side derived lock metadata (client lockName/battery/online yo‘q)", () => {
    const derived = serverLockFieldsFromCached({
      name: "Cache nomi",
      externalLockId: "555",
    });
    assert.equal(derived.providerName, TTLOCK_PROVIDER_LABEL);
    assert.equal(derived.lockName, "Cache nomi");
    assert.equal(derived.deviceId, "555");
    const fakeClient = { lockName: "SOXTA", battery: 1, online: true };
    assert.notEqual(derived.lockName, fakeClient.lockName);
    const src = assignSrc();
    assert.match(src, /serverLockFieldsFromCached/);
    assert.equal(/body\.lockName|input\.lockName|client\.battery/.test(src), false);
    const route = routeSrc();
    assert.match(route, /Client lockName/);
    assert.match(route, /assignTtlockLockToRoom/);
  });

  it("battery: null → —; 0–100%; past battery ogohlantirish", () => {
    assert.equal(formatTtlockBattery(null), "—");
    assert.equal(formatTtlockBattery(0), "0%");
    assert.equal(formatTtlockBattery(100), "100%");
    assert.equal(formatTtlockBattery(15), "15%");
    assert.equal(lockDetailRows(toAssignable(baseRow({ battery: 15 }), null)).batteryLow, true);
    assert.equal(lockDetailRows(toAssignable(baseRow({ battery: null }), null)).batteryLabel, "—");
  });

  it("onlineStatus canonical mapping", () => {
    assert.equal(mapOnlineStatusLabel("ONLINE"), "Onlayn");
    assert.equal(mapOnlineStatusLabel("OFFLINE"), "Oflayn");
    assert.equal(mapOnlineStatusLabel("UNKNOWN"), "Noma’lum");
    assert.equal(toAssignable(baseRow({ onlineStatus: "ONLINE" }), null).onlineStatus, "ONLINE");
  });

  it("Gateway: onlayn/oflayn/noma’lum/ulanmagan", () => {
    assert.equal(
      mapGatewayStatusLabel({ hasGateway: false, gatewayOnlineStatus: null }),
      "Gateway ulanmagan"
    );
    assert.equal(
      mapGatewayStatusLabel({ hasGateway: true, gatewayOnlineStatus: "ONLINE" }),
      "Gateway onlayn"
    );
    assert.equal(
      mapGatewayStatusLabel({ hasGateway: true, gatewayOnlineStatus: "OFFLINE" }),
      "Gateway oflayn"
    );
    assert.equal(
      mapGatewayStatusLabel({ hasGateway: true, gatewayOnlineStatus: "UNKNOWN" }),
      "Gateway holati noma’lum"
    );
  });

  it("notes persistence: mapLockSettings + assign notes yozuvi", () => {
    const mapped = mapLockSettings({
      id: "s1",
      propertyId: "p1",
      providerName: "X",
      lockName: "L",
      deviceId: "D",
      notes: "Maxsus izoh <b>ok</b>",
      ttlockCachedLockId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    assert.equal(mapped.notes, "Maxsus izoh <b>ok</b>");
    assert.match(assignSrc(), /notes,/);
    assert.match(routeSrc(), /normalizeNotes|NOTES_MAX|notes/);
  });

  it("almashtirish: eski cached lock o‘chirilmaydi; bo‘sh lock selectable", () => {
    const free = toAssignable(baseRow({ id: "b", name: "B" }), "room-a");
    const taken = toAssignable(
      baseRow({
        id: "c",
        assignedPropertyId: "other",
        assignedPropertyName: "X",
      }),
      "room-a"
    );
    assert.equal(free.selectable, true);
    assert.equal(taken.selectable, false);
    const src = assignSrc();
    assert.equal(src.includes("deleteMany"), false);
    assert.equal(/DELETE FROM \"ttlock_cached_locks\"/i.test(src), false);
  });

  it("ajratish: relation null; confirm dialog matni; cached lock saqlanadi", () => {
    const src = assignSrc();
    assert.match(src, /ttlockCachedLockId:\s*null/);
    assert.equal(src.includes("deleteMany"), false);
    assert.equal(
      TTLOCK_UNLINK_CONFIRM,
      "TTLock qulfini bu xonadan ajratmoqchimisiz? Qulf TTLock hisobidan o‘chirilmaydi, faqat ushbu xona bilan bog‘lanishi bekor qilinadi."
    );
    assert.match(dialogSrc(), /Qulfni ajratish/);
    assert.match(dialogSrc(), /TTLOCK_UNLINK_CONFIRM/);
  });

  it("faol access guard: TTLOCK_LOCK_HAS_ACTIVE_ACCESS", () => {
    assert.equal(isTerminalAccessSyncStatus("ACTIVE"), false);
    assert.equal(isTerminalAccessSyncStatus("PLANNED"), false);
    const src = assignSrc();
    assert.match(src, /TTLOCK_LOCK_HAS_ACTIVE_ACCESS/);
    assert.match(
      src,
      /Bu qulfda faol kirish huquqlari mavjud\. Avval kirish huquqlarini bekor qiling/
    );
  });

  it("terminal access: EXPIRED/REVOKED ajratishni to‘smaydi", () => {
    assert.deepEqual(TTLOCK_ACCESS_TERMINAL_STATUSES, ["EXPIRED", "REVOKED"]);
    assert.equal(isTerminalAccessSyncStatus("EXPIRED"), true);
    assert.equal(isTerminalAccessSyncStatus("REVOKED"), true);
    assert.match(assignSrc(), /NOT IN \('EXPIRED', 'REVOKED'\)/);
  });

  it("exact empty-state: qulf yo‘q matni", () => {
    assert.equal(
      TTLOCK_NO_LOCKS_MESSAGE,
      "TTLock hisobida hozircha qulf topilmadi. Qulfni TTLock ilovasiga qo‘shgach, sinxronlashtiring."
    );
    assert.match(dialogSrc(), /TTLOCK_NO_LOCKS_MESSAGE/);
  });

  it("connect/migration/API xato holatlari", () => {
    assert.equal(
      TTLOCK_NOT_CONNECTED_ROOM_MESSAGE,
      "TTLock hisobi hali ulanmagan. Avval Sozlamalar → Integratsiyalar bo‘limidan TTLock hisobini ulang."
    );
    assert.equal(
      TTLOCK_MIGRATION_REQUIRED_MESSAGE,
      "TTLock ma’lumotlar bazasi hali tayyorlanmagan."
    );
    assert.equal(
      mapTtlockUiError("DATABASE_MIGRATION_REQUIRED"),
      TTLOCK_MIGRATION_REQUIRED_MESSAGE
    );
    assert.match(dialogSrc(), /TTLOCK_NOT_CONNECTED_ROOM_MESSAGE/);
    assert.match(dialogSrc(), /TTLOCK_MIGRATION_REQUIRED_MESSAGE/);
    assert.match(dialogSrc(), /Qayta urinish/);
    assert.equal(isTtlockProviderName("TTLock/Sciener"), true);
  });

  it("secret sanitization: token/secret/password/credentialEncrypted yo‘q", () => {
    const lock = toAssignable(baseRow(), "room-a");
    const json = JSON.stringify(lock);
    assert.equal(json.includes("token"), false);
    assert.equal(json.includes("secret"), false);
    assert.equal(json.includes("credentialEncrypted"), false);
    assert.equal(json.includes("password"), false);
    const sanitized = sanitizeAssignableLocks([
      {
        id: "1",
        name: "A",
        externalLockId: "1",
        accessToken: "secret",
        refreshToken: "r",
        credentialEncrypted: "x",
      },
    ]);
    assert.equal("accessToken" in sanitized[0], false);
    assert.equal("refreshToken" in sanitized[0], false);
    assert.equal("credentialEncrypted" in sanitized[0], false);
    const detailJson = JSON.stringify(lockDetailRows(lock));
    assert.equal(/token|secret|password|credentialEncrypted|eKey/i.test(detailJson), false);
  });

  it("TypeScript any yo‘qligi (phase6 fayllar)", () => {
    const paths = [
      join(__dirname, "room-lock-assign.ts"),
      join(repoRoot, "src/lib/ttlock-room-lock-view.ts"),
      join(repoRoot, "src/types/ttlock-assignable-lock.ts"),
      join(repoRoot, "src/app/api/lwn-rooms/[propertyId]/lock-settings/route.ts"),
    ];
    for (const path of paths) {
      const text = readFileSync(path, "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/\/\/.*/g, "");
      assert.equal(/\bany\b/.test(text), false, `any found in ${path}`);
    }
  });

  it("qidiruv: nom, lockId, MAC", () => {
    const locks = [
      toAssignable(baseRow({ name: "Asosiy", externalLockId: "111", mac: "AA" }), null),
      toAssignable(
        baseRow({ id: "2", name: "Orqa", externalLockId: "222", mac: "BB:CC" }),
        null
      ),
    ];
    assert.equal(filterAssignableLocks(locks, "orqa").length, 1);
    assert.equal(filterAssignableLocks(locks, "111").length, 1);
    assert.equal(filterAssignableLocks(locks, "bb:cc").length, 1);
  });

  it("schema/migration: ttlockCachedLockId UNIQUE (phase4)", () => {
    const schema = readFileSync(
      join(repoRoot, "server/prisma/schema.prisma"),
      "utf8"
    );
    assert.match(schema, /ttlockCachedLockId\s+String\?/);
    assert.match(schema, /@@unique\(\[ttlockCachedLockId\]\)/);

    const migDir = join(repoRoot, "server/prisma/migrations");
    const dirs = readdirSync(migDir);
    const phase4 = dirs.find((d) => d.includes("ttlock_db_phase4"));
    assert.ok(phase4, "phase4 migration mavjud");
    const sql = readFileSync(join(migDir, phase4!, "migration.sql"), "utf8");
    assert.match(sql, /room_lock_settings_ttlockCachedLockId_key/);
    assert.match(sql, /UNIQUE|unique/i);
  });

  it("runtime DDL yo‘q (assign/route)", () => {
    assert.equal(/CREATE TABLE|ALTER TABLE|db push/i.test(assignSrc()), false);
    assert.equal(/CREATE TABLE|ALTER TABLE/i.test(routeSrc()), false);
  });

  it(
    "parallel concurrency haqiqiy DB testi — SKIP (muhit yo‘q)",
    { skip: "Haqiqiy Neon/Postgres concurrency muhiti yo‘q — PASS deb yozilmaydi" },
    () => {
      assert.fail("haqiqiy concurrency bajarilmagan");
    }
  );
});
