import { prisma } from "@/lib/api-server/prisma";
import { normalizeEmployeePhone } from "@/lib/employee-units";

export async function linkEmployeeByTelegramContact(opts: {
  chatId: string;
  telegramUserId: number;
  contactPhone: string;
  contactUserId?: number | null;
}) {
  if (
    opts.contactUserId != null &&
    Number(opts.contactUserId) !== Number(opts.telegramUserId)
  ) {
    return {
      ok: false as const,
      message:
        "❌ Faqat o‘zingizning Telegram kontaktingizni yuboring (boshqa odam kontakti qabul qilinmaydi).",
    };
  }

  const phone = normalizeEmployeePhone(opts.contactPhone);
  if (!phone) {
    return {
      ok: false as const,
      message: "❌ Telefon raqami noto‘g‘ri. Qayta yuboring.",
    };
  }

  const matches = await prisma.employee.findMany({
    where: {
      active: true,
      phone: { in: [phone, `+${phone}`] },
    },
    include: { company: true },
  });

  // Also match by normalized digits comparison
  const allActive = matches.length
    ? matches
    : (
        await prisma.employee.findMany({
          where: { active: true, phone: { not: null } },
          include: { company: true },
        })
      ).filter((e) => normalizeEmployeePhone(e.phone) === phone);

  if (allActive.length === 0) {
    return {
      ok: false as const,
      message:
        "❌ Faol xodim topilmadi. Telefonni Xodimlar bo‘limida tekshiring yoki admin bilan bog‘laning.",
    };
  }
  if (allActive.length > 1) {
    return {
      ok: false as const,
      message:
        "❌ Bir nechta xodim topildi. Avtomatik bog‘lanmaydi — admin bilan bog‘laning.",
    };
  }

  const employee = allActive[0];

  const chatTaken = await prisma.employee.findFirst({
    where: {
      telegramChatId: opts.chatId,
      id: { not: employee.id },
    },
  });
  if (chatTaken) {
    return {
      ok: false as const,
      message: "❌ Bu Telegram akkaunt boshqa xodimga bog‘langan.",
    };
  }

  if (
    employee.telegramChatId &&
    employee.telegramChatId !== opts.chatId
  ) {
    return {
      ok: false as const,
      message:
        "❌ Bu xodim boshqa Telegram akkauntga bog‘langan. Avval admin yechib bersin.",
    };
  }

  const updated = await prisma.employee.update({
    where: { id: employee.id },
    data: {
      telegramChatId: opts.chatId,
      telegramUserId: String(opts.telegramUserId),
      telegramLinkedAt: new Date(),
      phone: phone,
    },
    include: { company: true },
  });

  return {
    ok: true as const,
    employee: updated,
    message:
      `✅ Bog‘landi: <b>${updated.fullName}</b>\n` +
      `🏢 ${updated.company?.name ?? "—"}\n` +
      `👔 ${updated.position ?? "—"}\n\n` +
      `Endi «📋 Vazifalarim» orqali vazifalarni ko‘rishingiz mumkin.`,
  };
}

export async function getEmployeeByChatId(chatId: string) {
  return prisma.employee.findFirst({
    where: { telegramChatId: chatId, active: true },
    include: { company: true },
  });
}
