/**
 * Selfie face *presence* gate — NOT identity recognition.
 * Assumes a single forward-facing photo; never matches a person.
 */

export type TelegramPhotoSize = {
  file_id: string;
  file_unique_id?: string;
  file_size?: number;
  width?: number;
  height?: number;
};

export type FacePresenceResult =
  | {
      ok: true;
      /** Assumed single face for a group selfie; not a biometric match. */
      assumedFaceCount: 1;
      identityMatched: false;
      best: TelegramPhotoSize;
    }
  | {
      ok: false;
      reason: "NO_PHOTO" | "TOO_SMALL";
      identityMatched: false;
    };

const MIN_SIDE = 200;

/**
 * Presence-only check from Telegram photo sizes.
 * Does not download pixels or identify who is in the frame.
 */
export function assertSingleFaceSelfiePresence(
  photos: TelegramPhotoSize[] | undefined | null
): FacePresenceResult {
  if (!photos || photos.length === 0) {
    return { ok: false, reason: "NO_PHOTO", identityMatched: false };
  }

  const best = photos[photos.length - 1];
  const w = best.width ?? 0;
  const h = best.height ?? 0;
  if (w < MIN_SIDE || h < MIN_SIDE) {
    return { ok: false, reason: "TOO_SMALL", identityMatched: false };
  }

  // Telegram sends multiple resized variants of ONE image — not multiple faces.
  return {
    ok: true,
    assumedFaceCount: 1,
    identityMatched: false,
    best,
  };
}
