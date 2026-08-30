import type { WorkTaskStatus, WorkTaskUnit } from "@prisma/client";

import { prisma } from "@/lib/api-server/prisma";
import {
  buildTaskTelegramMessage,
  cancelTask,
  createTask,
  getTaskById,
  listTasks,
  markTaskNotCompleted,
  notifyEmployeeTaskAssigned,
  reviewTaskReport,
  startTask,
  submitTaskReport,
  taskActionKeyboard,
} from "@/lib/api-server/tasks/task-service";
import {
  getEmployeeByChatId,
  linkEmployeeByTelegramContact,
} from "@/lib/api-server/tasks/employee-telegram-link";
import {
  MAX_TASK_ATTACHMENTS,
  persistTelegramFile,
} from "@/lib/api-server/tasks/task-attachments";
import {
  buildWizard,
  parseWizardJson,
  setWizard,
  upsertTelegramSession,
} from "@/lib/api-server/telegram-session";
import {
  sendEmployeeContactRequest,
  sendTelegramMessage,
  type TelegramUpdate,
} from "@/lib/api-server/telegram-bot";
import { getOwnerByAdminChatId } from "@/lib/api-server/telegram-admin-auth";
import {
  formatTaskDueAt,
  isStaffRole,
  maskPhone,
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  TASK_UNIT_LABELS,
} from "@/lib/tasks/task-shared";
import { matchEmployeeUnit } from "@/lib/employee-units";

export const EMPLOYEE_MENU_KEYBOARD = {
  keyboard: [
    [{ text: "📋 Vazifalarim" }, { text: "🆕 Yangi vazifalar" }],
    [{ text: "⏳ Jarayondagi vazifalar" }, { text: "✅ Bajarilgan vazifalar" }],
    [{ text: "❌ Bajarilmagan vazifalar" }, { text: "🚪 Chiqish" }],
  ],
  resize_keyboard: true,
};

export const ADMIN_TASK_MENU_EXTRA = [
  [{ text: "➕ Vazifa berish" }],
  [{ text: "📋 Barcha vazifalar" }, { text: "📝 Hisobotlar" }],
];

export async function openEmployeePanel(chatId: string, employeeId: string) {
  await upsertTelegramSession(chatId, {
    mode: "employee",
    employeeId,
    wizardJson: null,
  });
  const emp = await prisma.employee.findUnique({ where: { id: employeeId } });
  await sendTelegramMessage(
    chatId,
    `👷 <b>Xodim paneli</b>\n\nSalom, ${emp?.fullName ?? ""}!\nMenyudan tanlang:`,
    { reply_markup: EMPLOYEE_MENU_KEYBOARD }
  );
}

