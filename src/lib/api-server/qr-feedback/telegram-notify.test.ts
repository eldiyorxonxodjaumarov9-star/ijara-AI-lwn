import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

import {
  buildCleanlinessFeedbackTelegramText,
  buildPhotoCaption,
  isQrFeedbackTelegramDryRun,
  isQrFeedbackTelegramEnabled,
} from "./telegram-notify";

describe("QR feedback Telegram message format", () => {
  it("includes place, rating emoji, comment, photo count, Tashkent date fields", () => {
    const text = buildCleanlinessFeedbackTelegramText({
      placeLabel: "QR 01 / 3-qavat",
      ratingValue: 5,
      ratingKey: "EXCELLENT",
      comment: "Juda toza!",
      photoCount: 2,
      at: new Date("2026-11-25T10:00:00+05:00"),
    });
    assert.match(text, /YANGI TOZALIK BAHOSI/);
    assert.match(text, /QR 01 \/ 3-qavat/);
    assert.match(text, /😍/);
    assert.match(text, /5\/5/);
    assert.match(text, /Juda toza!/);
    assert.match(text, /Rasmlar: 2/);
    assert.match(text, /Sana:/);
    assert.match(text, /Vaqt:/);
    assert.equal(text.includes("⚠️"), false);
  });

  it("marks 1–2 star ratings with warning", () => {
    const text = buildCleanlinessFeedbackTelegramText({
      placeLabel: "QR 32",
      ratingValue: 1,
      ratingKey: "VERY_BAD",
      comment: null,
      photoCount: 0,
    });
    assert.match(text, /⚠️/);
    assert.match(text, /😡/);
    assert.match(text, /Izoh yo‘q/);
  });

  it("builds short photo caption with place and rating", () => {
    const cap = buildPhotoCaption({
      placeLabel: "Xona 12",
      ratingValue: 4,
      ratingKey: "GOOD",
    });
    assert.match(cap, /Xona 12/);
    assert.match(cap, /4\/5/);
    assert.match(cap, /🙂/);
  });
});

describe("QR feedback Telegram flags", () => {
  it("reads enable / dry-run env flags", () => {
    const prevE = process.env.IJARA_QR_FEEDBACK_TELEGRAM_ENABLED;
    const prevD = process.env.IJARA_QR_FEEDBACK_TELEGRAM_DRY_RUN;
    try {
      process.env.IJARA_QR_FEEDBACK_TELEGRAM_ENABLED = "true";
      process.env.IJARA_QR_FEEDBACK_TELEGRAM_DRY_RUN = "1";
      assert.equal(isQrFeedbackTelegramEnabled(), true);
      assert.equal(isQrFeedbackTelegramDryRun(), true);
      process.env.IJARA_QR_FEEDBACK_TELEGRAM_ENABLED = "false";
      assert.equal(isQrFeedbackTelegramEnabled(), false);
    } finally {
      if (prevE === undefined) delete process.env.IJARA_QR_FEEDBACK_TELEGRAM_ENABLED;
      else process.env.IJARA_QR_FEEDBACK_TELEGRAM_ENABLED = prevE;
      if (prevD === undefined) delete process.env.IJARA_QR_FEEDBACK_TELEGRAM_DRY_RUN;
      else process.env.IJARA_QR_FEEDBACK_TELEGRAM_DRY_RUN = prevD;
    }
  });
});

describe("attendance handler ignores bot / QR echoes", () => {
  it("handler skips is_bot and tozalik captions", () => {
    const src = readFileSync(
      join(process.cwd(), "src/lib/api-server/attendance-bot/handler.ts"),
      "utf8"
    );
    assert.match(src, /from\.is_bot/);
    assert.match(src, /YANGI TOZALIK BAHOSI/);
  });

  it("submit schedules telegram without awaiting failure into form", () => {
    const src = readFileSync(
      join(process.cwd(), "src/lib/api-server/qr-feedback/service.ts"),
      "utf8"
    );
    assert.match(src, /scheduleCleanlinessFeedbackTelegram/);
    assert.match(src, /duplicate: true/);
  });

  it("uses after() + cron outbox for durable delivery", () => {
    const notify = readFileSync(
      join(process.cwd(), "src/lib/api-server/qr-feedback/telegram-notify.ts"),
      "utf8"
    );
    assert.match(notify, /from "next\/server"/);
    assert.match(notify, /\bafter\(/);
    assert.match(notify, /processPendingQrFeedbackTelegram/);
    const cron = readFileSync(
      join(process.cwd(), "src/app/api/cron/qr-feedback-telegram/route.ts"),
      "utf8"
    );
    assert.match(cron, /assertFailClosedCronAuth/);
    assert.match(cron, /processPendingQrFeedbackTelegram/);
  });
});
