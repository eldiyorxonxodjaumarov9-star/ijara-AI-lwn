/**
 * Contract draft MVP — unit tests (DB/Telegram yo‘q).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import {
  amountToUzCyrillicWords,
  amountWithSomWords,
} from "./amount-words-uz-cyrl";
import {
  computeMonthlyAmount,
  computeTotalAmount,
  formatSomGrouped,
} from "./money";
import {
  createContractToken,
  hashContractToken,
  normalizeContractPhone,
} from "./phone-token";
import {
  canTransition,
  mapUiPartyToCategorySubtype,
} from "./status";
import {
  findUnresolvedPlaceholders,
  renderContractDocx,
} from "./docx-render";
import {
  adminCreateSchema,
  individualClientSchema,
  legalClientSchema,
} from "./validation";

const __dirname = dirname(fileURLToPath(import.meta.url));

describe("contract-draft money", () => {
  it("computes monthly and total without float", () => {
    assert.equal(computeMonthlyAmount(19, 91200), 1_732_800);
    assert.equal(computeTotalAmount(1_732_800, 4), 6_931_200);
    assert.notEqual(computeTotalAmount(1_732_800, 4), 6_526_880);
    assert.equal(formatSomGrouped(1732800), "1 732 800");
  });
});

describe("contract-draft amount words", () => {
  it("converts to uz cyrillic", () => {
    assert.match(amountToUzCyrillicWords(1_000_000), /миллион/);
    assert.match(amountWithSomWords(0), /нол/);
  });
});

describe("contract-draft phone/token", () => {
  it("normalizes UZ phone", () => {
    assert.equal(normalizeContractPhone("+998901234567").normalized, "998901234567");
    assert.equal(normalizeContractPhone("901234567").normalized, "998901234567");
    assert.throws(() => normalizeContractPhone("123"));
  });

  it("hashes token stably", () => {
    const { rawToken, tokenHash } = createContractToken();
    assert.equal(hashContractToken(rawToken), tokenHash);
    assert.notEqual(rawToken, tokenHash);
  });
});

describe("contract-draft status/template", () => {
  it("maps party types", () => {
    assert.equal(mapUiPartyToCategorySubtype("ytt").templateKind, "INDIVIDUAL");
    assert.equal(mapUiPartyToCategorySubtype("mchj").templateKind, "LEGAL_ENTITY");
  });

  it("allows status transitions", () => {
    assert.equal(canTransition("AWAITING_CLIENT", "GENERATING"), true);
    assert.equal(canTransition("CREATED", "CANCELLED"), false);
  });
});

describe("contract-draft validation", () => {
  it("validates admin and client schemas", () => {
    assert.equal(
      adminCreateSchema.safeParse({
        tenantId: "00000000-0000-4000-8000-000000000001",
        propertyId: "00000000-0000-4000-8000-000000000002",
        partyUiType: "individual",
        contractDate: "2026-09-01",
        startDate: "2026-09-01",
        endDate: "2026-12-31",
        serviceName: "Ofis",
        areaSqm: 20,
        ratePerSqm: 1000,
        monthCount: 3,
        paymentDueDay: 5,
        depositAmount: 1000,
        phone: "+998901234567",
      }).success,
      true
    );
    assert.equal(
      individualClientSchema.safeParse({
        fullName: "Test User",
        passportOrId: "AA1234567",
        jshshir: "12345678901234",
        address: "Toshkent shahri",
        phone: "+998901234567",
      }).success,
      true
    );
    assert.equal(
      legalClientSchema.safeParse({
        companyFullName: "Test MChJ",
        legalForm: "MChJ",
        directorFullName: "Director",
        authorityBasis: "ustav",
        legalAddress: "Toshkent",
        stir: "123456789",
        bankName: "Bank",
        mfo: "01158",
        accountNumber: "12345678901234567890",
        phone: "+998901234567",
      }).success,
      true
    );
  });
});

describe("contract-draft docx", () => {
  it("detects unresolved placeholders", () => {
    assert.deepEqual(findUnresolvedPlaceholders("Hello {{name}}"), ["name"]);
  });

  it("renders individual and legal templates", () => {
    const tplRoot = join(process.cwd(), "server/contract-templates/v1");
    assert.equal(existsSync(join(tplRoot, "individual.docx")), true);
    assert.equal(existsSync(join(tplRoot, "legal.docx")), true);

    const lessor = {
      lessorFullName: "TEST LESSOR",
      lessorPassport: "AA0000000",
      lessorJshshir: "00000000000000",
      lessorAddress: "Test manzil",
      lessorCity: "Тошкент шаҳри",
      lessorBankStir: "000000000",
      lessorBankMfo: "00000",
      lessorBankName: "Test Bank",
      lessorAccount: "00000000000000000000",
      lessorCardNumber: "0000000000000000",
      lessorPhone: "+998900000000",
    };

    const base = {
      contractNumber: "2026000001",
      contractDate: "01.09.2026",
      contractCity: "Тошкент шаҳри",
      lessor,
      propertyAddress: "Test manzil 1",
      roomName: "305",
      area: "20",
      serviceName: "Ofis ijarasi",
      ratePerSqm: "91 200",
      monthCount: "4",
      monthlyPayment: "1 824 000",
      totalAmount: "7 296 000",
      totalAmountWords: amountWithSomWords(7_296_000),
      paymentDueDay: "05",
      deposit: "1 000 000",
      depositWords: amountWithSomWords(1_000_000),
      startDate: "01.09.2026",
      endDate: "31.12.2026",
      tenantType: "Жисмоний шахс",
    };

    const ind = renderContractDocx({
      ...base,
      templateKind: "INDIVIDUAL",
      tenantFullName: "Test Tenant",
      passportOrId: "AA1111111",
      tenantJshshir: "11111111111111",
      tenantAddress: "Tenant manzil",
      tenantPhone: "+998901111111",
    });
    assert.ok(ind.buffer.byteLength > 1000);
    assert.equal(ind.sha256.length, 64);
    assert.equal(ind.buffer.toString("utf8").includes("RAXIMOVA"), false);

    const leg = renderContractDocx({
      ...base,
      templateKind: "LEGAL_ENTITY",
      tenantType: "МЧЖ",
      companyFullName: "Test Company",
      legalForm: "MChJ",
      directorFullName: "Director",
      authorityBasis: "ustav",
      legalAddress: "Legal manzil",
      stir: "123456789",
      bankName: "Bank",
      mfo: "01158",
      accountNumber: "1234567890",
      phone: "+998902222222",
    });
    assert.ok(leg.buffer.byteLength > 1000);
    // OOXML zip signature
    assert.equal(leg.buffer[0], 0x50);
    assert.equal(leg.buffer[1], 0x4b);
  });

  it("templates contain no reference PII", () => {
    for (const name of ["individual.docx", "legal.docx"]) {
      const buf = readFileSync(
        join(process.cwd(), "server/contract-templates/v1", name)
      );
      const text = buf.toString("utf8");
      assert.equal(/RAXIMOVA|42501920211418|86004904/i.test(text), false);
    }
  });
});
