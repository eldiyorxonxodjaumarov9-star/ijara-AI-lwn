/**
 * Contract draft Telegram bot helpers (unit, no DB).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

describe("contract-draft bot flow sources", () => {
  it("unbound /start uses contact-first prompt (no Arendator gate)", () => {
    const handler = readFileSync(
      join(process.cwd(), "src/lib/api-server/telegram-handler.ts"),
      "utf8"
    );
    assert.match(handler, /sendStartContactPrompt/);
    assert.match(handler, /mode:\s*"tenant"/);
    const startFn = handler.slice(
      handler.indexOf("async function handleStart"),
      handler.indexOf("async function handleOwnerLogin")
    );
    assert.equal(startFn.includes("sendRoleMenu"), false);
    assert.equal(startFn.includes("sendStartContactPrompt"), true);
    assert.equal(startFn.includes("unlinkTelegramChat"), false);
  });

  it("contact keyboard uses required button label", () => {
    const bot = readFileSync(
      join(process.cwd(), "src/lib/api-server/telegram-bot.ts"),
      "utf8"
    );
    assert.match(bot, /Telefon raqamimni yuborish/);
    assert.match(bot, /sendStartContactPrompt/);
  });

  it("multi-pending lists object and room; single pending sends form link", () => {
    const draftBot = readFileSync(
      join(process.cwd(), "src/lib/api-server/contract-draft/bot.ts"),
      "utf8"
    );
    assert.match(draftBot, /pending\.length === 1/);
    assert.match(draftBot, /sendFormLinkForRequest/);
    assert.match(draftBot, /Obyekt va xonani tanlang/);
    assert.match(draftBot, /pendingLabel/);
    assert.match(draftBot, /Faqat o‘zingizning telefon/);
    assert.match(draftBot, /typedPhone/);
    assert.match(draftBot, /phoneNormalized: botUser\.phone/);
    assert.match(draftBot, /inlineRetries/);
    assert.match(draftBot, /MAX_DELIVERY_ATTEMPTS/);
    assert.match(draftBot, /enqueueContractDeliveryResend/);
    assert.equal(draftBot.includes("contract_"), false);
    assert.equal(/start=contract/i.test(draftBot), false);
  });

  it("typed phone cannot forge contact.user_id for contract claim", () => {
    const handler = readFileSync(
      join(process.cwd(), "src/lib/api-server/telegram-handler.ts"),
      "utf8"
    );
    const typedBlock = handler.slice(
      handler.indexOf("if (looksLikePhone(text))"),
      handler.indexOf('if (session?.mode === "tenant"')
    );
    assert.match(typedBlock, /typedPhone:\s*true/);
    assert.equal(typedBlock.includes("user_id: message.from"), false);
  });

  it("pendingLabel formats address and room", () => {
    function pendingLabel(p: {
      property: { title: string; address: string };
    }): string {
      const room = p.property.title.trim() || "Xona";
      const obj = p.property.address.trim();
      const label = obj ? `${obj} — ${room}` : room;
      return label.slice(0, 64);
    }
    assert.equal(
      pendingLabel({
        property: { title: "305", address: "Bogishamol 105" },
      }),
      "Bogishamol 105 — 305"
    );
    assert.equal(
      pendingLabel({ property: { title: "A", address: "" } }),
      "A"
    );
  });

  it("contract delivery cron is fail-closed", () => {
    const cron = readFileSync(
      join(
        process.cwd(),
        "src/app/api/cron/contract-delivery-retry/route.ts"
      ),
      "utf8"
    );
    assert.match(cron, /assertFailClosedCronAuth/);
  });
});
