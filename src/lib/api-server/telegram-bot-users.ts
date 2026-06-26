import { prisma } from "@/lib/api-server/prisma";
import { normalizePhone } from "@/lib/api-server/tenant-lookup";

export type TelegramUserFrom = {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
};

function buildDisplayName(from?: TelegramUserFrom | null) {
  if (!from) return null;
  const name = [from.first_name, from.last_name].filter(Boolean).join(" ").trim();
  return name || null;
}

function sessionModeToRole(mode: string): string | null {
  if (mode === "tenant") return "tenant";
  if (
    mode === "owner" ||
    mode === "owner_login" ||
    mode === "owner_password" ||
    mode === "owner_verify_code"
  ) {
    return "owner";
  }
  return null;
}

function splitFullName(fullName: string) {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 0) return { firstName: null, lastName: null };
  if (parts.length === 1) return { firstName: parts[0], lastName: null };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

async function mergeLegacyBotUser(
  chatId: string,
  data: {
    firstName?: string | null;
    lastName?: string | null;
    phone?: string | null;
    selectedRole?: string | null;
    tenantId?: string | null;
    activityAt: Date;
    phoneVerified?: boolean;
    forcePhone?: boolean;
    forceTenant?: boolean;
  }
): Promise<boolean> {
  const existing = await prisma.telegramBotUser.findUnique({ where: { chatId } });

  if (!existing) {
    await prisma.telegramBotUser.create({
      data: {
        chatId,
        firstName: data.firstName ?? null,
        lastName: data.lastName ?? null,
        phone: data.phone ?? null,
        selectedRole: data.selectedRole ?? null,
        tenantId: data.tenantId ?? null,
        phoneVerifiedAt: data.phoneVerified ? data.activityAt : null,
        startCount: 1,
        firstStartAt: data.activityAt,
        lastStartAt: data.activityAt,
      },
    });
    return true;
  }

  const activityAt = data.activityAt;
  await prisma.telegramBotUser.update({
    where: { chatId },
    data: {
      firstName: existing.firstName ?? data.firstName ?? undefined,
      lastName: existing.lastName ?? data.lastName ?? undefined,
      phone: data.forcePhone ? (data.phone ?? existing.phone) : (existing.phone ?? data.phone ?? undefined),
      selectedRole: existing.selectedRole ?? data.selectedRole ?? undefined,
      tenantId: data.forceTenant
        ? (data.tenantId ?? existing.tenantId)
        : (existing.tenantId ?? data.tenantId ?? undefined),
      phoneVerifiedAt:
        existing.phoneVerifiedAt ??
        (data.phoneVerified || data.forceTenant ? activityAt : undefined),
      firstStartAt:
        existing.firstStartAt < activityAt ? existing.firstStartAt : activityAt,
      lastStartAt:
        existing.lastStartAt > activityAt ? existing.lastStartAt : activityAt,
    },
  });
  return false;
}

/** Avvalgi bot sessiyalari, arendatorlar va adminlardan ro'yxatni to'ldirish */
export async function syncLegacyBotUsers() {
  let created = 0;

  const sessions = await prisma.telegramSession.findMany();
  for (const session of sessions) {
    const isNew = await mergeLegacyBotUser(session.chatId, {
      selectedRole: sessionModeToRole(session.mode),
      activityAt: session.updatedAt,
    });
    if (isNew) created += 1;
  }

  const linkedTenants = await prisma.tenant.findMany({
    where: { telegramChatId: { not: null } },
  });
  for (const tenant of linkedTenants) {
    if (!tenant.telegramChatId) continue;
    const { firstName, lastName } = splitFullName(tenant.fullName);
    const isNew = await mergeLegacyBotUser(tenant.telegramChatId, {
      firstName,
      lastName,
      phone: tenant.phone,
      selectedRole: "tenant",
      tenantId: tenant.id,
      activityAt: tenant.updatedAt,
      phoneVerified: true,
      forcePhone: true,
      forceTenant: true,
    });
    if (isNew) created += 1;
  }

  const adminDevices = await prisma.telegramAdminDevice.findMany({
    include: { user: { select: { fullName: true, phone: true, updatedAt: true } } },
  });
  for (const device of adminDevices) {
    const { firstName, lastName } = splitFullName(device.user.fullName);
    const isNew = await mergeLegacyBotUser(device.chatId, {
      firstName,
      lastName,
      phone: device.user.phone,
      selectedRole: "owner",
      activityAt: device.createdAt,
    });
    if (isNew) created += 1;
  }

  const adminUsers = await prisma.user.findMany({
    where: { telegramAdminChatId: { not: null } },
    select: {
      telegramAdminChatId: true,
      fullName: true,
      phone: true,
      updatedAt: true,
    },
  });
  for (const user of adminUsers) {
    if (!user.telegramAdminChatId) continue;
    const { firstName, lastName } = splitFullName(user.fullName);
    const isNew = await mergeLegacyBotUser(user.telegramAdminChatId, {
      firstName,
      lastName,
      phone: user.phone,
      selectedRole: "owner",
      activityAt: user.updatedAt,
    });
    if (isNew) created += 1;
  }

  return { created };
}

