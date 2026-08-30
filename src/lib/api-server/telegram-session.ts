import { prisma } from "@/lib/api-server/prisma";
import {
  WIZARD_TTL_MS,
  wizardNotExpired,
  type WizardState,
} from "@/lib/tasks/task-shared";

export type TelegramBotMode =
  | "menu"
  | "owner_login"
  | "owner_password"
  | "owner_verify_code"
  | "tenant"
  | "owner"
  | "employee"
  | "employee_link"
  | "employee_wizard"
  | "admin_task_wizard";

export async function getTelegramSession(chatId: string) {
  return prisma.telegramSession.findUnique({ where: { chatId } });
}

export function parseWizardJson(
  raw: string | null | undefined
): WizardState | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as WizardState;
    if (!wizardNotExpired(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function buildWizard(
  partial: Omit<WizardState, "expiresAt"> & { expiresAt?: string }
): WizardState {
  return {
    ...partial,
    expiresAt:
      partial.expiresAt ??
      new Date(Date.now() + WIZARD_TTL_MS).toISOString(),
  };
}

export async function upsertTelegramSession(
  chatId: string,
  data: {
    mode?: TelegramBotMode | string;
    pendingEmail?: string | null;
    ownerUserId?: string | null;
    pendingUserId?: string | null;
    pendingOtp?: string | null;
    otpExpiresAt?: Date | null;
    wizardJson?: string | null;
    employeeId?: string | null;
    expiresAt?: Date | null;
  }
) {
  return prisma.telegramSession.upsert({
    where: { chatId },
    create: {
      chatId,
      mode: data.mode ?? "menu",
      pendingEmail: data.pendingEmail ?? null,
      ownerUserId: data.ownerUserId ?? null,
      pendingUserId: data.pendingUserId ?? null,
      pendingOtp: data.pendingOtp ?? null,
      otpExpiresAt: data.otpExpiresAt ?? null,
      wizardJson: data.wizardJson ?? null,
      employeeId: data.employeeId ?? null,
      expiresAt: data.expiresAt ?? null,
    },
    update: {
      ...(data.mode !== undefined ? { mode: data.mode } : {}),
      ...(data.pendingEmail !== undefined
        ? { pendingEmail: data.pendingEmail }
        : {}),
      ...(data.ownerUserId !== undefined
        ? { ownerUserId: data.ownerUserId }
        : {}),
      ...(data.pendingUserId !== undefined
        ? { pendingUserId: data.pendingUserId }
        : {}),
      ...(data.pendingOtp !== undefined ? { pendingOtp: data.pendingOtp } : {}),
      ...(data.otpExpiresAt !== undefined
        ? { otpExpiresAt: data.otpExpiresAt }
        : {}),
      ...(data.wizardJson !== undefined ? { wizardJson: data.wizardJson } : {}),
      ...(data.employeeId !== undefined ? { employeeId: data.employeeId } : {}),
      ...(data.expiresAt !== undefined ? { expiresAt: data.expiresAt } : {}),
    },
  });
}

export async function resetTelegramSession(chatId: string) {
  await prisma.telegramSession.deleteMany({ where: { chatId } });
}

export async function setWizard(chatId: string, wizard: WizardState | null) {
  await upsertTelegramSession(chatId, {
    wizardJson: wizard ? JSON.stringify(wizard) : null,
    expiresAt: wizard ? new Date(wizard.expiresAt) : null,
  });
}
