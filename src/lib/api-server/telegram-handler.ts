import {
  buildAdminDebtorsMessage,
  buildAdminDueSoonMessage,
  buildAdminSummaryMessage,
  buildAdminTenantsMessage,
  getAdminDashboardRows,
  sendAdminMessage,
  verifyOwnerCredentials,
  ADMIN_MENU_KEYBOARD,
} from "@/lib/api-server/telegram-admin";
import {
  completeOwnerLogin,
  getOwnerByAdminChatId,
  openAdminPanel,
  verifyNewDeviceOtp,
} from "@/lib/api-server/telegram-admin-auth";
import {
  resetTelegramSession,
  upsertTelegramSession,
  getTelegramSession,
} from "@/lib/api-server/telegram-session";
import {
  answerCallbackQuery,
  sendContactRequest,
  sendOwnerLoginPrompt,
  sendRoleMenu,
  sendTelegramMessage,
  type TelegramUpdate,
} from "@/lib/api-server/telegram-bot";
import { processPhoneForBot } from "@/lib/api-server/telegram-reminders";
import {
  recordBotStart,
  updateBotUserRole,
  type TelegramUserFrom,
} from "@/lib/api-server/telegram-bot-users";
import { normalizePhone } from "@/lib/api-server/tenant-lookup";
import { prisma } from "@/lib/api-server/prisma";

async function unlinkTelegramChat(chatId: string) {
  await prisma.tenant.updateMany({
    where: { telegramChatId: chatId },
    data: { telegramChatId: null },
  });
}

function looksLikePhone(text: string) {
  return normalizePhone(text).length >= 9;
}

async function enterOwnerPanel(chatId: string) {
  const owner = await getOwnerByAdminChatId(chatId);
  if (!owner) return false;
  await upsertTelegramSession(chatId, {
    mode: "owner",
    ownerUserId: owner.id,
    pendingEmail: null,
  });
  await openAdminPanel(chatId, owner);
  return true;
}

async function handleStart(chatId: string, from?: TelegramUserFrom | null) {
  await recordBotStart(chatId, from);
  await unlinkTelegramChat(chatId);

  if (await enterOwnerPanel(chatId)) {
    return;
  }

  await resetTelegramSession(chatId);
  await upsertTelegramSession(chatId, { mode: "menu" });
  await sendRoleMenu(chatId);
}

async function handleOwnerLogin(chatId: string, text: string) {
  const session = await getTelegramSession(chatId);
  if (session?.mode === "owner_login") {
    const email = text.trim().toLowerCase();
    if (!email.includes("@")) {
      await sendTelegramMessage(
        chatId,
        "❌ Login (email) noto'g'ri.\n\nMisol: <code>admin@arendahub.uz</code>"
      );
      return;
    }
    await upsertTelegramSession(chatId, {
      mode: "owner_password",
      pendingEmail: email,
    });
    await sendTelegramMessage(
      chatId,
      "🔐 Endi parolingizni yuboring:",
      { reply_markup: { remove_keyboard: true } }
    );
    return;
  }

  if (session?.mode === "owner_password") {
    const email = session.pendingEmail;
    if (!email) {
      await upsertTelegramSession(chatId, { mode: "owner_login" });
      await sendOwnerLoginPrompt(chatId);
      return;
    }

    const user = await verifyOwnerCredentials(email, text);
    if (!user) {
      await upsertTelegramSession(chatId, {
        mode: "owner_login",
        pendingEmail: null,
      });
      await sendTelegramMessage(
        chatId,
        "❌ Login yoki parol noto'g'ri.\n\nQayta login yuboring:"
      );
      return;
    }

    await completeOwnerLogin(chatId, user);
  }
}

async function handleOwnerVerifyCode(chatId: string, text: string) {
  const code = text.replace(/\s/g, "");
  if (!/^\d{6}$/.test(code)) {
    await sendTelegramMessage(
      chatId,
      "❌ 6 xonali kod yuboring.\n\nMisol: <code>123456</code>"
    );
    return;
  }

  const result = await verifyNewDeviceOtp(chatId, code);
  if (!result.ok) {
    const messages: Record<string, string> = {
      expired: "⏰ Kod muddati tugagan. /start → Arenda egasi orqali qayta kiring.",
      invalid: "❌ Kod noto'g'ri. Qayta urinib ko'ring.",
      session: "Sessiya topilmadi. /start bosing.",
      user: "Foydalanuvchi topilmadi.",
    };
    await sendTelegramMessage(chatId, messages[result.reason] ?? "Xatolik yuz berdi.");
    return;
  }

  await openAdminPanel(chatId, result.user);
}

