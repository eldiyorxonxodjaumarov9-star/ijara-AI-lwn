import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  computeTelegramAiLeadStatus,
  mergeInterestedRoomIds,
} from "./telegram-ai-lead";

describe("Telegram AI lead status + room merge", () => {
  it("marks QUALIFYING when only partial requirements present", () => {
    assert.equal(
      computeTelegramAiLeadStatus({
        desiredArea: 30,
        businessType: "logistika",
        peopleCount: null,
        moveInDate: null,
      }),
      "QUALIFYING"
    );
  });

  it("marks QUALIFIED when area+business+people+moveIn present", () => {
    assert.equal(
      computeTelegramAiLeadStatus({
        desiredArea: 30,
        businessType: "logistika",
        peopleCount: 10,
        moveInDate: "oktabrdan",
      }),
      "QUALIFIED"
    );
  });

  it("merges interested room ids uniquely", () => {
    assert.deepEqual(mergeInterestedRoomIds(["a", "b"], ["b", "c"]), [
      "a",
      "b",
      "c",
    ]);
  });
});