async function sendTaskCards(
  chatId: string,
  employeeId: string,
  status?: WorkTaskStatus | WorkTaskStatus[]
) {
  const statuses = status
    ? Array.isArray(status)
      ? status
      : [status]
    : undefined;
  const tasks = await prisma.workTask.findMany({
    where: {
      assignedEmployeeId: employeeId,
      ...(statuses ? { status: { in: statuses } } : {}),
    },
    include: {
      assignedEmployee: { include: { company: true } },
      createdBy: { select: { id: true, fullName: true, email: true, role: true } },
      reports: { include: { attachments: true }, orderBy: { submittedAt: "desc" } },
      statusEvents: { take: 1 },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  if (tasks.length === 0) {
    await sendTelegramMessage(chatId, "Vazifalar topilmadi.", {
      reply_markup: EMPLOYEE_MENU_KEYBOARD,
    });
    return;
  }

  for (const task of tasks) {
    await sendTelegramMessage(chatId, buildTaskTelegramMessage(task as never), {
      reply_markup: taskActionKeyboard(task.status, task.id),
    });
  }
}

export async function handleEmployeeMenu(chatId: string, text: string) {
  const employee = await getEmployeeByChatId(chatId);
  if (!employee) {
    await upsertTelegramSession(chatId, { mode: "employee_link" });
    await sendEmployeeContactRequest(chatId);
    return;
  }

  if (text === "🚪 Chiqish") {
    await upsertTelegramSession(chatId, {
      mode: "menu",
      employeeId: null,
      wizardJson: null,
    });
    await sendTelegramMessage(chatId, "Xodim paneli yopildi. /start", {
      reply_markup: { remove_keyboard: true },
    });
    return;
  }

  if (text === "📋 Vazifalarim") {
    await sendTaskCards(chatId, employee.id);
    return;
  }
  if (text === "🆕 Yangi vazifalar") {
    await sendTaskCards(chatId, employee.id, "NEW");
    return;
  }
  if (text === "⏳ Jarayondagi vazifalar") {
    await sendTaskCards(chatId, employee.id, ["IN_PROGRESS", "SUBMITTED"]);
    return;
  }
  if (text === "✅ Bajarilgan vazifalar") {
    await sendTaskCards(chatId, employee.id, "COMPLETED");
    return;
  }
  if (text === "❌ Bajarilmagan vazifalar") {
    await sendTaskCards(chatId, employee.id, "NOT_COMPLETED");
    return;
  }

  await sendTelegramMessage(chatId, "Menyudan tanlang.", {
    reply_markup: EMPLOYEE_MENU_KEYBOARD,
  });
}

export async function handleEmployeeContactLink(
  chatId: string,
  message: NonNullable<TelegramUpdate["message"]>
) {
  const fromId = message.from?.id;
  if (!fromId) {
    await sendTelegramMessage(chatId, "❌ Foydalanuvchi aniqlanmadi.");
    return;
  }
  const contact = message.contact;
  if (!contact?.phone_number) {
    await sendTelegramMessage(
      chatId,
      "❌ Iltimos, tugma orqali kontakt yuboring."
    );
    return;
  }

  const result = await linkEmployeeByTelegramContact({
    chatId,
    telegramUserId: fromId,
    contactPhone: contact.phone_number,
    contactUserId: contact.user_id,
  });

  await sendTelegramMessage(chatId, result.message, {
    reply_markup: result.ok
      ? EMPLOYEE_MENU_KEYBOARD
      : {
          keyboard: [
            [{ text: "📱 Telefon raqamni yuborish", request_contact: true }],
          ],
          resize_keyboard: true,
          one_time_keyboard: true,
        },
  });

  if (result.ok) {
    await openEmployeePanel(chatId, result.employee.id);
  }
}

export async function handleTaskCallback(
  chatId: string,
  data: string,
  fromId?: number
) {
  const employee = await getEmployeeByChatId(chatId);
  if (!employee) {
    await sendEmployeeContactRequest(chatId);
    return;
  }

  const [, action, taskId] = data.split(":");
  if (!action || !taskId) return;

  if (action === "start") {
    try {
      await startTask({
        taskId,
        employeeId: employee.id,
        source: "TELEGRAM",
      });
      const task = await getTaskById(taskId);
      if (task) {
        await sendTelegramMessage(
          chatId,
          `▶️ Boshlandi.\n\n${buildTaskTelegramMessage(task)}`,
          { reply_markup: taskActionKeyboard("IN_PROGRESS", taskId) }
        );
      }
    } catch (err) {
      await sendTelegramMessage(
        chatId,
        err instanceof Error ? err.message : "Xatolik"
      );
    }
    return;
  }

  if (action === "done") {
    await setWizard(
      chatId,
      buildWizard({
        kind: "task_report",
        taskId,
        step: "collect",
        reportText: "",
        pendingAttachments: [],
      })
    );
    await upsertTelegramSession(chatId, { mode: "employee_wizard" });
    await sendTelegramMessage(
      chatId,
      "📝 Bajarilgan ish haqida hisobot yozing yoki fayl yuboring.\n\n" +
        "Keyin «Hisobotni yuborish» tugmasini bosing.",
      {
        reply_markup: {
          keyboard: [
            [{ text: "Hisobotni yuborish" }, { text: "Bekor qilish" }],
          ],
          resize_keyboard: true,
        },
      }
    );
    return;
  }

  if (action === "fail") {
    await setWizard(
      chatId,
      buildWizard({
        kind: "task_fail",
        taskId,
        step: "collect",
        failureReason: "",
        pendingAttachments: [],
      })
    );
    await upsertTelegramSession(chatId, { mode: "employee_wizard" });
    await sendTelegramMessage(
      chatId,
      "❌ Nima uchun bajarilmadi? Sabab yozing (majburiy).\n" +
        "Ixtiyoriy rasm/fayl ham yuborishingiz mumkin.\n\n" +
        "Keyin «Tasdiqlash» ni bosing.",
      {
        reply_markup: {
          keyboard: [[{ text: "Tasdiqlash" }, { text: "Bekor qilish" }]],
          resize_keyboard: true,
        },
      }
    );
    return;
  }

  void fromId;
}

async function appendMessageMedia(
  wizardAttachments: NonNullable<
    ReturnType<typeof buildWizard>["pendingAttachments"]
  >,
  message: NonNullable<TelegramUpdate["message"]>
) {
  const list = [...(wizardAttachments ?? [])];
  if (list.length >= MAX_TASK_ATTACHMENTS) {
    throw new Error("Fayllar limiti");
  }

  if (message.photo?.length) {
    const best = message.photo[message.photo.length - 1];
    const saved = await persistTelegramFile({
      fileId: best.file_id,
      fileUniqueId: best.file_unique_id,
      fileName: "photo.jpg",
      mimeType: "image/jpeg",
    });
    list.push(saved);
  } else if (message.video) {
    const saved = await persistTelegramFile({
      fileId: message.video.file_id,
      fileUniqueId: message.video.file_unique_id,
      fileName: message.video.file_name ?? "video.mp4",
      mimeType: message.video.mime_type ?? "video/mp4",
    });
    list.push(saved);
  } else if (message.document) {
    const saved = await persistTelegramFile({
      fileId: message.document.file_id,
      fileUniqueId: message.document.file_unique_id,
      fileName: message.document.file_name ?? "document",
      mimeType: message.document.mime_type ?? "application/octet-stream",
    });
    list.push(saved);
  }
  return list;
}

export async function handleEmployeeWizardMessage(
  chatId: string,
  message: NonNullable<TelegramUpdate["message"]>
) {
  const session = await prisma.telegramSession.findUnique({
    where: { chatId },
  });
  const wizard = parseWizardJson(session?.wizardJson);
  const employee = await getEmployeeByChatId(chatId);
  if (!wizard || !employee) {
    await openEmployeePanel(chatId, employee?.id ?? "");
    return;
  }

  const text = message.text?.trim() ?? "";

  if (text === "Bekor qilish") {
    await setWizard(chatId, null);
    await openEmployeePanel(chatId, employee.id);
    return;
  }

  if (wizard.kind === "task_report") {
    if (text === "Hisobotni yuborish") {
      try {
        await submitTaskReport({
          taskId: wizard.taskId!,
          employeeId: employee.id,
          source: "TELEGRAM",
          reportText: wizard.reportText,
          attachments: wizard.pendingAttachments ?? [],
        });
        await setWizard(chatId, null);
        await sendTelegramMessage(
          chatId,
          "✅ Hisobot yuborildi. Admin tasdiqlashini kuting.",
          { reply_markup: EMPLOYEE_MENU_KEYBOARD }
        );
        await upsertTelegramSession(chatId, { mode: "employee" });
      } catch (err) {
        await sendTelegramMessage(
          chatId,
          err instanceof Error ? err.message : "Xatolik"
        );
      }
      return;
    }

    try {
      if (message.photo || message.video || message.document) {
        const attachments = await appendMessageMedia(
          wizard.pendingAttachments ?? [],
          message
        );
        const caption = message.caption?.trim();
        await setWizard(
          chatId,
          buildWizard({
            ...wizard,
            reportText: caption || wizard.reportText,
            pendingAttachments: attachments,
          })
        );
        await sendTelegramMessage(
          chatId,
          `📎 Fayl qo‘shildi (${attachments.length}/${MAX_TASK_ATTACHMENTS}).`
        );
        return;
      }
      if (text) {
        await setWizard(
          chatId,
          buildWizard({
            ...wizard,
            reportText: [wizard.reportText, text].filter(Boolean).join("\n"),
          })
        );
        await sendTelegramMessage(
          chatId,
          "✍️ Matn saqlandi. Yana yozing yoki «Hisobotni yuborish»."
        );
      }
    } catch (err) {
      await sendTelegramMessage(
        chatId,
        err instanceof Error ? err.message : "Fayl xatosi"
      );
    }
    return;
  }

  if (wizard.kind === "task_fail") {
    if (text === "Tasdiqlash") {
      try {
        await markTaskNotCompleted({
          taskId: wizard.taskId!,
          employeeId: employee.id,
          source: "TELEGRAM",
          reason: wizard.failureReason || "",
          attachments: wizard.pendingAttachments ?? [],
        });
        await setWizard(chatId, null);
        await upsertTelegramSession(chatId, { mode: "employee" });
        await sendTelegramMessage(chatId, "❌ Holat: Bajarilmadi saqlandi.", {
          reply_markup: EMPLOYEE_MENU_KEYBOARD,
        });
      } catch (err) {
        await sendTelegramMessage(
          chatId,
          err instanceof Error ? err.message : "Xatolik"
        );
      }
      return;
    }

    try {
      if (message.photo || message.video || message.document) {
        const attachments = await appendMessageMedia(
          wizard.pendingAttachments ?? [],
          message
        );
        await setWizard(
          chatId,
          buildWizard({ ...wizard, pendingAttachments: attachments })
        );
        await sendTelegramMessage(chatId, "📎 Fayl qo‘shildi.");
        return;
      }
      if (text) {
        await setWizard(
          chatId,
          buildWizard({
            ...wizard,
            failureReason: [wizard.failureReason, text]
              .filter(Boolean)
              .join("\n"),
          })
        );
        await sendTelegramMessage(
          chatId,
          "✍️ Sabab saqlandi. «Tasdiqlash» ni bosing."
        );
      }
    } catch (err) {
      await sendTelegramMessage(
        chatId,
        err instanceof Error ? err.message : "Xatolik"
      );
    }
  }
}

/** Admin/menejer bot orqali vazifa yaratish wizard */
export async function startAdminCreateTaskWizard(chatId: string) {
  const owner = await getOwnerByAdminChatId(chatId);
  if (!owner || !isStaffRole(owner.role)) {
    await sendTelegramMessage(chatId, "❌ Ruxsat yo‘q.");
    return;
  }
  await setWizard(
    chatId,
    buildWizard({
      kind: "admin_create_task",
      step: "unit",
      draft: {},
    })
  );
  await upsertTelegramSession(chatId, {
    mode: "admin_task_wizard",
    ownerUserId: owner.id,
  });
  await sendTelegramMessage(chatId, "Kompaniyani tanlang:", {
    reply_markup: {
      inline_keyboard: [
        [
          { text: "Sunnur", callback_data: "atask:unit:SUNNUR" },
          { text: "LWN", callback_data: "atask:unit:LWN" },
        ],
        [{ text: "Bekor", callback_data: "atask:cancel" }],
      ],
    },
  });
}

export async function handleAdminTaskCallback(chatId: string, data: string) {
  const owner = await getOwnerByAdminChatId(chatId);
  if (!owner || !isStaffRole(owner.role)) {
    await sendTelegramMessage(chatId, "❌ Ruxsat yo‘q.");
    return;
  }

  if (data === "atask:cancel") {
    await setWizard(chatId, null);
    await upsertTelegramSession(chatId, { mode: "owner" });
    await sendTelegramMessage(chatId, "Bekor qilindi.");
    return;
  }

  const session = await prisma.telegramSession.findUnique({
    where: { chatId },
  });
  const wizard = parseWizardJson(session?.wizardJson);
  if (!wizard || wizard.kind !== "admin_create_task") {
    await startAdminCreateTaskWizard(chatId);
    return;
  }

  if (data.startsWith("atask:unit:")) {
    const unit = data.split(":")[2] as WorkTaskUnit;
    await setWizard(
      chatId,
      buildWizard({
        ...wizard,
        step: "employee",
        draft: { ...wizard.draft, unit },
      })
    );
    const employees = await prisma.employee.findMany({
      where: { active: true },
      include: { company: true },
      orderBy: { fullName: "asc" },
      take: 40,
    });
    const filtered = employees.filter((e) => {
      const u = matchEmployeeUnit(e.company?.name);
      return unit === "SUNNUR" ? u === "Sunnur" : u === "LWN";
    });
    if (filtered.length === 0) {
      await sendTelegramMessage(chatId, "Faol xodim yo‘q.");
      return;
    }
    const rows = filtered.slice(0, 20).map((e) => [
      {
        text: `${e.fullName} · ${e.position ?? "—"} · ${maskPhone(e.phone)}`,
        callback_data: `atask:emp:${e.id}`,
      },
    ]);
    await sendTelegramMessage(chatId, "Xodimni tanlang:", {
      reply_markup: { inline_keyboard: [...rows, [{ text: "Bekor", callback_data: "atask:cancel" }]] },
    });
    return;
  }

  if (data.startsWith("atask:emp:")) {
    const employeeId = data.split(":")[2];
    await setWizard(
      chatId,
      buildWizard({
        ...wizard,
        step: "title",
        draft: { ...wizard.draft, employeeId },
      })
    );
    await sendTelegramMessage(chatId, "Vazifa sarlavhasini yozing:");
    return;
  }

  if (data.startsWith("atask:prio:")) {
    const priority = data.split(":")[2] as
      | "LOW"
      | "NORMAL"
      | "HIGH"
      | "URGENT";
    await setWizard(
      chatId,
      buildWizard({
        ...wizard,
        step: "due",
        draft: { ...wizard.draft, priority },
      })
    );
    await sendTelegramMessage(
      chatId,
      "Muddatni yozing (YYYY-MM-DD yoki YYYY-MM-DD HH:mm) yoki «O‘tkazib yuborish»:"
    );
    return;
  }

  if (data === "atask:confirm") {
    const d = wizard.draft ?? {};
    if (!d.unit || !d.employeeId || !d.title) {
      await sendTelegramMessage(chatId, "Ma’lumot to‘liq emas.");
      return;
    }
    try {
      const result = await createTask({
        title: d.title,
        description: d.description,
        unit: d.unit,
        assignedEmployeeId: d.employeeId,
        createdByUserId: owner.id,
        source: "TELEGRAM",
        priority: d.priority ?? "NORMAL",
        dueAt: d.dueAt ? new Date(d.dueAt) : null,
        notifyTelegram: true,
      });
      await setWizard(chatId, null);
      await upsertTelegramSession(chatId, { mode: "owner" });
      await sendTelegramMessage(
        chatId,
        `✅ Vazifa yaratildi.\nTelegram: ${result.telegramDelivery}` +
          (result.telegramError ? `\n⚠️ ${result.telegramError}` : "")
      );
    } catch (err) {
      await sendTelegramMessage(
        chatId,
        err instanceof Error ? err.message : "Xatolik"
      );
    }
    return;
  }
}

export async function handleAdminTaskWizardText(chatId: string, text: string) {
  const owner = await getOwnerByAdminChatId(chatId);
  if (!owner || !isStaffRole(owner.role)) return false;

  const session = await prisma.telegramSession.findUnique({
    where: { chatId },
  });
  if (session?.mode !== "admin_task_wizard") return false;
  const wizard = parseWizardJson(session.wizardJson);
  if (!wizard || wizard.kind !== "admin_create_task") return false;

  if (text === "Bekor qilish") {
    await setWizard(chatId, null);
    await upsertTelegramSession(chatId, { mode: "owner" });
    await sendTelegramMessage(chatId, "Bekor qilindi.");
    return true;
  }

  if (wizard.step === "title") {
    await setWizard(
      chatId,
      buildWizard({
        ...wizard,
        step: "description",
        draft: { ...wizard.draft, title: text },
      })
    );
    await sendTelegramMessage(chatId, "Tavsif yozing (yoki «O‘tkazib yuborish»):");
    return true;
  }

  if (wizard.step === "description") {
    const description = text === "O‘tkazib yuborish" ? "" : text;
    await setWizard(
      chatId,
      buildWizard({
        ...wizard,
        step: "priority",
        draft: { ...wizard.draft, description },
      })
    );
    await sendTelegramMessage(chatId, "Ustuvorlik:", {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "Past", callback_data: "atask:prio:LOW" },
            { text: "Oddiy", callback_data: "atask:prio:NORMAL" },
          ],
          [
            { text: "Yuqori", callback_data: "atask:prio:HIGH" },
            { text: "Shoshilinch", callback_data: "atask:prio:URGENT" },
          ],
        ],
      },
    });
    return true;
  }

  if (wizard.step === "due") {
    let dueAt: string | undefined;
    if (text !== "O‘tkazib yuborish") {
      const d = new Date(text.replace(" ", "T") + (text.includes(":") ? "" : "T18:00:00"));
      if (Number.isNaN(d.getTime())) {
        await sendTelegramMessage(chatId, "Sana noto‘g‘ri. Qayta yozing.");
        return true;
      }
      dueAt = d.toISOString();
    }
    const draft = { ...wizard.draft, dueAt };
    await setWizard(
      chatId,
      buildWizard({ ...wizard, step: "confirm", draft })
    );
    const emp = draft.employeeId
      ? await prisma.employee.findUnique({
          where: { id: draft.employeeId },
          include: { company: true },
        })
      : null;
    await sendTelegramMessage(
      chatId,
      `📝 <b>Preview</b>\n\n` +
        `Sarlavha: ${draft.title}\n` +
        `Tavsif: ${draft.description || "—"}\n` +
        `Kompaniya: ${draft.unit ? TASK_UNIT_LABELS[draft.unit] : "—"}\n` +
        `Xodim: ${emp?.fullName ?? "—"} · ${emp?.position ?? "—"} · ${maskPhone(emp?.phone)}\n` +
        `Ustuvorlik: ${draft.priority ? TASK_PRIORITY_LABELS[draft.priority] : "—"}\n` +
        `Muddat: ${formatTaskDueAt(draft.dueAt)}\n\n` +
        `Tasdiqlaysizmi?`,
      {
        reply_markup: {
          inline_keyboard: [
            [
              { text: "✅ Tasdiqlash", callback_data: "atask:confirm" },
              { text: "Bekor", callback_data: "atask:cancel" },
            ],
          ],
        },
      }
    );
    return true;
  }

  return true;
}

