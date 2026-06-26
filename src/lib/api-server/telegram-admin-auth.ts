import type { User } from "@prisma/client";

import { prisma } from "@/lib/api-server/prisma";
import { sendTelegramMessage } from "@/lib/api-server/telegram-bot";
import {
  buildAdminSummaryMessage,
  getAdminDashboardRows,
  ADMIN_MENU_KEYBOARD,
} from "@/lib/api-server/telegram-admin";

const OTP_TTL_MS = 10 * 60 * 1000;

function generateOtp() {
  return String(Math.floor(100_000 + Math.random() * 900_000));
}

export async function migrateLegacyAdminDevice(user: User) {
  if (!user.telegramAdminChatId) return;
  const exists = await prisma.telegramAdminDevice.findUnique({
    where: { chatId: user.telegramAdminChatId },
  });
  if (exists) return;
  await prisma.telegramAdminDevice.create({
    data: {
      userId: user.id,
      chatId: user.telegramAdminChatId,
      isPrimary: true,
    },
  });
}

export async function getOwnerByAdminChatId(chatId: string) {
  const device = await prisma.telegramAdminDevice.findUnique({
    where: { chatId },
    include: { user: true },
  });
  if (device?.user?.isActive) return device.user;

  const legacy = await prisma.user.findFirst({
    where: { telegramAdminChatId: chatId, isActive: true },
  });
  if (legacy) {
    await migrateLegacyAdminDevice(legacy);
    return legacy;
  }
  return null;
}

export async function isAdminChatLinked(chatId: string) {
  const owner = await getOwnerByAdminChatId(chatId);
  return Boolean(owner);
}

export async function linkAdminDevice(userId: string, chatId: string) {
  const existing = await prisma.telegramAdminDevice.findUnique({
    where: { chatId },
  });
  if (existing && existing.userId !== userId) {
    await prisma.telegramAdminDevice.delete({ where: { chatId } });
  }

  const userDevices = await prisma.telegramAdminDevice.count({
    where: { userId },
  });
  const isPrimary = userDevices === 0;

  await prisma.telegramAdminDevice.upsert({
    where: { chatId },
    create: { userId, chatId, isPrimary },
    update: { userId },
  });

  if (isPrimary) {
    await prisma.user.update({
      where: { id: userId },
      data: { telegramAdminChatId: chatId },
    });
  }
}

export async function unlinkAdminDevice(chatId: string) {
  const device = await prisma.telegramAdminDevice.findUnique({
    where: { chatId },
  });
  if (!device) {
    await prisma.user.updateMany({
      where: { telegramAdminChatId: chatId },
      data: { telegramAdminChatId: null },
    });
    return;
  }

  await prisma.telegramAdminDevice.delete({ where: { chatId } });

  if (device.isPrimary) {
    const next = await prisma.telegramAdminDevice.findFirst({
      where: { userId: device.userId },
      orderBy: { createdAt: "asc" },
    });
    if (next) {
      await prisma.telegramAdminDevice.update({
        where: { id: next.id },
        data: { isPrimary: true },
      });
      await prisma.user.update({
        where: { id: device.userId },
        data: { telegramAdminChatId: next.chatId },
      });
    } else {
      await prisma.user.update({
        where: { id: device.userId },
        data: { telegramAdminChatId: null },
      });
    }
  }
}

export async function getPrimaryAdminChatId(userId: string) {
  const primary = await prisma.telegramAdminDevice.findFirst({
    where: { userId, isPrimary: true },
  });
  if (primary) return primary.chatId;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  return user?.telegramAdminChatId ?? null;
}

export async function userHasOtherAdminDevices(userId: string, chatId: string) {
  const count = await prisma.telegramAdminDevice.count({
    where: { userId, chatId: { not: chatId } },
  });
  if (count > 0) return true;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  return Boolean(
    user?.telegramAdminChatId &&
      user.telegramAdminChatId !== chatId &&
      !(await prisma.telegramAdminDevice.findUnique({
        where: { chatId: user.telegramAdminChatId },
      }))
  );
}

