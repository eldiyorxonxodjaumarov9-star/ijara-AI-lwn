import jsQR from "jsqr";

import { parseInstagramUrl } from "@/lib/ai/instagram";

/** QR matnidan Instagram havolasini ajratib oladi */
export function extractInstagramUrl(qrText: string): string | null {
  const trimmed = qrText.trim();
  if (!trimmed) return null;

  const username = parseInstagramUrl(trimmed);
  if (username) {
    return trimmed.startsWith("http")
      ? trimmed.split("?")[0]
      : `https://www.instagram.com/${username}/`;
  }

  if (/^[a-zA-Z0-9._]{1,30}$/.test(trimmed.replace(/^@/, ""))) {
    return `https://www.instagram.com/${trimmed.replace(/^@/, "")}/`;
  }

  return null;
}

export async function decodeQrFromImageFile(file: File): Promise<string | null> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(bitmap, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const code = jsQR(imageData.data, imageData.width, imageData.height);
  if (!code?.data) return null;
  return extractInstagramUrl(code.data);
}

export async function decodeQrFromCameraFrame(
  video: HTMLVideoElement
): Promise<string | null> {
  if (video.videoWidth === 0) return null;
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(video, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const code = jsQR(imageData.data, imageData.width, imageData.height);
  if (!code?.data) return null;
  return extractInstagramUrl(code.data);
}
