import { prisma } from "@/lib/api-server/prisma";
import {
  attendanceGroupId,
  isAttendanceBotConfigured,
  isAttendanceGroupChat,
} from "@/lib/api-server/attendance-bot/config";
import { assertSingleFaceSelfiePresence } from "@/lib/api-server/attendance-bot/face-presence";
import {
  buildKeldiGroupMessage,
  displayNameForAttendanceLink,
  ensureAttendanceProfileFromTelegram,
  escapeHtml,
  findLinkByTelegramUserId,
  listOpenTasksForEmployee,
  markTaskBajardim,
  parseTaskDoneCallback,
  recordKeldiCheckIn,
  taskDoneCallbackData,
} from "@/lib/api-server/attendance-bot/service";
import {
  attendanceAnswerCallback,
  attendanceSendMessage,
  type AttendanceUpdate,
} from "@/lib/api-server/attendance-bot/telegram";

async function claimUpdate(updateId: number) {
  try {
    await prisma.attendanceBotProcessedUpdate.create({
      data: { updateId: BigInt(updateId) },
    });
    return true;
  } catch {
    return false;
  }
}

async function sendTasksKeyboard(
  chatId: number,
  tasks: Array<{ id: string; title: string }>
) {
  if (tasks.length === 0) {
    await attendanceSendMessage(chatId, "Hozircha vazifa yo‘q");
    return;
  }

  const lines = tasks.map(
    (t, i) => `${i + 1}. <b>${escapeHtml(t.title)}</b>`
  );
  await attendanceSendMessage(
    chatId,
    `📋 <b>Vazifalar</b>\n\n${lines.join("\n")}\n\n` +
      `Bajargach <b>✅ BAJARDIM</b> tugmasini bosing.`,
    {
      reply_markup: {
        inline_keyboard: tasks.map((t) => [
          {
            text: `✅ BAJARDIM — ${t.title.slice(0, 28)}`,
            callback_data: taskDoneCallbackData(t.id),
          },
        ]),
      },
    }
  );
}

export async function handleAttendanceUpdate(update: AttendanceUpdate) {
  if (!isAttendanceBotConfigured()) return;
  if (typeof update.update_id !== "number") return;
  const claimed = await claimUpdate(update.update_id);
  if (!claimed) return;

  if (update.callback_query) {
    const cq = update.callback_query;
    const chatId = cq.message?.chat.id;
    const userId = cq.from?.id;
    if (!chatId || !userId) return;

    const taskId = parseTaskDoneCallback(cq.data);
    await attendanceAnswerCallback(cq.id);
    if (!taskId) {
      await attendanceSendMessage(chatId, "Noma’lum tugma.");
      return;
    }

    if (!attendanceGroupId() || !isAttendanceGroupChat(chatId)) {
      await attendanceSendMessage(
        chatId,
        "Bu tugma faqat rasmiy davomat guruhida ishlaydi."
      );
      return;
    }

    const link = await findLinkByTelegramUserId(String(userId));
    if (!link) {
      await attendanceSendMessage(
        chatId,
        "Avval guruhga selfi yuborib davomat qiling."
      );
      return;
    }

    try {
      await markTaskBajardim({
        taskId,
        employeeId: link.employeeId,
      });
      await attendanceSendMessage(
        chatId,
        `✅ Vazifa saytda <b>COMPLETED</b> holatiga o‘tkazildi.`
      );
      const tasks = await listOpenTasksForEmployee(link.employeeId);
      if (tasks.length > 0) {
        await sendTasksKeyboard(
          chatId,
          tasks.map((t) => ({ id: t.id, title: t.title }))
        );
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Xatolik";
      await attendanceSendMessage(chatId, `⚠️ ${escapeHtml(message)}`);
    }
    return;
  }

  const msg = update.message;
  if (!msg?.chat?.id || !msg.from?.id) return;
  // Botning o‘z xabarlari (QR feedback foto/matn) davomat selfisi emas
  if (msg.from.is_bot) return;
  const chatId = msg.chat.id;
  const userId = String(msg.from.id);

  // QR tozalik xabarlari (caption/text) — selfi oqimiga tushmasin
  const echoText = `${msg.text || ""}\n${msg.caption || ""}`;
  if (
    echoText.includes("YANGI TOZALIK BAHOSI") ||
    echoText.includes("🧹")
  ) {
    return;
  }

  // Shaxsiy chat: registratsiya yo‘q — faqat guruhga yo‘naltirish
  if (msg.chat.type === "private") {
    if (msg.text?.trim() === "/start" || msg.text?.trim() === "/help") {
      await attendanceSendMessage(
        chatId,
        "👋 <b>Ijara AI — Davomat</b>\n\n" +
          "Telefon yoki /start registratsiyasi kerak emas.\n" +
          "Davomat uchun <b>rasmiy guruhga selfi</b> yuboring."
      );
    }
    return;
  }

  // Faqat belgilangan davomat guruhidan selfi
  if (!isAttendanceGroupChat(chatId)) {
    return;
  }

  const photos = msg.photo;
  if (!photos || photos.length === 0) {
    return;
  }

  const face = assertSingleFaceSelfiePresence(photos);
  if (!face.ok) {
    await attendanceSendMessage(
      chatId,
      face.reason === "TOO_SMALL"
        ? "Selfi juda kichik. Iltimos, aniqroq yuz rasmini yuboring."
        : "Davomat uchun yuz selfisi yuboring."
    );
    return;
  }

  const { link } = await ensureAttendanceProfileFromTelegram({
    telegramUserId: userId,
    telegramChatId: chatId,
    firstName: msg.from.first_name,
    lastName: msg.from.last_name,
    username: msg.from.username,
  });

  const { created } = await recordKeldiCheckIn({
    linkId: link.id,
    employeeId: link.employeeId,
    workspaceId: link.workspaceId,
    profileStatus: link.profileStatus,
    selfieFileId: face.best.file_id,
    selfieUniqueId: face.best.file_unique_id,
    telegramMessageId: String(msg.message_id),
  });

  const tasks = await listOpenTasksForEmployee(link.employeeId);
  const displayName = displayNameForAttendanceLink(link);

  await attendanceSendMessage(
    chatId,
    buildKeldiGroupMessage({
      displayName,
      unverified: link.profileStatus !== "VERIFIED",
      taskCount: tasks.length,
      duplicate: !created,
    })
  );

  await sendTasksKeyboard(
    chatId,
    tasks.map((t) => ({ id: t.id, title: t.title }))
  );
}
