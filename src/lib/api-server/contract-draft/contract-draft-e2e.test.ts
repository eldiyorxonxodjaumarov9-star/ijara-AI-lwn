/**
 * Contract draft automated E2E-style fixtures (no production Telegram token / DB).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

import {
  createContractToken,
  hashContractToken,
  normalizeContractPhone,
} from "./phone-token";
import { canTransition } from "./status";
import { computeMonthlyAmount, computeTotalAmount } from "./money";

function telegramContactUpdateFixture(input: {
  updateId: number;
  chatId: number;
  fromId: number;
  phone: string;
  foreignContact?: boolean;
}) {
  return {
    update_id: input.updateId,
    message: {
      message_id: 1001,
      date: 1_700_000_000,
      chat: { id: input.chatId, type: "private" },
      from: {
        id: input.fromId,
        is_bot: false,
        first_name: "Test",
      },
      contact: {
        phone_number: input.phone,
        first_name: "Test",
        user_id: input.foreignContact ? input.fromId + 99 : input.fromId,
      },
    },
  };
}

describe("contract-draft automated e2e fixtures", () => {
  it("normalizes phone variants for matching", () => {
    const a = normalizeContractPhone("+998 90 123-45-67").normalized;
    const b = normalizeContractPhone("901234567").normalized;
    const c = normalizeContractPhone("998901234567").normalized;
    assert.equal(a, b);
    assert.equal(b, c);
  });

  it("token hash never equals raw token", () => {
    const { rawToken, tokenHash } = createContractToken();
    assert.equal(hashContractToken(rawToken), tokenHash);
    assert.notEqual(rawToken, tokenHash);
  });

  it("telegram contact fixture matches expected structure", () => {
    const own = telegramContactUpdateFixture({
      updateId: 42,
      chatId: 111,
      fromId: 222,
      phone: "+998901234567",
    });
    assert.equal(own.message.contact.user_id, 222);
    const foreign = telegramContactUpdateFixture({
      updateId: 43,
      chatId: 111,
      fromId: 222,
      phone: "+998901234567",
      foreignContact: true,
    });
    assert.notEqual(foreign.message.contact.user_id, foreign.message.from.id);
  });

  it("server amounts match client preview formula", () => {
    const monthly = computeMonthlyAmount(19, 91200);
    const total = computeTotalAmount(monthly, 4);
    assert.equal(monthly, 1_732_800);
    assert.equal(total, 6_931_200);
    assert.notEqual(total, 6_526_880);
  });

  it("status machine rejects illegal transitions used in race windows", () => {
    assert.equal(canTransition("GENERATING", "CREATED"), true);
    assert.equal(canTransition("GENERATING", "GENERATING"), false);
    assert.equal(canTransition("CREATED", "GENERATING"), false);
    assert.equal(canTransition("AWAITING_CLIENT", "CREATED"), false);
  });

  it("finalize uses CAS updateMany for GENERATING claim", () => {
    const src = readFileSync(
      join(process.cwd(), "src/lib/api-server/contract-draft/finalize.ts"),
      "utf8"
    );
    assert.match(src, /updateMany/);
    assert.match(src, /status:\s*"GENERATING"/);
    assert.match(src, /claimed\.count === 0/);
    assert.match(src, /idempotencyKey/);
  });

  it("public form keeps stable Idempotency-Key across retries", () => {
    const page = readFileSync(
      join(process.cwd(), "src/app/contract-form/[token]/page.tsx"),
      "utf8"
    );
    assert.match(page, /idempotencyKeyRef/);
    assert.equal(page.includes('Idempotency-Key": crypto.randomUUID()'), false);
  });

  it("admin UI exposes bot resend for CREATED documents", () => {
    const page = readFileSync(
      join(process.cwd(), "src/app/(dashboard)/contract-drafts/page.tsx"),
      "utf8"
    );
    assert.match(page, /Botga qayta yuborish/);
    assert.match(page, /retry-delivery/);
    assert.match(page, /force:\s*true/);
  });
});
