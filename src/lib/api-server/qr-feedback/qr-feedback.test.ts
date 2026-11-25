/**
 * Stage 1 QR cleanliness feedback — unit/smoke assertions (no DB required).
 */
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

import {
  QR_CODE_SLOT_COUNT,
  RATING_BY_VALUE,
  RATING_META,
  FEEDBACK_MAX_PHOTOS,
  FEEDBACK_ALLOWED_MIME,
  FEEDBACK_STATUS_LABELS,
  defaultQrName,
  publicFeedbackPath,
} from "./constants";
import { inspectQrPublicOrigin } from "./public-origin";
import { canAccessResource } from "../rbac";

const root = process.cwd();

describe("QR feedback constants", () => {
  it("defines exactly 32 slots and QR 01–32 default names", () => {
    assert.equal(QR_CODE_SLOT_COUNT, 32);
    assert.equal(defaultQrName(1), "QR 01");
    assert.equal(defaultQrName(32), "QR 32");
  });

  it("maps 5 rating values with emoji labels", () => {
    assert.equal(Object.keys(RATING_META).length, 5);
    assert.equal(RATING_BY_VALUE[1], "VERY_BAD");
    assert.equal(RATING_BY_VALUE[5], "EXCELLENT");
    assert.equal(RATING_META.EXCELLENT.emoji, "😍");
    assert.equal(RATING_META.VERY_BAD.label, "Juda yomon");
  });

  it("limits photos and mime types", () => {
    assert.equal(FEEDBACK_MAX_PHOTOS, 3);
    assert.ok(FEEDBACK_ALLOWED_MIME.has("image/jpeg"));
    assert.ok(FEEDBACK_ALLOWED_MIME.has("image/png"));
    assert.ok(FEEDBACK_ALLOWED_MIME.has("image/webp"));
    assert.equal(FEEDBACK_ALLOWED_MIME.has("image/gif"), false);
  });

  it("exposes status labels", () => {
    assert.equal(FEEDBACK_STATUS_LABELS.NEW, "Yangi");
    assert.equal(FEEDBACK_STATUS_LABELS.RESOLVED, "Hal qilindi");
  });

  it("builds public path with token", () => {
    assert.equal(publicFeedbackPath("abcToken"), "/f/abcToken");
  });
});

describe("QR public origin", () => {
  it("rejects localhost and null-like values", () => {
    const prev = {
      IJARA_QR_PUBLIC_ORIGIN: process.env.IJARA_QR_PUBLIC_ORIGIN,
      QR_PUBLIC_ORIGIN: process.env.QR_PUBLIC_ORIGIN,
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
      APP_URL: process.env.APP_URL,
      IJARA_QR_ALLOW_LOCALHOST: process.env.IJARA_QR_ALLOW_LOCALHOST,
    };
    try {
      delete process.env.IJARA_QR_PUBLIC_ORIGIN;
      delete process.env.QR_PUBLIC_ORIGIN;
      delete process.env.APP_URL;
      delete process.env.IJARA_QR_ALLOW_LOCALHOST;
      process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
      const blocked = inspectQrPublicOrigin();
      assert.equal(blocked.ok, false);

      process.env.NEXT_PUBLIC_APP_URL = "null";
      assert.equal(inspectQrPublicOrigin().ok, false);

      // Localhost candidate is skipped when a phone-safe origin exists later
      process.env.IJARA_QR_PUBLIC_ORIGIN = "http://localhost:3000";
      process.env.NEXT_PUBLIC_APP_URL = "https://ijaraai.uz";
      const preferProd = inspectQrPublicOrigin();
      assert.equal(preferProd.ok, true);
      if (preferProd.ok) {
        assert.equal(preferProd.origin, "https://ijaraai.uz");
      }

      process.env.IJARA_QR_PUBLIC_ORIGIN = "http://192.168.0.109:3000";
      const ok = inspectQrPublicOrigin();
      assert.equal(ok.ok, true);
      if (ok.ok) {
        assert.equal(ok.origin, "http://192.168.0.109:3000");
      }

      process.env.IJARA_QR_PUBLIC_ORIGIN = "https://ijaraai.uz";
      const prod = inspectQrPublicOrigin();
      assert.equal(prod.ok, true);
      if (prod.ok) assert.equal(prod.origin, "https://ijaraai.uz");
    } finally {
      for (const [k, v] of Object.entries(prev)) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
      }
    }
  });
});

describe("QR feedback RBAC", () => {
  it("staff can manage qr-codes; employee cannot", () => {
    assert.equal(canAccessResource("ADMIN", "qr-codes", "GET"), true);
    assert.equal(canAccessResource("MANAGER", "qr-codes", "POST"), true);
    assert.equal(canAccessResource("EMPLOYEE", "qr-codes", "GET"), false);
    assert.equal(canAccessResource("EMPLOYEE", "qr-codes", "POST"), false);
  });
});

describe("QR feedback source wiring", () => {
  it("ensureWorkspaceQrCodes never rotates tokens (source contract)", () => {
    const src = readFileSync(
      join(root, "src/lib/api-server/qr-feedback/service.ts"),
      "utf8"
    );
    assert.match(src, /Never rotates existing publicToken/);
    assert.match(src, /if \(have\.has\(i\)\) continue/);
    assert.doesNotMatch(src, /publicToken:\s*newPublicToken\(\)[\s\S]*updateMany/);
  });

  it("sidebar includes QR kodlar after Davomat", () => {
    const nav = readFileSync(join(root, "src/config/navigation.ts"), "utf8");
    const attendanceIdx = nav.indexOf('href: "/attendance"');
    const qrIdx = nav.indexOf('href: "/qr-codes"');
    assert.ok(attendanceIdx > 0);
    assert.ok(qrIdx > attendanceIdx);
    assert.match(nav, /titleKey:\s*"nav\.qrCodes"/);
  });

  it("admin and public routes exist", () => {
    assert.ok(existsSync(join(root, "src/app/(dashboard)/qr-codes/page.tsx")));
    assert.ok(existsSync(join(root, "src/app/f/[token]/page.tsx")));
    assert.ok(existsSync(join(root, "src/app/api/qr-codes/route.ts")));
    assert.ok(
      existsSync(join(root, "src/app/api/public/feedback/[token]/route.ts"))
    );
    assert.ok(
      existsSync(join(root, "src/app/api/qr-codes/photos/[id]/route.ts"))
    );
  });

  it("prisma models are declared", () => {
    const schema = readFileSync(
      join(root, "server/prisma/schema.prisma"),
      "utf8"
    );
    for (const model of [
      "FeedbackQrCode",
      "CleanlinessFeedback",
      "CleanlinessFeedbackPhoto",
      "FeedbackStatusEvent",
    ]) {
      assert.match(schema, new RegExp(`model ${model}\\b`));
    }
  });
});
