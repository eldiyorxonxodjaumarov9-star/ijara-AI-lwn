/**
 * Print-ready A6 QR card (SVG + PNG via sharp).
 * Tokens / public URLs are never modified here.
 */
import QRCode from "qrcode";
import sharp from "sharp";

import {
  DEFAULT_PRINT_INSTRUCTION,
  PRINT_CARD_FOOTER,
  publicFeedbackPath,
  resolveQrRoomLabel,
} from "@/lib/api-server/qr-feedback/constants";
import { requireQrPublicOrigin } from "@/lib/api-server/qr-feedback/public-origin";

function feedbackPublicUrl(token: string) {
  const { origin } = requireQrPublicOrigin();
  return `${origin}${publicFeedbackPath(token)}`;
}

/** A6 @ ~300dpi */
export const PRINT_CARD_WIDTH = 1240;
export const PRINT_CARD_HEIGHT = 1748;
const INK = "#0b3a6e";
const MUTED = "#1e4f82";

export type QrPrintFields = {
  publicToken: string;
  name: string;
  roomNumber?: string | null;
  locationLabel?: string | null;
  printInstruction?: string | null;
};

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Greedy wrap by approximate character width (Latin/Cyrillic/Uzbek). */
export function wrapPrintText(text: string, maxChars: number): string[] {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return [];
  if (maxChars < 8) maxChars = 8;
  const words = cleaned.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= maxChars) {
      current = next;
      continue;
    }
    if (current) lines.push(current);
    if (word.length > maxChars) {
      let rest = word;
      while (rest.length > maxChars) {
        lines.push(rest.slice(0, maxChars));
        rest = rest.slice(maxChars);
      }
      current = rest;
    } else {
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, 6);
}

export async function buildRawQrPng(token: string) {
  const url = feedbackPublicUrl(token);
  const dataUrl = await QRCode.toDataURL(url, {
    errorCorrectionLevel: "M",
    margin: 4,
    width: 720,
    color: { dark: "#0f172a", light: "#ffffff" },
  });
  return Buffer.from(dataUrl.split(",")[1] || "", "base64");
}

export async function buildRawQrSvg(token: string) {
  const url = feedbackPublicUrl(token);
  return QRCode.toString(url, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 4,
    color: { dark: "#0f172a", light: "#ffffff" },
  });
}

export async function buildPrintCardSvg(fields: QrPrintFields) {
  const room = resolveQrRoomLabel(fields);
  const instruction =
    fields.printInstruction?.trim() || DEFAULT_PRINT_INSTRUCTION;
  const url = feedbackPublicUrl(fields.publicToken);
  const qrDataUrl = await QRCode.toDataURL(url, {
    errorCorrectionLevel: "H",
    margin: 4,
    width: 720,
    color: { dark: "#0f172a", light: "#ffffff" },
  });

  const w = PRINT_CARD_WIDTH;
  const h = PRINT_CARD_HEIGHT;
  const qrSize = 720;
  const qrX = (w - qrSize) / 2;
  const qrY = 430;

  const instructionLines = wrapPrintText(instruction, 28);
  const instructionStartY = qrY + qrSize + 90;
  const instructionTspans = instructionLines
    .map((line, i) => {
      const y = instructionStartY + i * 52;
      return `<tspan x="${w / 2}" y="${y}">${escapeXml(line)}</tspan>`;
    })
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="Ijara AI QR print card">
  <rect width="100%" height="100%" fill="#ffffff"/>
  <text x="${w / 2}" y="140" text-anchor="middle" font-family="Segoe UI, Arial, DejaVu Sans, sans-serif" font-size="42" font-weight="700" letter-spacing="6" fill="${INK}">IJARA AI</text>
  <text x="${w / 2}" y="290" text-anchor="middle" font-family="Segoe UI, Arial, DejaVu Sans, sans-serif" font-size="78" font-weight="800" fill="${INK}">${escapeXml(room)}</text>
  <rect x="${qrX - 18}" y="${qrY - 18}" width="${qrSize + 36}" height="${qrSize + 36}" rx="28" fill="#ffffff" stroke="#dbe7f5" stroke-width="3"/>
  <image href="${qrDataUrl}" x="${qrX}" y="${qrY}" width="${qrSize}" height="${qrSize}" />
  <text text-anchor="middle" font-family="Segoe UI, Arial, DejaVu Sans, sans-serif" font-size="40" font-weight="600" fill="${MUTED}">${instructionTspans}</text>
  <text x="${w / 2}" y="${h - 110}" text-anchor="middle" font-family="Segoe UI, Arial, DejaVu Sans, sans-serif" font-size="28" fill="${MUTED}">${escapeXml(PRINT_CARD_FOOTER)}</text>
</svg>`;
}

export async function buildPrintCardPng(fields: QrPrintFields) {
  const svg = await buildPrintCardSvg(fields);
  return sharp(Buffer.from(svg, "utf8"), { density: 300 })
    .png({ compressionLevel: 9 })
    .toBuffer();
}