export async function startNewDeviceVerification(userId: string, chatId: string) {
  const code = generateOtp();
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);

  await prisma.telegramSession.upsert({
    where: { chatId },
    create: {
      chatId,
      mode: "owner_verify_code",
      pendingUserId: userId,
      pendingOtp: code,
      otpExpiresAt: expiresAt,
    },
    update: {
      mode: "owner_verify_code",
      pendingUserId: userId,
      pendingOtp: code,
      otpExpiresAt: expiresAt,
      pendingEmail: null,
    },
  });

  const primaryChatId = await getPrimaryAdminChatId(userId);
  if (primaryChatId && primaryChatId !== chatId) {
    await sendTelegramMessage(
      primaryChatId,
      "🔐 <b>Yangi qurilmadan kirish urinishi</b>\n\n" +
        `Tasdiqlash kodi: <code>${code}</code>\n\n` +
        "Kodni yangi qurilmadagi botga yuboring.\n" +
        "Kod 10 daqiqa amal qiladi."
    );
  }

  return code;
}

export async function verifyNewDeviceOtp(chatId: string, code: string) {
  const session = await prisma.telegramSession.findUnique({ where: { chatId } });
  if (!session || session.mode !== "owner_verify_code" || !session.pendingUserId) {
    return { ok: false as const, reason: "session" };
  }
  if (!session.pendingOtp || !session.otpExpiresAt) {
    return { ok: false as const, reason: "session" };
  }
  if (session.otpExpiresAt.getTime() < Date.now()) {
    return { ok: false as const, reason: "expired" };
  }
  if (session.pendingOtp.trim() !== code.trim()) {
    return { ok: false as const, reason: "invalid" };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.pendingUserId },
  });
  if (!user?.isActive) {
    return { ok: false as const, reason: "user" };
  }

  await linkAdminDevice(user.id, chatId);
  await prisma.telegramSession.update({
    where: { chatId },
    data: {
      mode: "owner",
      ownerUserId: user.id,
      pendingUserId: null,
      pendingOtp: null,
      otpExpiresAt: null,
    },
  });

  return { ok: true as const, user };
}

export async function openAdminPanel(chatId: string, user: User) {
  const rows = await getAdminDashboardRows();
  await sendTelegramMessage(
    chatId,
    `✅ <b>Xush kelibsiz, ${user.fullName}!</b>\n\n` +
      "Admin panel ochildi. Quyidagi menyu orqali ma'lumot oling.\n\n" +
      buildAdminSummaryMessage(rows),
    { reply_markup: ADMIN_MENU_KEYBOARD }
  );
}

export async function completeOwnerLogin(chatId: string, user: User) {
  const alreadyLinked = await prisma.telegramAdminDevice.findUnique({
    where: { chatId },
  });
  if (alreadyLinked?.userId === user.id) {
    await prisma.telegramSession.upsert({
      where: { chatId },
      create: { chatId, mode: "owner", ownerUserId: user.id },
      update: {
        mode: "owner",
        ownerUserId: user.id,
        pendingEmail: null,
        pendingUserId: null,
        pendingOtp: null,
        otpExpiresAt: null,
      },
    });
    await openAdminPanel(chatId, user);
    return;
  }

  const needsOtp = await userHasOtherAdminDevices(user.id, chatId);
  if (needsOtp) {
    await startNewDeviceVerification(user.id, chatId);
    await sendTelegramMessage(
      chatId,
      "🔐 <b>Yangi qurilma aniqlandi</b>\n\n" +
        "Xavfsizlik uchun tasdiqlash kodi asosiy qurilmangizdagi botga yuborildi.\n\n" +
        "6 xonali kodni shu yerga yozing."
    );
    return;
  }

  await linkAdminDevice(user.id, chatId);
  await prisma.telegramSession.upsert({
    where: { chatId },
    create: { chatId, mode: "owner", ownerUserId: user.id },
    update: {
      mode: "owner",
      ownerUserId: user.id,
      pendingEmail: null,
      pendingUserId: null,
      pendingOtp: null,
      otpExpiresAt: null,
    },
  });
  await openAdminPanel(chatId, user);
}
