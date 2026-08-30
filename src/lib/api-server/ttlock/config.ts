/**
 * TTLock/Sciener server-only konfiguratsiya.
 * Secretlar hech qachon frontendga qaytarilmasin.
 */

export const TTLOCK_REQUIRED_FIELDS = [
  "TTLOCK_CLIENT_ID",
  "TTLOCK_CLIENT_SECRET",
  "TTLOCK_ACCOUNT_USERNAME",
  "TTLOCK_ACCOUNT_PASSWORD_MD5",
  "TTLOCK_TOKEN_ENCRYPTION_KEY",
] as const;

export type TtlockRequiredField = (typeof TTLOCK_REQUIRED_FIELDS)[number];

export type TtlockEnvConfig = {
  clientId: string;
  clientSecret: string;
  username: string;
  passwordMd5: string;
  apiBaseUrl: string;
  encryptionKey: string;
};

export type TtlockPublicConfigStatus = {
  configured: boolean;
  missingFields: string[];
  environment: "eu";
};

function trimEnv(name: string): string {
  return process.env[name]?.trim() ?? "";
}

export function getTtlockApiBaseUrl(): string {
  const raw = trimEnv("TTLOCK_API_BASE_URL") || "https://euapi.ttlock.com";
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:") {
      return "https://euapi.ttlock.com";
    }
    return url.origin;
  } catch {
    return "https://euapi.ttlock.com";
  }
}

export function listMissingTtlockFields(): string[] {
  const missing: string[] = [];
  for (const field of TTLOCK_REQUIRED_FIELDS) {
    if (!trimEnv(field)) missing.push(field);
  }
  const key = trimEnv("TTLOCK_TOKEN_ENCRYPTION_KEY");
  if (key && !isValidEncryptionKeyMaterial(key)) {
    if (!missing.includes("TTLOCK_TOKEN_ENCRYPTION_KEY")) {
      missing.push("TTLOCK_TOKEN_ENCRYPTION_KEY");
    }
  }
  const md5 = trimEnv("TTLOCK_ACCOUNT_PASSWORD_MD5");
  if (md5 && !/^[a-f0-9]{32}$/.test(md5)) {
    if (!missing.includes("TTLOCK_ACCOUNT_PASSWORD_MD5")) {
      missing.push("TTLOCK_ACCOUNT_PASSWORD_MD5");
    }
  }
  return missing;
}

/** Hex (64) yoki utf8 (32+) kalit material */
export function isValidEncryptionKeyMaterial(value: string): boolean {
  if (/^[a-fA-F0-9]{64}$/.test(value)) return true;
  return Buffer.byteLength(value, "utf8") >= 32;
}

export function isTtlockConfigured(): boolean {
  return listMissingTtlockFields().length === 0;
}

/** Frontendga xavfsiz status — hech qanday secret qiymati yo‘q */
export function getTtlockPublicConfigStatus(): TtlockPublicConfigStatus {
  return {
    configured: isTtlockConfigured(),
    missingFields: listMissingTtlockFields(),
    environment: "eu",
  };
}

/**
 * To‘liq konfiguratsiya. Tayyor bo‘lmasa null.
 * Chaqiruvchi TTLOCK_NOT_CONFIGURED xatosini qaytarsin.
 */
export function readTtlockEnvConfig(): TtlockEnvConfig | null {
  if (!isTtlockConfigured()) return null;
  return {
    clientId: trimEnv("TTLOCK_CLIENT_ID"),
    clientSecret: trimEnv("TTLOCK_CLIENT_SECRET"),
    username: trimEnv("TTLOCK_ACCOUNT_USERNAME"),
    passwordMd5: trimEnv("TTLOCK_ACCOUNT_PASSWORD_MD5").toLowerCase(),
    apiBaseUrl: getTtlockApiBaseUrl(),
    encryptionKey: trimEnv("TTLOCK_TOKEN_ENCRYPTION_KEY"),
  };
}
