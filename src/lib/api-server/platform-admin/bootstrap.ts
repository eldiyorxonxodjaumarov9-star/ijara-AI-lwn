import bcrypt from "bcryptjs";

import { prisma } from "@/lib/api-server/prisma";

export const PLATFORM_ADMIN_BCRYPT_COST = 12;

let bootstrapDone: Promise<void> | null = null;

export function normalizePlatformAdminEmail(raw: unknown): string {
  return typeof raw === "string" ? raw.trim().toLowerCase() : "";
}

async function runBootstrap(): Promise<void> {
  const email = normalizePlatformAdminEmail(process.env.PLATFORM_ADMIN_EMAIL);
  const password = process.env.PLATFORM_ADMIN_PASSWORD ?? "";
  if (!email || password.length < 12) return;

  const existing = await prisma.platformAdmin.count();
  if (existing > 0) return;

  try {
    await prisma.platformAdmin.create({
      data: {
        email,
        name: process.env.PLATFORM_ADMIN_NAME?.trim() || "Platform Admin",
        passwordHash: await bcrypt.hash(password, PLATFORM_ADMIN_BCRYPT_COST),
      },
    });
    console.info("[platform-admin] initial admin provisioned");
  } catch (err) {
    if ((err as { code?: string })?.code !== "P2002") throw err;
  }
}

/**
 * Creates the first platform admin from env only when the table is empty.
 * Never overwrites an existing admin; runs at most once per server instance.
 */
export function ensurePlatformAdminBootstrap(): Promise<void> {
  if (!bootstrapDone) {
    bootstrapDone = runBootstrap().catch((err) => {
      bootstrapDone = null;
      console.error("[platform-admin] bootstrap failed", (err as Error)?.message ?? "unknown");
    });
  }
  return bootstrapDone;
}

export function __resetPlatformAdminBootstrapForTests() {
  bootstrapDone = null;
}
