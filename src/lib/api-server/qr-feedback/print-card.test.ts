/**
 * Print-ready QR card — layout, wrap, unicode, token stability in payload.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import jsQR from "jsqr";
import sharp from "sharp";

import {
  DEFAULT_PRINT_INSTRUCTION,
  PRINT_CARD_FOOTER,
  resolveQrRoomLabel,
  defaultQrName,
} from "./constants";
import {
  buildPrintCardPng,
  buildPrintCardSvg,
  wrapPrintText,
} from "./print-card";

describe("resolveQrRoomLabel", () => {
  it("prefers roomNumber over location and name", () => {
    assert.equal(
      resolveQrRoomLabel({
        roomNumber: "206-XONA",
        locationLabel: "3-qavat",
        name: defaultQrName(1),
      }),
      "206-XONA"
    );
    assert.equal(
      resolveQrRoomLabel({
        roomNumber: null,
        locationLabel: null,
        name: defaultQrName(32),
      }),
      "QR 32"
    );
  });
});

describe("wrapPrintText", () => {
  it("wraps long Uzbek text without dropping unicode", () => {
    const text =
      "Xonamiz tozaligini baholang va kamchiliklar rasmini jo‘nating — O‘zbekcha G‘alaba";
    const lines = wrapPrintText(text, 24);
    assert.ok(lines.length >= 2);
    assert.ok(lines.join(" ").includes("jo‘nating"));
    assert.ok(lines.join(" ").includes("O‘zbekcha"));
    assert.ok(lines.join(" ").includes("G‘alaba"));
  });
});

describe("print card assets", () => {
  const prev = {
    IJARA_QR_PUBLIC_ORIGIN: process.env.IJARA_QR_PUBLIC_ORIGIN,
    QR_PUBLIC_ORIGIN: process.env.QR_PUBLIC_ORIGIN,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    APP_URL: process.env.APP_URL,
    IJARA_QR_ALLOW_LOCALHOST: process.env.IJARA_QR_ALLOW_LOCALHOST,
  };

  it("SVG/PNG include room + instruction and keep token URL", async () => {
    try {
      process.env.IJARA_QR_PUBLIC_ORIGIN = "https://ijaraai.uz";
      delete process.env.IJARA_QR_ALLOW_LOCALHOST;
      const token = "stablePrintToken01_doNotRotate";
      const fields = {
        publicToken: token,
        name: defaultQrName(1),
        roomNumber: "206-XONA",
        locationLabel: "2-qavat",
        printInstruction: DEFAULT_PRINT_INSTRUCTION,
      };

      const svg = await buildPrintCardSvg(fields);
      assert.match(svg, /206-XONA/);
      assert.match(svg, /Tozalik va kamchiliklar/);
      assert.match(svg, /rasmini jo.nating/);
      assert.ok(svg.includes(DEFAULT_PRINT_INSTRUCTION.split(" ")[0]!));
      assert.match(svg, new RegExp(PRINT_CARD_FOOTER.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
      assert.match(svg, /IJARA AI/);
      assert.doesNotMatch(svg, /publicToken/);
      // Wrapped across tspans — full sentence still present when tspans joined
      const instructionJoined = [...svg.matchAll(/<tspan[^>]*>([^<]*)<\/tspan>/g)]
        .map((m) => m[1])
        .join(" ");
      assert.equal(instructionJoined, DEFAULT_PRINT_INSTRUCTION);

      const png = await buildPrintCardPng(fields);
      assert.equal(png[0], 0x89);
      assert.equal(png[1], 0x50);
      assert.ok(png.byteLength > 20_000);

      const { data, info } = await sharp(png)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      const decoded = jsQR(
        new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength),
        info.width,
        info.height
      );
      assert.ok(decoded, "QR must decode from print PNG");
      assert.equal(decoded!.data, `https://ijaraai.uz/f/${token}`);

      const longFields = {
        ...fields,
        roomNumber: "305-XONA",
        printInstruction:
          "Xonamiz tozaligini baholang va juda uzun matn avtomatik qatordan-qatorga o‘tsin O‘ G‘",
      };
      const longSvg = await buildPrintCardSvg(longFields);
      assert.match(longSvg, /305-XONA/);
      assert.match(longSvg, /<tspan /);
      assert.ok((longSvg.match(/<tspan /g) || []).length >= 2);
    } finally {
      for (const [k, v] of Object.entries(prev)) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
      }
    }
  });
});
