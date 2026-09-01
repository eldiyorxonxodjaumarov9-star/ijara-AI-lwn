/**
 * TTLock 8-bosqich — masofadan boshqarish funksional unit testlari.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildRecordFingerprint,
  computeHistorySyncWindow,
  mapLockRecordDirection,
  mapLockRecordMethod,
  mapLockRecordType,
  sanitizePersonLabel,
} from "./access-history-sync";
import {
  REMOTE_REASON,
  resolveRemoteControlCapability,
  resolveRemoteTransportPath,
} from "./remote-capability";
import { mapGrantToPublic } from "./access-sync";
import {
  buildLockRecordListQueryFields,
  buildRemoteLockRequestFields,
  buildRemoteUnlockRequestFields,
} from "./client";
import { TTLOCK_ENDPOINTS } from "./types";
import { assertTtlockOwnerRole } from "./service";
import { TtlockError } from "./errors";
import { mapTtlockUiError } from "@/lib/ttlock-settings-view";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "../../../..");

function baseCapInput(
  overrides: Partial<Parameters<typeof resolveRemoteControlCapability>[0]> = {}
) {
  return {
    roleAllowed: true,
    configReady: true,
    dbReady: true,
    connectionConnected: true,
    tokenExpired: false,
    roomLockLinked: true,
    lockActive: true,
    remoteUnlock: true,
    commandInProgress: false,
    hasRevocableAccess: true,
    transport: {
      hasGateway: true,
      gatewayOnlineStatus: "ONLINE" as const,
      wifiRemoteCapable: null,
      capabilities: null,
    },
    ...overrides,
  };
}

describe("TTLock phase8 remote control", () => {
  it("req1: qulf yo‘q → unlock blok", () => {
    const cap = resolveRemoteControlCapability(
      baseCapInput({ roomLockLinked: false })
    );
    assert.equal(cap.canUnlock, false);
    assert.equal(cap.unlockReasonCode, "TTLOCK_ROOM_LOCK_MISSING");
  });

  it("req2: Gateway/Wi‑Fi yo‘q → unlock blok + exact sabab", () => {
    const path = resolveRemoteTransportPath({
      hasGateway: false,
      gatewayOnlineStatus: null,
      wifiRemoteCapable: null,
      capabilities: null,
    });
    assert.equal(path.ok, false);
    if (!path.ok) {
      assert.equal(path.code, "TTLOCK_GATEWAY_REQUIRED");
      assert.equal(path.text, REMOTE_REASON.GATEWAY_REQUIRED.text);
    }
  });

  it("req3: Gateway offline → unlock blok", () => {
    const cap = resolveRemoteControlCapability(
      baseCapInput({
        transport: {
          hasGateway: true,
          gatewayOnlineStatus: "OFFLINE",
          wifiRemoteCapable: false,
          capabilities: null,
        },
      })
    );
    assert.equal(cap.canUnlock, false);
    assert.equal(cap.unlockReasonCode, "TTLOCK_GATEWAY_OFFLINE");
  });

  it("req4: Gateway online + remoteUnlock → unlock mumkin", () => {
    const cap = resolveRemoteControlCapability(baseCapInput());
    assert.equal(cap.canUnlock, true);
    assert.equal(cap.canLock, true);
  });

  it("req5: Wi‑Fi lock → Gateway’siz remote", () => {
    const path = resolveRemoteTransportPath({
      hasGateway: false,
      gatewayOnlineStatus: null,
      wifiRemoteCapable: true,
      capabilities: { wifiRemoteCapable: true },
    });
    assert.equal(path.ok, true);
    const cap = resolveRemoteControlCapability(
      baseCapInput({
        transport: {
          hasGateway: false,
          gatewayOnlineStatus: null,
          wifiRemoteCapable: true,
          capabilities: { wifiRemoteCapable: true },
        },
      })
    );
    assert.equal(cap.canUnlock, true);
  });

  it("req6: capability unknown → xavfsiz blok", () => {
    const cap = resolveRemoteControlCapability(
      baseCapInput({
        remoteUnlock: null,
        transport: {
          hasGateway: false,
          gatewayOnlineStatus: null,
          wifiRemoteCapable: null,
          capabilities: null,
        },
      })
    );
    assert.equal(cap.canUnlock, false);
  });

  it("req7: remoteUnlock=false → unsupported", () => {
    const cap = resolveRemoteControlCapability(
      baseCapInput({ remoteUnlock: false })
    );
    assert.equal(cap.unlockReasonCode, "TTLOCK_REMOTE_UNLOCK_UNSUPPORTED");
  });

  it("req8: remote lock unsupported matni", () => {
    assert.equal(
      mapTtlockUiError("TTLOCK_REMOTE_LOCK_UNSUPPORTED"),
      REMOTE_REASON.REMOTE_LOCK_UNSUPPORTED.text
    );
  });

  it("req9: server client capability qiymatiga ishonmaydi", () => {
    const rc = readFileSync(join(__dirname, "remote-control.ts"), "utf8");
    assert.equal(rc.includes("input.hasGateway"), false);
    assert.equal(rc.includes("req.body.canUnlock"), false);
    assert.match(rc, /resolveRemoteControlCapability/);
    assert.match(rc, /loadRoomLockBundle/);
  });

  it("req10–11: rollar SUPER_ADMIN/ADMIN/MANAGER; EMPLOYEE rad", () => {
    assert.doesNotThrow(() =>
      assertTtlockOwnerRole({ role: "ADMIN" } as never)
    );
    assert.throws(
      () => assertTtlockOwnerRole({ role: "EMPLOYEE" } as never),
      (e: unknown) => e instanceof TtlockError && e.code === "TTLOCK_FORBIDDEN"
    );
    const cap = resolveRemoteControlCapability(
      baseCapInput({ roleAllowed: false })
    );
    assert.equal(cap.canUnlock, false);
  });

  it("req12–13: unlock/lock confirmation matnlari UI’da", () => {
    const ui = readFileSync(
      join(repoRoot, "src/components/lwn/lwn-room-remote-control-panel.tsx"),
      "utf8"
    );
    assert.match(ui, /masofadan ochmoqchimisiz/);
    assert.match(ui, /masofadan yopmoqchimisiz/);
    assert.match(ui, /Qulfni ochish/);
    assert.match(ui, /Qulfni yopish/);
  });

  it("req14–16: unlock/lock V3 mapping + endpoints", () => {
    assert.equal(TTLOCK_ENDPOINTS.lockUnlock, "/v3/lock/unlock");
    assert.equal(TTLOCK_ENDPOINTS.lockLock, "/v3/lock/lock");
    assert.deepEqual(buildRemoteUnlockRequestFields({ lockId: 99 }), {
      lockId: 99,
    });
    assert.deepEqual(buildRemoteLockRequestFields({ lockId: "L1" }), {
      lockId: "L1",
    });
    const client = readFileSync(join(__dirname, "client.ts"), "utf8");
    assert.match(client, /TTLOCK_ENDPOINTS\.lockUnlock/);
    assert.match(client, /TTLOCK_ENDPOINTS\.lockLock/);
  });

  it("req17–19: command audit PENDING→SUCCEEDED/FAILED/UNKNOWN", () => {
    const rc = readFileSync(join(__dirname, "remote-control.ts"), "utf8");
    assert.match(rc, /status: "PENDING"/);
    assert.match(rc, /finalizeCommand[\s\S]*SUCCEEDED/);
    assert.match(rc, /finalizeCommand[\s\S]*FAILED/);
    assert.match(rc, /TTLOCK_COMMAND_RESULT_UNKNOWN/);
    assert.match(rc, /TTLOCK_TIMEOUT/);
  });

  it("req20: unknown natijada avtomatik retry yo‘q", () => {
    const client = readFileSync(join(__dirname, "client.ts"), "utf8");
    assert.match(client, /REMOTE_COMMAND_TIMEOUT_MS/);
    assert.equal(
      /remoteUnlockLock[\s\S]*retrySafe:\s*true/.test(client),
      false
    );
  });

  it("req21–22: double command + idempotency key", () => {
    const rc = readFileSync(join(__dirname, "remote-control.ts"), "utf8");
    assert.match(rc, /idempotencyKey/);
    assert.match(rc, /TTLOCK_COMMAND_IN_PROGRESS/);
    assert.match(rc, /kind: "replay"/);
    const unlockRoute = readFileSync(
      join(
        repoRoot,
        "src/app/api/lwn-rooms/[propertyId]/remote-control/unlock/route.ts"
      ),
      "utf8"
    );
    assert.match(unlockRoute, /Idempotency-Key/);
  });

  it("req23: tashqi API DB transaction tashqarisida", () => {
    const rc = readFileSync(join(__dirname, "remote-control.ts"), "utf8");
    const createIdx = rc.indexOf("prisma.ttlockRemoteCommand.create");
    const apiIdx = rc.indexOf("await remoteUnlockLock");
    assert.ok(createIdx > 0 && apiIdx > createIdx);
    assert.equal(rc.includes("$transaction"), false);
  });

  it("req24–25: vaqtli parol 7-bosqich; qulf yo‘q reja", () => {
    const ui = readFileSync(
      join(repoRoot, "src/components/lwn/lwn-room-manage-view.tsx"),
      "utf8"
    );
    assert.match(ui, /setTab\("access-rights"\)/);
    assert.match(ui, /onAddGrant/);
    const sync7 = readFileSync(join(__dirname, "access-sync.ts"), "utf8");
    assert.match(sync7, /createRoomAccessGrantPlan/);
    assert.match(sync7, /Qulf biriktirilmagani/);
  });

  it("req26–27: revoke 7-bosqich; faol access empty", () => {
    const dlgSrc = readFileSync(
      join(repoRoot, "src/components/lwn/lwn-room-revoke-access-dialog.tsx"),
      "utf8"
    );
    assert.match(dlgSrc, /onRevoke/);
    assert.match(dlgSrc, /Bekor qilish uchun faol kirish huquqi topilmadi/);
    assert.match(
      readFileSync(join(__dirname, "access-sync.ts"), "utf8"),
      /revokeAccessGrant/
    );
  });

  it("req28–32: history V3 mapping, pagination, overlap, dedupe, unknown type", () => {
    assert.equal(TTLOCK_ENDPOINTS.lockRecordList, "/v3/lockRecord/list");
    const q = buildLockRecordListQueryFields({
      lockId: 1,
      pageNo: 2,
      pageSize: 100,
      startDateMs: 1000,
      endDateMs: 2000,
    });
    assert.equal(q.pageNo, 2);
    assert.equal(q.pageSize, 100);
    const win = computeHistorySyncWindow(new Date("2026-08-01T00:00:00Z"));
    assert.ok(win.startDateMs < win.endDateMs);
    const fp = buildRecordFingerprint({
      lockExternalId: "99",
      serverDateMs: 123,
      recordType: 4,
      success: 1,
      username: "u",
    });
    assert.equal(fp.length, 64);
    assert.equal(mapLockRecordType(9999), "UNKNOWN_9999");
    assert.equal(mapLockRecordDirection(4), "entry");
    assert.equal(mapLockRecordMethod(4), "passcode");
    const masked = sanitizePersonLabel("482917");
    assert.ok(masked);
    assert.equal(masked!.includes("***"), true);
    const masked2 = sanitizePersonLabel("secret123");
    assert.ok(masked2);
    assert.equal(masked2!.includes("123"), false);
  });

  it("req33–34: UTC storage; Tashkent display helper", () => {
    const upsert = readFileSync(join(__dirname, "access-log-upsert.ts"), "utf8");
    assert.match(upsert, /new Date\(serverDateMs\)/);
    const ui = readFileSync(
      join(repoRoot, "src/components/lwn/lwn-room-access-log-tab.tsx"),
      "utf8"
    );
    assert.match(ui, /formatDateTimeTashkent|Asia\/Tashkent/);
  });

  it("req35: access history secret sanitization", () => {
    const sync = readFileSync(join(__dirname, "access-history-sync.ts"), "utf8");
    assert.equal(sync.includes("keyboardPwd"), false);
    assert.match(sync, /sanitizePersonLabel/);
    const pub = mapGrantToPublic({
      id: "g",
      propertyId: "p",
      tenantId: "t",
      permissionType: "PIN",
      validFrom: null,
      validTo: null,
      status: "PLANNED",
      notes: null,
      revokedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    assert.equal(JSON.stringify(pub).includes("credentialEncrypted"), false);
  });

  it("req36–40: error mapping, disabled reasons, secret yo‘q, any yo‘q, o‘zbekcha", () => {
    assert.equal(
      mapTtlockUiError("TTLOCK_COMMAND_IN_PROGRESS"),
      "Bu qulf uchun boshqa buyruq bajarilmoqda."
    );
    assert.equal(
      mapTtlockUiError("TTLOCK_COMMAND_RESULT_UNKNOWN"),
      "TTLock javobi tasdiqlanmadi. Qulf holatini tekshiring."
    );
    const panel = readFileSync(
      join(repoRoot, "src/components/lwn/lwn-room-remote-control-panel.tsx"),
      "utf8"
    );
    assert.match(panel, /unlockReason/);
    assert.match(panel, /title=\{disabled && reason/);
    const rc = readFileSync(join(__dirname, "remote-control.ts"), "utf8");
    assert.equal(rc.includes("accessTokenEncrypted"), true);
    assert.equal(/:\s*any\b/.test(rc.replace(/\/\/.*/g, "")), false);
    assert.equal(
      REMOTE_REASON.GATEWAY_REQUIRED.text,
      "Gateway yoki Wi‑Fi ulanishi aniqlanmadi. Masofadan ochish uchun Gateway yoki Wi‑Fi qulf kerak."
    );
  });

  it("schema phase8 migration mavjud", () => {
    const sql = readFileSync(
      join(
        repoRoot,
        "server/prisma/migrations/20260831140000_ttlock_remote_phase8/migration.sql"
      ),
      "utf8"
    );
    assert.match(sql, /ttlock_remote_commands/);
    assert.match(sql, /externalRecordId/);
  });

  it(
    "haqiqiy device/Gateway E2E — SKIP",
    { skip: "Haqiqiy TTLock/Gateway E2E muhiti yo‘q" },
    () => assert.fail("e2e")
  );

  it(
    "haqiqiy DB concurrency — SKIP",
    { skip: "Haqiqiy Neon concurrency muhiti yo‘q" },
    () => assert.fail("db concurrency")
  );
});
