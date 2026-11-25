/**
 * Optional local/test PNG rasterizer (sharp). Not imported by public routes.
 */
import sharp from "sharp";

import {
  buildPrintCardSvg,
  type QrPrintFields,
} from "@/lib/api-server/qr-feedback/print-card";

export async function buildPrintCardPng(fields: QrPrintFields) {
  const svg = await buildPrintCardSvg(fields);
  return sharp(Buffer.from(svg, "utf8"), { density: 300 })
    .png({ compressionLevel: 9 })
    .toBuffer();
}