export async function recordBotStart(
  chatId: string,
  from?: TelegramUserFrom | null
) {
  const now = new Date();
  const existing = await prisma.telegramBotUser.findUnique({
    where: { chatId },
  });

  const profile = {
    ...(from?.id !== undefined ? { telegramUserId: String(from.id) } : {}),
    ...(from?.first_name !== undefined ? { firstName: from.first_name } : {}),
    ...(from?.last_name !== undefined ? { lastName: from.last_name ?? null } : {}),
    ...(from?.username !== undefined ? { username: from.username ?? null } : {}),
  };

  if (existing) {
    return prisma.telegramBotUser.update({
      where: { chatId },
      data: {
        ...profile,
        startCount: { increment: 1 },
        lastStartAt: now,
      },
    });
  }

  return prisma.telegramBotUser.create({
    data: {
      chatId,
      ...profile,
      firstName: from?.first_name ?? buildDisplayName(from)?.split(" ")[0] ?? null,
      startCount: 1,
      firstStartAt: now,
      lastStartAt: now,
    },
  });
}

export async function updateBotUserRole(
  chatId: string,
  role: "tenant" | "owner",
  from?: TelegramUserFrom | null
) {
  await recordBotStart(chatId, from);
  await prisma.telegramBotUser.update({
    where: { chatId },
    data: { selectedRole: role },
  });
}

export async function updateBotUserPhone(
  chatId: string,
  phone: string,
  tenantId?: string | null
) {
  const normalized = normalizePhone(phone);
  const displayPhone = phone.trim().startsWith("+")
    ? phone.trim()
    : normalized.length >= 9
      ? `+${normalized}`
      : phone.trim();

  const verified = Boolean(tenantId);

  await prisma.telegramBotUser.upsert({
    where: { chatId },
    create: {
      chatId,
      phone: displayPhone,
      tenantId: tenantId ?? null,
      phoneVerifiedAt: verified ? new Date() : null,
      startCount: 1,
      firstStartAt: new Date(),
      lastStartAt: new Date(),
      selectedRole: "tenant",
    },
    update: {
      phone: displayPhone,
      ...(tenantId !== undefined
        ? {
            tenantId: tenantId ?? null,
            phoneVerifiedAt: verified ? new Date() : undefined,
          }
        : {}),
      selectedRole: "tenant",
    },
  });
}

export async function getBotUserStats() {
  const [total, withPhone, linkedTenant] = await Promise.all([
    prisma.telegramBotUser.count(),
    prisma.telegramBotUser.count({ where: { phone: { not: null } } }),
    prisma.telegramBotUser.count({ where: { tenantId: { not: null } } }),
  ]);
  return { total, withPhone, linkedTenant };
}

export async function listBotUsers(params: {
  skip: number;
  limit: number;
  search?: string;
  order: "asc" | "desc";
}) {
  const where = params.search
    ? {
        OR: [
          { firstName: { contains: params.search, mode: "insensitive" as const } },
          { lastName: { contains: params.search, mode: "insensitive" as const } },
          { username: { contains: params.search, mode: "insensitive" as const } },
          { phone: { contains: params.search, mode: "insensitive" as const } },
          { chatId: { contains: params.search } },
        ],
      }
    : {};

  const [rows, total] = await Promise.all([
    prisma.telegramBotUser.findMany({
      where,
      skip: params.skip,
      take: params.limit,
      orderBy: { lastStartAt: params.order },
      include: {
        tenant: { select: { id: true, fullName: true, phone: true } },
      },
    }),
    prisma.telegramBotUser.count({ where }),
  ]);

  return { rows, total };
}