async function handleOwnerMenu(chatId: string, text: string) {
  const owner = await getOwnerByAdminChatId(chatId);
  if (!owner) {
    await upsertTelegramSession(chatId, { mode: "owner_login" });
    await sendOwnerLoginPrompt(chatId);
    return;
  }

  const rows = await getAdminDashboardRows();

  if (text === "📋 Arendatorlar") {
    await sendAdminMessage(chatId, buildAdminTenantsMessage(rows));
    return;
  }
  if (text === "⚠️ Qarzdorlar") {
    await sendAdminMessage(chatId, buildAdminDebtorsMessage(rows));
    return;
  }
  if (text === "📅 To'lov muddati yaqin kelganlar") {
    await sendAdminMessage(chatId, buildAdminDueSoonMessage(rows));
    return;
  }
  if (text === "📊 Umumiy hisobot") {
    await sendAdminMessage(chatId, buildAdminSummaryMessage(rows));
    return;
  }
  if (text === "🚪 Chiqish") {
    await resetTelegramSession(chatId);
    await sendTelegramMessage(
      chatId,
      "Admin panel yopildi.\n\n/start bosib qayta admin panelga kiring (parol kerak emas).",
      { reply_markup: { remove_keyboard: true } }
    );
    await upsertTelegramSession(chatId, { mode: "menu" });
    await sendRoleMenu(chatId);
    return;
  }

  await sendTelegramMessage(
    chatId,
    "Menyudan tanlang yoki /start bosing.",
    { reply_markup: ADMIN_MENU_KEYBOARD }
  );
}

export async function handleTelegramUpdate(update: TelegramUpdate) {
  if (update.callback_query) {
    const chatId = String(update.callback_query.message?.chat.id ?? "");
    const data = update.callback_query.data ?? "";
    if (update.callback_query.id) {
      await answerCallbackQuery(update.callback_query.id);
    }
    if (!chatId) return;

    if (data === "role_tenant") {
      await updateBotUserRole(
        chatId,
        "tenant",
        update.callback_query.from ?? undefined
      );
      await upsertTelegramSession(chatId, { mode: "tenant" });
      await sendContactRequest(chatId);
      return;
    }
    if (data === "role_owner") {
      await updateBotUserRole(
        chatId,
        "owner",
        update.callback_query.from ?? undefined
      );
      await unlinkTelegramChat(chatId);
      if (await enterOwnerPanel(chatId)) {
        return;
      }
      await upsertTelegramSession(chatId, {
        mode: "owner_login",
        pendingEmail: null,
        ownerUserId: null,
      });
      await sendOwnerLoginPrompt(chatId);
      return;
    }
    return;
  }

  const message = update.message;
  if (!message) return;

  const chatId = String(message.chat.id);
  const text = message.text?.trim() ?? "";
  const session = await getTelegramSession(chatId);

  if (text.startsWith("/start")) {
    await handleStart(chatId, message.from ?? undefined);
    return;
  }

  if (text.startsWith("/help") || text.startsWith("/yordam")) {
    await sendTelegramMessage(
      chatId,
      "<b>ArendaAi bot</b>\n\n" +
        "/start — menyu yoki saqlangan admin kirish\n\n" +
        "<b>Arendator:</b> telefon orqali tasdiqlash.\n" +
        "<b>Arenda egasi:</b> birinchi marta login+parol. Keyin /start bilan to'g'ridan admin panel.\n" +
        "Boshqa qurilmadan kirishda tasdiqlash kodi asosiy botga yuboriladi.\n\n" +
        "Qarzdorlik eslatmalari: 🌅 08:00 · ☀️ 13:00 · 🌙 20:00 (Toshkent)."
    );
    return;
  }

  if (session?.mode === "owner_verify_code") {
    if (!text.startsWith("/")) {
      await handleOwnerVerifyCode(chatId, text);
    }
    return;
  }

  if (
    session?.mode === "owner_login" ||
    session?.mode === "owner_password"
  ) {
    if (!text.startsWith("/")) {
      await handleOwnerLogin(chatId, text);
    }
    return;
  }

  if (session?.mode === "owner") {
    await handleOwnerMenu(chatId, text);
    return;
  }

  const linkedOwner = await getOwnerByAdminChatId(chatId);
  if (linkedOwner && text && !text.startsWith("/")) {
    await upsertTelegramSession(chatId, {
      mode: "owner",
      ownerUserId: linkedOwner.id,
    });
    await handleOwnerMenu(chatId, text);
    return;
  }

  if (message.contact?.phone_number) {
    await upsertTelegramSession(chatId, { mode: "tenant" });
    const result = await processPhoneForBot(chatId, message.contact.phone_number);
    await sendTelegramMessage(chatId, result.message, {
      reply_markup: { remove_keyboard: true },
    });
    return;
  }

  if (looksLikePhone(text)) {
    await upsertTelegramSession(chatId, { mode: "tenant" });
    const result = await processPhoneForBot(chatId, text);
    await sendTelegramMessage(chatId, result.message, {
      reply_markup: { remove_keyboard: true },
    });
    return;
  }

  if (session?.mode === "tenant" || !session) {
    if (text && !text.startsWith("/")) {
      await sendTelegramMessage(
        chatId,
        "Telefon raqamingizni yuboring.\n\n" +
          "Tugmani bosing yoki raqamni yozing: <code>+998901234567</code>\n\n" +
          "/start — menyu"
      );
    } else if (!session) {
      await sendRoleMenu(chatId);
    }
  }
}
