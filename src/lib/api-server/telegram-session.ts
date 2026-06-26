import { prisma } from "@/lib/api-server/prisma";

export type TelegramBotMode =
  | "menu"
  | "owner_login"
  | "owner_password"
  | "owner_verify_code"
  | "tenant"
  | "owner";

export async function getTelegramSession(chatId: string) {
  return prisma.telegramSession.findUnique({ where: { chatId } });
}

export async function upsertTelegramSession(
  chatId: string,
  data: {
    mode?: TelegramBotMode;
    pendingEmail?: string | null;
    ownerUserId?: string | null;
  }
) {
  return prisma.telegramSession.upsert({
    where: { chatId },
    create: {
      chatId,
      mode: data.mode ?? "menu",
      pendingEmail: data.pendingEmail ?? null,
      ownerUserId: data.ownerUserId ?? null,
    },
    update: {
      ...(data.mode !== undefined ? { mode: data.mode } : {}),
      ...(data.pendingEmail !== undefined ? { pendingEmail: data.pendingEmail } : {}),
      ...(data.ownerUserId !== undefined ? { ownerUserId: data.ownerUserId } : {}),
    },
  });
}

export async function resetTelegramSession(chatId: string) {
  await prisma.telegramSession.deleteMany({ where: { chatId } });
}