export async function handleAdminTaskMenuText(chatId: string, text: string) {
  if (text === "➕ Vazifa berish") {
    await startAdminCreateTaskWizard(chatId);
    return true;
  }
  if (text === "📋 Barcha vazifalar") {
    const { data } = await listTasks({ page: 1, limit: 10, skip: 0 });
    if (!data.length) {
      await sendTelegramMessage(chatId, "Vazifalar yo‘q.");
      return true;
    }
    const lines = data
      .map(
        (t) =>
          `• ${t?.title} — ${t?.statusLabel} — ${t?.employeeName}`
      )
      .join("\n");
    await sendTelegramMessage(chatId, `<b>So‘nggi vazifalar</b>\n\n${lines}`);
    return true;
  }
  if (text === "📝 Hisobotlar") {
    const { data } = await listTasks({
      page: 1,
      limit: 10,
      skip: 0,
      status: "SUBMITTED",
    });
    if (!data.length) {
      await sendTelegramMessage(chatId, "Kutilayotgan hisobot yo‘q.");
      return true;
    }
    for (const t of data) {
      if (!t) continue;
      await sendTelegramMessage(
        chatId,
        `📝 <b>${t.title}</b>\n${t.employeeName}\nHolat: ${TASK_STATUS_LABELS.SUBMITTED}`,
        {
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "✅ Tasdiqlash",
                  callback_data: `areview:ok:${t.id}`,
                },
                {
                  text: "↩️ Qaytarish",
                  callback_data: `areview:back:${t.id}`,
                },
              ],
            ],
          },
        }
      );
    }
    return true;
  }
  return false;
}

