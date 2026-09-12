/**
 * Maxsus PIN o‘rnatish — unit testlar (TTLock/Neon yo‘q).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import {
  derivePersistedSyncAfterSend,
  resolveAccessEffectiveStatus,
} from "./access-effective";
import {
  CUSTOM_PIN_GATEWAY_REQUIRED_MESSAGE,
  CUSTOM_PIN_MAX_LEN,
  CUSTOM_PIN_MIN_LEN,
  validateCustomKeyboardPin,
} from "@/lib/ttlock-custom-pin";
import { TTLOCK_ENDPOINTS } from "./types";
import { stripOneTimePasscode } from "@/lib/ttlock-access-view";

const __dirname = dirname(fileURLToPath(import.meta.url));

describe("TTLock custom PIN", () => {
  it("validates 4–9 digits only", () => {
    assert.equal(validateCustomKeyboardPin("").ok, false);
    assert.equal(validateCustomKeyboardPin("12a4").ok, false);
    assert.equal(validateCustomKeyboardPin("123").ok, false);
    assert.equal(validateCustomKeyboardPin("1".repeat(10)).ok, false);
    const ok = validateCustomKeyboardPin("1234");
    assert.equal(ok.ok, true);
    if (ok.ok) assert.equal(ok.pin, "1234");
    assert.equal(validateCustomKeyboardPin("123456789").ok, true);
    assert.equal(CUSTOM_PIN_MIN_LEN, 4);
    assert.equal(CUSTOM_PIN_MAX_LEN, 9);
  });

  it("deviceUnverified → SENT; SENT never FAOL", () => {
    const from = new Date("2026-09-10T05:00:00Z");
    const to = new Date("2026-09-20T05:00:00Z");
    assert.equal(
      derivePersistedSyncAfterSend({
        validFrom: from,
        validTo: to,
        now: new Date("2026-09-12T00:00:00Z"),
        deviceUnverified: true,
      }),
      "SENT"
    );
    assert.equal(
      resolveAccessEffectiveStatus({
        grantStatus: "PLANNED",
        validFrom: from,
        validTo: to,
        syncStatus: "SENT",
        hasCredential: true,
        now: new Date("2026-09-12T00:00:00Z"),
      }),
      "API_YUBORILGAN"
    );
  });

  it("wires keyboardPwd/add + gateway gate + no PIN echo", () => {
    const syncSrc = readFileSync(join(__dirname, "access-sync.ts"), "utf8");
    assert.match(syncSrc, /addCustomKeyboardPwd/);
    assert.match(syncSrc, /install_blocked/);
    assert.match(syncSrc, /cloud_accepted/);
    assert.match(syncSrc, /CUSTOM_PIN_GATEWAY_REQUIRED_MESSAGE/);
    assert.match(syncSrc, /deviceUnverified:\s*true/);
    assert.equal(syncSrc.includes("oneTimePasscode = pin"), false);

    const clientSrc = readFileSync(join(__dirname, "client.ts"), "utf8");
    assert.match(clientSrc, /keyboardPwdAdd/);
    assert.equal(TTLOCK_ENDPOINTS.keyboardPwdAdd, "/v3/keyboardPwd/add");

    const routeSrc = readFileSync(
      join(__dirname, "../../../app/api/lwn-rooms/[propertyId]/access-grants/route.ts"),
      "utf8"
    );
    assert.match(routeSrc, /customPin/);
    assert.equal(routeSrc.includes("oneTimePasscode: body"), false);

    const uiSrc = readFileSync(
      join(__dirname, "../../../components/lwn/lwn-room-access-rights-tab.tsx"),
      "utf8"
    );
    assert.match(uiSrc, /custom-pin-input/);
    assert.match(uiSrc, /Qulfga o‘rnatish/);
    assert.match(uiSrc, /Faqat reja saqlash/);
    assert.match(uiSrc, /install_blocked/);
    assert.ok(CUSTOM_PIN_GATEWAY_REQUIRED_MESSAGE.includes("Gateway"));

    const stripped = stripOneTimePasscode({
      id: "g1",
      oneTimePasscode: "999999",
      syncOutcome: "cloud_accepted" as const,
    });
    assert.equal("oneTimePasscode" in stripped, false);
  });
});
