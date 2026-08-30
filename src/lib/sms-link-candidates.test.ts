import assert from "node:assert/strict";
import { describe, it } from "node:test";

/** Path-alias'siz nusxa — node:test uchun (asosiy modul @/ ishlatadi) */
function smsCandidateKey(tenantId: string, scopeKey: string) {
  return `${tenantId}:${scopeKey}`;
}

function scopeKeyFromContractId(contractId: string | null | undefined) {
  const id = contractId?.trim();
  return id ? id : "none";
}

describe("sms link candidate keys", () => {
  it("builds unique keys per contract scope", () => {
    assert.equal(smsCandidateKey("t1", "c1"), "t1:c1");
    assert.equal(smsCandidateKey("t1", "none"), "t1:none");
    assert.notEqual(
      smsCandidateKey("t1", "c1"),
      smsCandidateKey("t1", "c2")
    );
  });

  it("maps empty contract to none scope", () => {
    assert.equal(scopeKeyFromContractId(null), "none");
    assert.equal(scopeKeyFromContractId(""), "none");
    assert.equal(scopeKeyFromContractId("abc"), "abc");
  });
});