export async function handleAdminReviewCallback(chatId: string, data: string) {
  const owner = await getOwnerByAdminChatId(chatId);
  if (!owner || !isStaffRole(owner.role)) return;
  const [, action, taskId] = data.split(":");
  if (!taskId) return;
  if (action === "ok") {
    try {
      await reviewTaskReport({
        taskId,
        reviewerUserId: owner.id,
        approve: true,
        source: "TELEGRAM",
      });
      await sendTelegramMessage(chatId, "✅ Tasdiqlandi.");
    } catch (err) {
      await sendTelegramMessage(
        chatId,
        err instanceof Error ? err.message : "Xatolik"
      );
    }
    return;
  }
  if (action === "back") {
    await setWizard(
      chatId,
      buildWizard({
        kind: "admin_create_task",
        step: "return_comment",
        taskId,
        draft: {},
      })
    );
    // reuse wizardJson with taskId for return comment - hack via taskId field
    await upsertTelegramSession(chatId, {
      mode: "admin_task_wizard",
      wizardJson: JSON.stringify(
        buildWizard({
          kind: "task_fail",
          taskId,
          step: "admin_return",
          failureReason: "",
        })
      ),
    });
    await sendTelegramMessage(chatId, "Qaytarish izohini yozing:");
  }
}

export async function tryClaimTelegramUpdate(updateId: number | undefined) {
  if (updateId == null) return true;
  try {
    await prisma.$transaction(async (tx) => {
      await tx.telegramProcessedUpdate.create({
        data: { updateId: BigInt(updateId) },
      });
    });
    return true;
  } catch {
    return false;
  }
}

export {
  getEmployeeByChatId,
  linkEmployeeByTelegramContact,
} from "@/lib/api-server/tasks/employee-telegram-link";

export { notifyEmployeeTaskAssigned, cancelTask, reviewTaskReport };
