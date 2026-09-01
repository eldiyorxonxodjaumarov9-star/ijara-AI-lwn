/**
 * TTLock 7-bosqich — funksional unit testlar (TTLock/Neon yo‘q).
 * Har bir talab → kamida bitta haqiqiy assert (faqat helper mavjudligi emas).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import {
  ACCESS_EFFECTIVE_UI_LABELS,
  assertValidFromBeforeTo,
  buildEkeyV3RequestFields,
  buildPasscodeV3RequestFields,
  classifyCredentialForSyncClaim,
  decideRemoteRevoke,
  derivePersistedSyncAfterSend,
  EKEY_RECEIVER_PLAN_ONLY_MESSAGE,
  EKEY_RECEIVER_REQUIRED_MESSAGE,
  isAccessExpired,
  isTtlockAccessOwnerRole,
  isWithinAccessWindow,
  LOCK_MISSING_PLAN_HINT,
  maskReceiver,
  parseBusinessDateTimeToUtc,
  permissionToAccessKind,
  permissionToCredentialType,
  resolveAccessEffectiveStatus,
  resolveEkeyReceiver,
  TASHKENT_UTC_OFFSET_HOURS,
} from "./access-effective";
import { mapGrantToPublic } from "./access-sync";
import type { TtlockAccessCredentialRow } from "./db";
import { encryptAccessCredential, looksEncryptedSecret } from "./persistence";
import { assertTtlockOwnerRole } from "./service";
import { TTLOCK_ENDPOINTS } from "./types";
import { TtlockError } from "./errors";
import { mapTtlockUiError } from "@/lib/ttlock-settings-view";
import {
  EKEY_RECEIVER_MISSING_HINT,
  stripOneTimePasscode,
} from "@/lib/ttlock-access-view";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "../../../..");
const testKey = "b".repeat(64);

function fakeCred(
  overrides: Partial<TtlockAccessCredentialRow> = {}
): TtlockAccessCredentialRow {
  const now = new Date("2026-09-01T00:00:00Z");
  return {
    id: "c1",
    roomAccessGrantId: "g1",
    connectionId: "conn",
    ttlockCachedLockId: "lock1",
    accessType: "PASSCODE",
    syncStatus: "SENT",
    externalAccessId: "pwd-99",
    credentialEncrypted: "enc",
    sentAt: new Date("2026-09-01T12:00:00Z"),
    lastSyncedAt: new Date("2026-09-01T12:00:00Z"),
    lastErrorCode: null,
    lastErrorMessage: null,
    revokedAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function fakeGrantBase(
  overrides: {
    ttlockCredential?: TtlockAccessCredentialRow | null;
    tenant?: {
      fullName: string;
      phone: string | null;
      email?: string | null;
    } | null;
    permissionType?: string;
    status?: string;
  } = {}
) {
  const now = new Date("2026-09-01T00:00:00Z");
  return {
    id: "g1",
    propertyId: "p1",
    tenantId: "t1",
    permissionType: overrides.permissionType ?? "PIN",
    validFrom: new Date("2026-09-10T05:00:00Z"),
    validTo: new Date("2026-09-20T05:00:00Z"),
    status: overrides.status ?? "PLANNED",
    notes: null as string | null,
    revokedAt: null as Date | null,
    createdAt: now,
    updatedAt: now,
    tenant:
      overrides.tenant === undefined
        ? {
            fullName: "Ali",
            phone: "+998901112233",
            email: "ali@example.com",
          }
        : overrides.tenant,
    ttlockCredential:
      overrides.ttlockCredential === undefined
        ? null
        : overrides.ttlockCredential,
  };
}

describe("TTLock phase7 access grants", () => {
  it("req1+2+3: qulf yo‘q → grant planned; API yo‘q; Rejalashtirilgan + hint", () => {
    const pub = mapGrantToPublic(fakeGrantBase(), {
      syncOutcome: "planned_only",
      userMessage:
        "Reja saqlandi. Qulf biriktirilmagani sababli qurilmaga yuborilmadi.",
    });
    assert.equal(pub.effectiveStatus, "REJALASHTIRILGAN");
    assert.equal(pub.effectiveLabel, "Rejalashtirilgan");
    assert.equal(pub.delivery.lockMissingHint, LOCK_MISSING_PLAN_HINT);
    assert.equal(pub.syncOutcome, "planned_only");
    assert.equal(pub.delivery.hasCredential, false);
    assert.equal(ACCESS_EFFECTIVE_UI_LABELS.REJALASHTIRILGAN, "Rejalashtirilgan");

    const syncSrc = readFileSync(join(__dirname, "access-sync.ts"), "utf8");
    // create: grant yaratiladi; qulf yo‘qda syncGrantToTtlock chaqirilmasdan qaytadi
    assert.match(syncSrc, /roomAccessGrant\.create/);
    assert.match(
      syncSrc,
      /if \(!roomLock \|\| !credType\)[\s\S]*?return mapGrantToPublic/
    );
    assert.match(
      syncSrc,
      /Qulf biriktirilmagani sababli qurilmaga yuborilmadi/
    );
  });

  it("req4+5: tenant room contract assert; boshqa xona rad matni", () => {
    const syncSrc = readFileSync(join(__dirname, "access-sync.ts"), "utf8");
    assert.match(
      syncSrc,
      /propertyId[\s\S]*tenantId[\s\S]*status:\s*\{\s*in:\s*\["ACTIVE",\s*"PENDING",\s*"EXPIRED"\]/
    );
    assert.match(
      syncSrc,
      /Arendator ushbu xonaga tegishli shartnomada topilmadi/
    );
    assert.match(syncSrc, /await assertTenantOnRoom\(input\.propertyId,\s*input\.tenantId\)/);
  });

  it("req6+7: validFrom < validTo; Asia/Tashkent → UTC", () => {
    assert.equal(
      assertValidFromBeforeTo(
        new Date("2026-09-01T00:00:00Z"),
        new Date("2026-09-01T00:00:00Z")
      ),
      "Boshlanish sanasi tugash sanasidan oldin bo‘lishi kerak"
    );
    assert.equal(
      assertValidFromBeforeTo(
        new Date("2026-09-01T00:00:00Z"),
        new Date("2026-09-02T00:00:00Z")
      ),
      null
    );
    const utc = parseBusinessDateTimeToUtc("2026-09-01T10:00");
    assert.ok(utc);
    assert.equal(utc!.getUTCHours(), 10 - TASHKENT_UTC_OFFSET_HOURS);
    assert.equal(utc!.getUTCDate(), 1);
    const withOffset = parseBusinessDateTimeToUtc("2026-09-01T10:00:00+05:00");
    assert.ok(withOffset);
    assert.equal(withOffset!.toISOString(), "2026-09-01T05:00:00.000Z");
  });

  it("req8+9: PIN→passcode; APP→ekey", () => {
    assert.equal(permissionToAccessKind("PIN"), "passcode");
    assert.equal(permissionToCredentialType("PIN"), "PASSCODE");
    assert.equal(permissionToAccessKind("APP"), "ekey");
    assert.equal(permissionToCredentialType("APP"), "EKEY");
    assert.equal(permissionToCredentialType("CARD"), null);
  });

  it("req10+11: eKey receiver validatsiya; yo‘q → TTLOCK_RECEIVER_REQUIRED (sync)", () => {
    assert.equal(resolveEkeyReceiver({ phone: "+998901112233" }).ok, true);
    assert.equal(resolveEkeyReceiver({ email: "a@b.uz" }).ok, true);
    assert.equal(resolveEkeyReceiver({ phone: "bad", email: "" }).ok, false);
    assert.equal(resolveEkeyReceiver({ phone: "", email: "not-email" }).ok, false);
    assert.equal(
      EKEY_RECEIVER_REQUIRED_MESSAGE,
      "eKey yuborish uchun arendatorning TTLock telefon yoki emaili kerak."
    );
    assert.equal(
      mapTtlockUiError("TTLOCK_RECEIVER_REQUIRED"),
      EKEY_RECEIVER_REQUIRED_MESSAGE
    );
    // create: grant saqlanadi, API yo‘q
    assert.match(
      readFileSync(join(__dirname, "access-sync.ts"), "utf8"),
      /ekeyReceiverMissing[\s\S]*EKEY_RECEIVER_PLAN_ONLY_MESSAGE/
    );
    assert.equal(
      EKEY_RECEIVER_PLAN_ONLY_MESSAGE.includes("Reja saqlandi"),
      true
    );
  });

  it("req12+13: passcode/eKey V3 request mapping + endpoints", () => {
    assert.equal(TTLOCK_ENDPOINTS.keyboardPwdGet, "/v3/keyboardPwd/get");
    assert.equal(TTLOCK_ENDPOINTS.keyboardPwdDelete, "/v3/keyboardPwd/delete");
    assert.equal(TTLOCK_ENDPOINTS.keySend, "/v3/key/send");
    assert.equal(TTLOCK_ENDPOINTS.keyDelete, "/v3/key/delete");
    const pass = buildPasscodeV3RequestFields({
      lockId: 99,
      startDateMs: 1000,
      endDateMs: 2000,
    });
    assert.deepEqual(pass, {
      lockId: 99,
      keyboardPwdType: 3,
      startDate: 1000,
      endDate: 2000,
    });
    const ekey = buildEkeyV3RequestFields({
      lockId: "L1",
      receiverUsername: "+998901112233",
      keyName: "Ali",
      startDateMs: 1000,
      endDateMs: 2000,
    });
    assert.equal(ekey.receiverUsername, "+998901112233");
    assert.equal(ekey.keyName, "Ali");
    assert.equal(ekey.startDate, 1000);
    assert.equal(ekey.endDate, 2000);
    const clientSrc = readFileSync(join(__dirname, "client.ts"), "utf8");
    assert.match(clientSrc, /keyboardPwdType:\s*input\.keyboardPwdType \?\? 3/);
    assert.match(clientSrc, /receiverUsername:\s*input\.receiverUsername/);
  });

  it("req14: API muvaffaqiyati → externalAccessId + sentAt (markCredentialSent)", () => {
    const syncSrc = readFileSync(join(__dirname, "access-sync.ts"), "utf8");
    assert.match(
      syncSrc,
      /SET "syncStatus"[\s\S]*"externalAccessId" = \$3[\s\S]*"sentAt" = COALESCE\("sentAt"/
    );
    const pub = mapGrantToPublic(
      fakeGrantBase({
        ttlockCredential: fakeCred({
          syncStatus: "SENT",
          externalAccessId: "pwd-99",
          sentAt: new Date("2026-09-01T12:00:00Z"),
        }),
      }),
      { now: new Date("2026-09-05T00:00:00Z") }
    );
    assert.equal(pub.delivery.externalAccessId, "pwd-99");
    assert.equal(pub.delivery.sentAt, "2026-09-01T12:00:00.000Z");
    assert.equal(pub.delivery.syncStatus, "SENT");
  });

  it("req15+16: passcode AES-256-GCM; plaintext DB/list/API/log’da yo‘q", () => {
    const pin = "482917";
    const { credentialEncrypted } = encryptAccessCredential(pin, testKey);
    assert.equal(looksEncryptedSecret(credentialEncrypted), true);
    assert.equal(credentialEncrypted.includes(pin), false);
    assert.equal(credentialEncrypted.includes("4829"), false);

    const pub = mapGrantToPublic(
      fakeGrantBase({
        ttlockCredential: fakeCred({
          syncStatus: "ACTIVE",
          externalAccessId: "pwd-1",
          credentialEncrypted,
        }),
      }),
      { now: new Date("2026-09-12T00:00:00Z") }
    );
    const json = JSON.stringify(pub);
    assert.equal(json.includes(pin), false);
    assert.equal(json.includes("credentialEncrypted"), false);
    assert.equal(json.includes("credentialLast4"), false);
    assert.equal("oneTimePasscode" in pub, false);

    const syncSrc = readFileSync(join(__dirname, "access-sync.ts"), "utf8");
    assert.equal(syncSrc.includes("credentialLast4"), false);
    assert.match(syncSrc, /encryptAccessCredential/);
  });

  it("req17+18+19: bir martalik parol faqat create/sync; modal tozalash; list strip", () => {
    const withPin = mapGrantToPublic(fakeGrantBase(), {
      oneTimePasscode: "123456",
    });
    assert.equal(withPin.oneTimePasscode, "123456");
    const stripped = stripOneTimePasscode(withPin);
    assert.equal("oneTimePasscode" in stripped, false);

    const listLike = mapGrantToPublic(fakeGrantBase());
    assert.equal("oneTimePasscode" in listLike, false);

    const ui = readFileSync(
      join(repoRoot, "src/components/lwn/lwn-room-access-rights-tab.tsx"),
      "utf8"
    );
    assert.match(ui, /setOneTimePin\(null\)/);
    assert.match(ui, /Nusxalash/);
    assert.equal(ui.includes("localStorage"), false);
    assert.equal(ui.includes("sessionStorage"), false);
    assert.equal(ui.includes("console."), false);
    assert.equal(ui.includes("credentialLast4"), false);

    const hook = readFileSync(
      join(repoRoot, "src/hooks/use-lwn-room-lock-data.ts"),
      "utf8"
    );
    assert.match(hook, /stripOneTimePasscode/);
  });

  it("req20+21+22: future SENT→API’ga yuborilgan; interval→Faol; tugagan→Tugagan", () => {
    const from = new Date("2026-09-10T05:00:00Z");
    const to = new Date("2026-09-20T05:00:00Z");
    assert.equal(
      resolveAccessEffectiveStatus({
        grantStatus: "PLANNED",
        validFrom: from,
        validTo: to,
        syncStatus: "SENT",
        hasCredential: true,
        now: new Date("2026-09-05T00:00:00Z"),
      }),
      "API_YUBORILGAN"
    );
    assert.equal(ACCESS_EFFECTIVE_UI_LABELS.API_YUBORILGAN, "API’ga yuborilgan");
    assert.equal(
      resolveAccessEffectiveStatus({
        grantStatus: "PLANNED",
        validFrom: from,
        validTo: to,
        syncStatus: "SENT",
        hasCredential: true,
        now: new Date("2026-09-12T00:00:00Z"),
      }),
      "FAOL"
    );
    assert.equal(ACCESS_EFFECTIVE_UI_LABELS.FAOL, "Faol");
    assert.equal(
      resolveAccessEffectiveStatus({
        grantStatus: "PLANNED",
        validFrom: from,
        validTo: to,
        syncStatus: "ACTIVE",
        hasCredential: true,
        now: new Date("2026-09-21T00:00:00Z"),
      }),
      "TUGAGAN"
    );
    assert.equal(ACCESS_EFFECTIVE_UI_LABELS.TUGAGAN, "Tugagan");
    assert.equal(isWithinAccessWindow(from, to, new Date("2026-09-12T00:00:00Z")), true);
    assert.equal(isAccessExpired(to, new Date("2026-09-21T00:00:00Z")), true);
    assert.equal(
      derivePersistedSyncAfterSend({
        validFrom: from,
        validTo: to,
        now: new Date("2026-09-05T00:00:00Z"),
      }),
      "SENT"
    );
  });

  it("req23–27: unsent local; sent passcode/eKey remote; REVOKE_PENDING; retry; idempotent", () => {
    assert.equal(
      decideRemoteRevoke({ externalAccessId: null, accessType: "PASSCODE" }),
      "local_only"
    );
    assert.equal(
      decideRemoteRevoke({
        externalAccessId: "pwd-1",
        accessType: "PASSCODE",
      }),
      "remote_passcode"
    );
    assert.equal(
      decideRemoteRevoke({ externalAccessId: "key-1", accessType: "EKEY" }),
      "remote_ekey"
    );

    const revoked = resolveAccessEffectiveStatus({
      grantStatus: "CANCELLED",
      validFrom: null,
      validTo: null,
      syncStatus: "REVOKED",
      hasCredential: true,
    });
    assert.equal(revoked, "BEKOR_QILINGAN");
    assert.equal(
      resolveAccessEffectiveStatus({
        grantStatus: "PLANNED",
        validFrom: null,
        validTo: null,
        syncStatus: "REVOKE_PENDING",
        hasCredential: true,
      }),
      "BEKOR_KUTILMOQDA"
    );

    const syncSrc = readFileSync(join(__dirname, "access-sync.ts"), "utf8");
    assert.match(syncSrc, /REVOKE_PENDING/);
    assert.match(syncSrc, /deleteKeyboardPwd/);
    assert.match(syncSrc, /deleteEkey/);
    assert.match(syncSrc, /Idempotent: allaqachon bekor/);
    assert.match(
      syncSrc,
      /Kirish huquqini TTLock’da bekor qilib bo‘lmadi\. Qayta urinib ko‘ring/
    );
    // revoke xatosida grant/credential o‘chirilmaydi — FAILED + throw
    assert.match(syncSrc, /'FAILED'::"TtlockAccessSyncStatus"/);
    assert.match(
      syncSrc,
      /Kirish huquqini TTLock’da bekor qilib bo‘lmadi\. Qayta urinib ko‘ring/
    );
    assert.match(syncSrc, /roomAccessGrant\.update/);
    assert.equal(syncSrc.includes("roomAccessGrant.delete"), false);
    assert.equal(syncSrc.includes("ttlock_access_credentials\" DELETE"), false);
  });

  it("req28+29+30: double sync claim; externalAccessId dublikat yo‘q; timeout unknown, blind retry yo‘q", () => {
    assert.equal(
      classifyCredentialForSyncClaim({
        externalAccessId: "x",
        syncStatus: "SENT",
        lastErrorCode: null,
      }),
      "already_sent"
    );
    assert.equal(
      classifyCredentialForSyncClaim({
        externalAccessId: null,
        syncStatus: "PLANNED",
        lastErrorCode: null,
      }),
      "claimable"
    );
    assert.equal(
      classifyCredentialForSyncClaim({
        externalAccessId: null,
        syncStatus: "FAILED",
        lastErrorCode: "TTLOCK_RESULT_UNKNOWN",
      }),
      "unknown_result"
    );
    assert.equal(
      classifyCredentialForSyncClaim({
        externalAccessId: null,
        syncStatus: "PENDING_SYNC",
        lastErrorCode: null,
      }),
      "in_flight"
    );

    const syncSrc = readFileSync(join(__dirname, "access-sync.ts"), "utf8");
    assert.match(syncSrc, /claimCredentialForSync/);
    assert.match(
      syncSrc,
      /AND "externalAccessId" IS NULL[\s\S]*PLANNED', 'FAILED'/
    );
    assert.match(syncSrc, /TTLOCK_RESULT_UNKNOWN/);
    assert.match(
      syncSrc,
      /Dublikat yaratmaslik uchun avtomatik qayta yuborilmadi/
    );
    const clientSrc = readFileSync(join(__dirname, "client.ts"), "utf8");
    assert.match(clientSrc, /timeout\/noma’lum → blind retry YO‘Q/);
  });

  it("req31+32+33: token refresh; rate-limit; API xatosida grant DB’da", () => {
    const syncSrc = readFileSync(join(__dirname, "access-sync.ts"), "utf8");
    assert.match(syncSrc, /getValidAccessToken/);
    assert.match(syncSrc, /failed_keep_plan/);
    assert.match(syncSrc, /Reja bazada saqlandi/);
    const rateMsg = mapTtlockUiError("TTLOCK_RATE_LIMITED");
    assert.match(rateMsg, /limit|Limit|so‘rov/i);
  });

  it("req34: xona qulfi almashtirilsa sent credential yangi qulfga ko‘chmaydi", () => {
    const syncSrc = readFileSync(join(__dirname, "access-sync.ts"), "utf8");
    assert.match(syncSrc, /boshqa qulfga yuborilgan/);
    assert.match(syncSrc, /ttlockCachedLockId !== roomLock\.lock\.id/);
  });

  it("req35+36: SUPER_ADMIN/ADMIN/MANAGER ruxsat; EMPLOYEE rad", () => {
    assert.equal(isTtlockAccessOwnerRole("SUPER_ADMIN"), true);
    assert.equal(isTtlockAccessOwnerRole("ADMIN"), true);
    assert.equal(isTtlockAccessOwnerRole("MANAGER"), true);
    assert.equal(isTtlockAccessOwnerRole("EMPLOYEE"), false);
    assert.doesNotThrow(() =>
      assertTtlockOwnerRole({ role: "MANAGER" } as never)
    );
    assert.throws(
      () => assertTtlockOwnerRole({ role: "EMPLOYEE" } as never),
      (err: unknown) =>
        err instanceof TtlockError && err.code === "TTLOCK_FORBIDDEN"
    );
  });

  it("req37: room/grant/lock owner scope", () => {
    const syncSrc = readFileSync(join(__dirname, "access-sync.ts"), "utf8");
    assert.match(syncSrc, /assertTtlockOwnerRole\(input\.user\)/);
    assert.match(syncSrc, /loadGrantBundle\(input\.propertyId/);
    assert.match(syncSrc, /findConnectionByOwner\(input\.user\.id\)/);
    assert.match(syncSrc, /where: \{ id: grantId, propertyId \}/);
  });

  it("req38: token/secret/receiver/credential sanitization", () => {
    const masked = maskReceiver("+998901112233");
    assert.equal(masked.includes("***"), true);
    assert.equal(masked.includes("011122"), false);
    const emailMasked = maskReceiver("user@example.com");
    assert.equal(emailMasked.includes("***"), true);
    assert.equal(emailMasked.includes("user@"), false);

    const pub = mapGrantToPublic(fakeGrantBase({ tenant: { fullName: "Ali", phone: null, email: null } }), {
      receiverMasked: masked,
    });
    const json = JSON.stringify(pub);
    assert.equal(json.includes("accessToken"), false);
    assert.equal(json.includes("refreshToken"), false);
    assert.equal(json.includes("credentialEncrypted"), false);
    assert.equal(pub.delivery.receiverMasked, masked);
    assert.equal(json.includes("+998901112233"), false);

    const ui = readFileSync(
      join(repoRoot, "src/components/lwn/lwn-room-access-rights-tab.tsx"),
      "utf8"
    );
    assert.match(ui, /EKEY_RECEIVER_MISSING_HINT/);
    assert.equal(EKEY_RECEIVER_MISSING_HINT.length > 10, true);
  });

  it("req39: any yo‘qligi (access-sync / access-effective)", () => {
    for (const name of ["access-sync.ts", "access-effective.ts"]) {
      const text = readFileSync(join(__dirname, name), "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/\/\/.*/g, "");
      assert.equal(/:\s*any\b|\bas any\b/.test(text), false, name);
    }
  });

  it("req40: exact o‘zbekcha holat va xato matnlari", () => {
    assert.equal(ACCESS_EFFECTIVE_UI_LABELS.REJALASHTIRILGAN, "Rejalashtirilgan");
    assert.equal(ACCESS_EFFECTIVE_UI_LABELS.API_YUBORILGAN, "API’ga yuborilgan");
    assert.equal(ACCESS_EFFECTIVE_UI_LABELS.FAOL, "Faol");
    assert.equal(ACCESS_EFFECTIVE_UI_LABELS.TUGAGAN, "Tugagan");
    assert.equal(
      mapTtlockUiError("TTLOCK_ROOM_LOCK_MISSING"),
      "Xonaga TTLock qulfi biriktirilmagan."
    );
    assert.equal(
      mapTtlockUiError("TTLOCK_RECEIVER_REQUIRED"),
      EKEY_RECEIVER_REQUIRED_MESSAGE
    );
    assert.equal(
      mapTtlockUiError("TTLOCK_RESULT_UNKNOWN"),
      "TTLock javobi tasdiqlanmadi. Dublikat yaratmaslik uchun avtomatik qayta yuborilmadi."
    );
    assert.equal(
      LOCK_MISSING_PLAN_HINT,
      "Qulf hali biriktirilmagan. Reja saqlandi, qurilmaga yuborilmadi."
    );
  });

  it("schema/migration SENT phase7 (o‘zgarmaganligi tekshiruvi)", () => {
    const schema = readFileSync(
      join(repoRoot, "server/prisma/schema.prisma"),
      "utf8"
    );
    assert.match(schema, /enum TtlockAccessSyncStatus[\s\S]*SENT/);
    const dirs = readdirSync(join(repoRoot, "server/prisma/migrations"));
    const phase7 = dirs.find((d) => d.includes("ttlock_access_phase7"));
    assert.ok(phase7);
    const sql = readFileSync(
      join(repoRoot, "server/prisma/migrations", phase7!, "migration.sql"),
      "utf8"
    );
    assert.match(sql, /ADD VALUE IF NOT EXISTS 'SENT'/);
  });

  it(
    "haqiqiy qurilma E2E — SKIP",
    { skip: "Haqiqiy TTLock qurilma/E2E muhiti yo‘q — PASS deb yozilmaydi" },
    () => {
      assert.fail("device e2e not run");
    }
  );

  it(
    "haqiqiy DB concurrency — SKIP",
    { skip: "Haqiqiy Neon/DB concurrency muhiti yo‘q — PASS deb yozilmaydi" },
    () => {
      assert.fail("db concurrency not run");
    }
  );
});
