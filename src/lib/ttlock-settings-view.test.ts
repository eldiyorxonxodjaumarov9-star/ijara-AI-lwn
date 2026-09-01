import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import {
  TTLOCK_DISCONNECT_CONFIRM,
  TTLOCK_EMPTY_LOCKS_MESSAGE,
  badgeLabelForPhase,
  canConnect,
  canManageTtlock,
  canSync,
  deriveTtlockPanelPhase,
  formatTtlockBattery,
  formatTtlockDateTime,
  mapOnlineStatusLabel,
  mapTtlockUiError,
  sanitizeTtlockLocks,
  sanitizeTtlockStatus,
  statusLooksSafe,
} from "./ttlock-settings-view";
import type { TtlockPublicStatus } from "@/types/ttlock";

function baseStatus(
  over: Partial<TtlockPublicStatus["connection"]> & {
    configured?: boolean;
  } = {}
): TtlockPublicStatus {
  const { configured = true, ...connection } = over;
  return {
    provider: "TTLock/Sciener",
    config: {
      configured,
      missingFields: configured ? [] : ["TTLOCK_CLIENT_ID"],
      environment: "eu",
    },
    connection: {
      status: "ready",
      connected: false,
      ttlockUid: null,
      tokenExpiresAt: null,
      lastConnectedAt: null,
      lastSyncedAt: null,
      lastErrorCode: null,
      lastErrorMessage: null,
      lockCount: 0,
      ...connection,
    },
  };
}

