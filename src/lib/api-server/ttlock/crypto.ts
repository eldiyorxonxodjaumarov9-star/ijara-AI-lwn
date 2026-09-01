import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

import { isValidEncryptionKeyMaterial } from "./config";
import { TtlockError } from "./errors";

const ALGO = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const VERSION_PREFIX = "v1";

function deriveKey(material: string): Buffer {
  if (!isValidEncryptionKeyMaterial(material)) {
    throw new TtlockError(
      "TTLOCK_TOKEN_ENCRYPTION_KEY noto'g'ri (64 hex yoki kamida 32 bayt)",
      "TTLOCK_ENCRYPTION_KEY_INVALID"
    );
  }
  if (/^[a-fA-F0-9]{64}$/.test(material)) {
    return Buffer.from(material, "hex");
  }
  // utf8 material → SHA-256 digest (32 bayt)
  return createHash("sha256").update(material, "utf8").digest();
}

function getKeyFromEnv(): Buffer {
  const material = process.env.TTLOCK_TOKEN_ENCRYPTION_KEY?.trim() ?? "";
  if (!material) {
    throw new TtlockError(
      "TTLOCK_TOKEN_ENCRYPTION_KEY sozlanmagan",
      "TTLOCK_ENCRYPTION_KEY_MISSING"
    );
  }
  return deriveKey(material);
}

/**
 * AES-256-GCM. Natija: v1:ivHex:tagHex:cipherHex
 * Token/parol/kalit log qilinmasin.
 */
export function encryptSecret(plaintext: string, keyMaterial?: string): string {
  if (!plaintext) {
    throw new TtlockError("Shifrlash uchun matn bo'sh", "TTLOCK_ENCRYPT_EMPTY");
  }
  const key = keyMaterial ? deriveKey(keyMaterial) : getKeyFromEnv();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [
    VERSION_PREFIX,
    iv.toString("hex"),
    tag.toString("hex"),
    encrypted.toString("hex"),
  ].join(":");
}

export function decryptSecret(payload: string, keyMaterial?: string): string {
  if (!payload?.trim()) {
    throw new TtlockError("Shifrlangan matn bo'sh", "TTLOCK_DECRYPT_EMPTY");
  }
  const parts = payload.split(":");
  if (parts.length !== 4 || parts[0] !== VERSION_PREFIX) {
    throw new TtlockError(
      "Shifrlangan token formati yaroqsiz",
      "TTLOCK_DECRYPT_FORMAT"
    );
  }
  const [, ivHex, tagHex, dataHex] = parts;
  if (!ivHex || !tagHex || !dataHex) {
    throw new TtlockError(
      "Shifrlangan token formati yaroqsiz",
      "TTLOCK_DECRYPT_FORMAT"
    );
  }

  try {
    const key = keyMaterial ? deriveKey(keyMaterial) : getKeyFromEnv();
    const iv = Buffer.from(ivHex, "hex");
    const tag = Buffer.from(tagHex, "hex");
    const data = Buffer.from(dataHex, "hex");
    if (iv.length !== IV_LENGTH || tag.length !== AUTH_TAG_LENGTH) {
      throw new TtlockError(
        "Shifrlangan token formati yaroqsiz",
        "TTLOCK_DECRYPT_FORMAT"
      );
    }
    const decipher = createDecipheriv(ALGO, key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
    return decrypted.toString("utf8");
  } catch (err) {
    if (err instanceof TtlockError) throw err;
    throw new TtlockError(
      "Tokenni ochib bo'lmadi (kalit noto'g'ri yoki ma'lumot buzilgan)",
      "TTLOCK_DECRYPT_FAILED"
    );
  }
}
