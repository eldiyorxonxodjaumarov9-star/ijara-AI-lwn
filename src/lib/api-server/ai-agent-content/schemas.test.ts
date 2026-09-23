import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  AI_AGENT_MEDIA_CATEGORIES,
  AI_AGENT_SCRIPT_CATEGORIES,
  aiAgentContactSchema,
  aiAgentLocationSchema,
  aiAgentMediaSchema,
  aiAgentScriptSchema,
  emptyToNull,
  matchesSearch,
  normalizeContactInput,
  normalizeLocationInput,
  normalizeMediaInput,
} from "./schemas";

describe("AI Agent content schemas", () => {
  it("accepts valid script payload", () => {
    const parsed = aiAgentScriptSchema.safeParse({
      title: "Salom",
      category: "GREETING",
      content: "Assalomu alaykum!",
      active: true,
    });
    assert.equal(parsed.success, true);
  });

  it("rejects empty script content", () => {
    const parsed = aiAgentScriptSchema.safeParse({
      title: "X",
      category: "GENERAL",
      content: "   ",
    });
    assert.equal(parsed.success, false);
  });

  it("exposes expected script and media categories", () => {
    assert.ok(AI_AGENT_SCRIPT_CATEGORIES.includes("PRICE_INFO"));
    assert.ok(AI_AGENT_MEDIA_CATEGORIES.includes("ROOM"));
  });

  it("normalizes location empty optional fields to null", () => {
    const out = normalizeLocationInput({
      title: "LWN",
      address: "Toshkent",
      landmark: "  ",
      mapUrl: "",
      workingHours: "9-18",
      description: null,
      active: true,
    });
    assert.equal(out.landmark, null);
    assert.equal(out.mapUrl, null);
    assert.equal(out.workingHours, "9-18");
  });

  it("strips @ from telegram username", () => {
    const out = normalizeContactInput({
      name: "Ali",
      telegramUsername: "@manager_lwn",
      active: true,
    });
    assert.equal(out.telegramUsername, "manager_lwn");
  });

  it("keeps media roomId when valid uuid", () => {
    const roomId = "11111111-1111-1111-1111-111111111111";
    const parsed = aiAgentMediaSchema.safeParse({
      title: "Room 305",
      category: "ROOM",
      roomId,
      fileUrl: "https://blob.example/x.jpg",
      sortOrder: 2,
    });
    assert.equal(parsed.success, true);
    if (parsed.success) {
      const out = normalizeMediaInput(parsed.data);
      assert.equal(out.roomId, roomId);
      assert.equal(out.sortOrder, 2);
    }
  });

  it("rejects invalid media fileUrl", () => {
    const parsed = aiAgentMediaSchema.safeParse({
      title: "X",
      category: "OTHER",
      fileUrl: "not-a-url",
    });
    assert.equal(parsed.success, false);
  });

  it("emptyToNull and matchesSearch helpers", () => {
    assert.equal(emptyToNull("  "), null);
    assert.equal(emptyToNull("ok"), "ok");
    assert.equal(matchesSearch(["Hello world"], "wor"), true);
    assert.equal(matchesSearch(["Hello"], "zzz"), false);
  });

  it("accepts location and contact schemas", () => {
    assert.equal(
      aiAgentLocationSchema.safeParse({
        title: "A",
        address: "B",
      }).success,
      true
    );
    assert.equal(
      aiAgentContactSchema.safeParse({
        name: "Operator",
        phone: "+998901112233",
      }).success,
      true
    );
  });
});