describe("TTLock settings view-model (phase 5)", () => {
  it("1. loading holati", () => {
    assert.equal(
      deriveTtlockPanelPhase({
        loading: true,
        busy: null,
        status: null,
      }),
      "loading"
    );
  });

  it("2. TTLOCK_NOT_CONFIGURED → not_configured", () => {
    const phase = deriveTtlockPanelPhase({
      loading: false,
      busy: null,
      status: baseStatus({ configured: false, status: "disconnected" }),
    });
    assert.equal(phase, "not_configured");
    assert.equal(
      mapTtlockUiError("TTLOCK_NOT_CONFIGURED"),
      "TTLock API ma’lumotlari hali sozlanmagan."
    );
  });

  it("3. DATABASE_MIGRATION_REQUIRED", () => {
    assert.equal(
      deriveTtlockPanelPhase({
        loading: false,
        busy: null,
        migrationRequired: true,
        status: null,
      }),
      "migration_required"
    );
    assert.match(
      mapTtlockUiError("DATABASE_MIGRATION_REQUIRED"),
      /ma’lumotlar bazasi hali tayyorlanmagan/
    );
  });

  it("4. configured, lekin ulanmagan → ready / Ulanmagan", () => {
    const phase = deriveTtlockPanelPhase({
      loading: false,
      busy: null,
      status: baseStatus({ status: "ready" }),
    });
    assert.equal(phase, "ready");
    assert.equal(badgeLabelForPhase(phase), "Ulanmagan");
    assert.equal(canConnect(phase, null), true);
    assert.equal(canSync(phase, null), false);
  });

  it("5. ulangan va token yaroqli", () => {
    const phase = deriveTtlockPanelPhase({
      loading: false,
      busy: null,
      status: baseStatus({
        status: "connected",
        connected: true,
        ttlockUid: "42",
        lockCount: 2,
      }),
    });
    assert.equal(phase, "connected");
    assert.equal(canSync(phase, null), true);
  });

  it("6. token muddati tugagan", () => {
    const phase = deriveTtlockPanelPhase({
      loading: false,
      busy: null,
      status: baseStatus({ status: "token_expired", connected: false }),
    });
    assert.equal(phase, "token_expired");
    assert.equal(canSync(phase, null), false);
    assert.equal(canConnect(phase, null), true);
  });

  it("7. sync pending — double-submit bloklanadi", () => {
    assert.equal(canSync("connected", "sync"), false);
    assert.equal(canConnect("connected", "sync"), false);
    assert.equal(
      deriveTtlockPanelPhase({
        loading: false,
        busy: "sync",
        status: baseStatus({ status: "connected", connected: true }),
      }),
      "syncing"
    );
  });

  it("8. sync muvaffaqiyatidan keyin status lockCount yangilanadi (sanitize)", () => {
    const next = sanitizeTtlockStatus(
      baseStatus({
        status: "connected",
        connected: true,
        lockCount: 3,
        lastSyncedAt: "2026-09-02T09:35:00.000Z",
      })
    );
    assert.equal(next?.connection.lockCount, 3);
    assert.ok(next?.connection.lastSyncedAt);
  });

  it("9. qulf 0 — aniq bo‘sh holat matni", () => {
    assert.equal(
      TTLOCK_EMPTY_LOCKS_MESSAGE,
      "TTLock hisobida hozircha qulf topilmadi. Qulfni TTLock ilovasiga qo‘shgach, sinxronlashtiring."
    );
  });

  it("10. qulf mavjud — sanitizatsiyalangan ro‘yxat", () => {
    const locks = sanitizeTtlockLocks([
      {
        id: "1",
        externalLockId: "999",
        name: "Xona 1",
        battery: 80,
        hasGateway: true,
        onlineStatus: "ONLINE",
        lastSyncedAt: "2026-09-02T09:35:00.000Z",
        clientSecret: "leak",
        access_token: "tok",
      },
    ]);
    assert.equal(locks.length, 1);
    assert.equal(locks[0].name, "Xona 1");
    assert.equal("clientSecret" in locks[0], false);
    assert.equal(statusLooksSafe(locks), true);
  });

  it("11. onlineStatus mapping", () => {
    assert.equal(mapOnlineStatusLabel("ONLINE"), "Onlayn");
    assert.equal(mapOnlineStatusLabel("OFFLINE"), "Oflayn");
    assert.equal(mapOnlineStatusLabel("UNKNOWN"), "Noma’lum");
    assert.equal(mapOnlineStatusLabel(null), "Noma’lum");
  });

  it("12. battery null va 0–100", () => {
    assert.equal(formatTtlockBattery(null), "—");
    assert.equal(formatTtlockBattery(0), "0%");
    assert.equal(formatTtlockBattery(100), "100%");
    assert.equal(formatTtlockBattery(150), "—");
  });

  it("13. sana Asia/Tashkent formatida", () => {
    const formatted = formatTtlockDateTime("2026-09-02T09:35:00.000Z");
    assert.match(formatted, /^\d{2}\.\d{2}\.\d{4}, \d{2}:\d{2}$/);
    assert.equal(formatTtlockDateTime(null), "—");
    assert.equal(formatTtlockDateTime("not-a-date"), "—");
  });

  it("14. API error mapping", () => {
    assert.match(mapTtlockUiError("TTLOCK_TOKEN_EXPIRED"), /Qayta ulang/);
    assert.match(mapTtlockUiError("TTLOCK_RATE_LIMITED"), /limiti/);
    assert.match(mapTtlockUiError("UNAUTHORIZED"), /qayta kiring/i);
    assert.match(mapTtlockUiError("FORBIDDEN"), /ruxsat yo‘q/i);
    assert.match(mapTtlockUiError("UNKNOWN_X"), /xatolik yuz berdi/i);
  });

  it("15. secret/token status JSON’da yo‘q", () => {
    const safe = sanitizeTtlockStatus({
      provider: "TTLock/Sciener",
      config: { configured: true, missingFields: [], environment: "eu" },
      connection: {
        status: "connected",
        connected: true,
        ttlockUid: "1",
        tokenExpiresAt: null,
        lastConnectedAt: null,
        lastSyncedAt: null,
        lastErrorCode: null,
        lastErrorMessage: null,
        lockCount: 0,
        accessTokenEncrypted: "v1:xx",
        clientSecret: "secret",
      },
    });
    assert.ok(safe);
    assert.equal(statusLooksSafe(safe), true);
    assert.equal(JSON.stringify(safe).includes("clientSecret"), false);
    assert.equal(JSON.stringify(safe).includes("accessTokenEncrypted"), false);
  });

  it("16. disconnect confirmation matni", () => {
    assert.match(TTLOCK_DISCONNECT_CONFIRM, /uzmoqchimisiz/);
    assert.match(TTLOCK_DISCONNECT_CONFIRM, /o‘chirilmaydi/);
  });

  it("17. role cheklovi (frontend AppUser + Prisma SUPER_ADMIN mapping)", () => {
    // Prisma: SUPER_ADMIN | ADMIN | MANAGER | EMPLOYEE
    // auth-context mapApiRole: SUPER_ADMIN → "admin", ADMIN → "admin"
    assert.equal(canManageTtlock("admin"), true); // covers SUPER_ADMIN + ADMIN
    assert.equal(canManageTtlock("manager"), true);
    assert.equal(canManageTtlock("employee"), false);
    assert.equal(canManageTtlock("tenant"), false);
    assert.equal(canManageTtlock(null), false);
  });

  it("17b. SUPER_ADMIN frontend path: mapped admin can manage panel", () => {
    const prismaRole = "SUPER_ADMIN";
    const appRole =
      prismaRole === "SUPER_ADMIN" || prismaRole === "ADMIN"
        ? ("admin" as const)
        : ("employee" as const);
    assert.equal(appRole, "admin");
    assert.equal(canManageTtlock(appRole), true);
  });

  it("18. TypeScript any yo‘q (settings view + panel + client)", () => {
    const root = join(dirname(fileURLToPath(import.meta.url)), "..");
    const files = [
      join(root, "lib", "ttlock-settings-view.ts"),
      join(root, "lib", "ttlock-client.ts"),
      join(root, "components", "settings", "ttlock-settings-panel.tsx"),
    ];
    for (const file of files) {
      const src = readFileSync(file, "utf8");
      assert.equal(
        /:\s*any\b|\bas\s+any\b/.test(src),
        false,
        `${file} contains any`
      );
    }
  });
});
