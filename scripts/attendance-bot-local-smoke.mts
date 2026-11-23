/**
 * Local DB smoke: group selfie → auto profile → KELDI → BAJARDIM → COMPLETED.
 * Mocks Telegram HTTP; no production DB.
 */
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local"), override: true });

const sent: string[] = [];
const originalFetch = globalThis.fetch;
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input);
  if (url.includes("api.telegram.org")) {
    if (url.includes("sendMessage")) {
      try {
        const body = init?.body ? JSON.parse(String(init.body)) : {};
        if (body.text) sent.push(String(body.text));
      } catch {
        /* ignore */
      }
      return new Response(JSON.stringify({ ok: true, result: { message_id: 1 } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (url.includes("answerCallbackQuery")) {
      return new Response(JSON.stringify({ ok: true, result: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
  }
  return originalFetch(input, init);
}) as typeof fetch;

const { PrismaClient } = await import("@prisma/client");
const { handleAttendanceUpdate } = await import(
  "../src/lib/api-server/attendance-bot/handler"
);
const { taskDoneCallbackData } = await import(
  "../src/lib/api-server/attendance-bot/service"
);

const prisma = new PrismaClient();
const FAKE_USER_ID = 91001001;
const FAKE_GROUP_ID = -1003911506368;

async function main() {
  if (process.env.DATABASE_URL?.includes("neon.tech")) {
    throw new Error("Refuse Neon");
  }
  if (process.env.IJARA_ATTENDANCE_ENABLED !== "true") {
    throw new Error("IJARA_ATTENDANCE_ENABLED must be true");
  }
  process.env.IJARA_ATTENDANCE_GROUP_ID = String(FAKE_GROUP_ID);

  const ws =
    (await prisma.workspace.findFirst({ where: { isInternal: true } })) ??
    (await prisma.workspace.create({
      data: {
        name: "Ijara AI (Internal)",
        slug: "ijara-internal-smoke",
        isInternal: true,
      },
    }));
  process.env.IJARA_ATTENDANCE_WORKSPACE_ID = ws.id;

  const oldLink = await prisma.attendanceBotLink.findUnique({
    where: { telegramUserId: String(FAKE_USER_ID) },
  });
  if (oldLink) {
    await prisma.attendanceCheckIn.deleteMany({ where: { linkId: oldLink.id } });
    const empId = oldLink.employeeId;
    await prisma.attendanceBotLink.delete({ where: { id: oldLink.id } });
    const emp = await prisma.employee.findUnique({ where: { id: empId } });
    if (emp?.notes?.startsWith("ATTENDANCE_AUTO:UNVERIFIED")) {
      await prisma.workTask.deleteMany({ where: { assignedEmployeeId: empId } });
      await prisma.employee.delete({ where: { id: empId } }).catch(() => null);
    }
  }
  await prisma.attendanceBotProcessedUpdate.deleteMany({});
  sent.length = 0;

  let admin = await prisma.user.findFirst({
    where: { role: "SUPER_ADMIN", isActive: true },
  });
  if (!admin) {
    admin = await prisma.user.create({
      data: {
        email: "local-attendance-admin@ijaraai.dev",
        password: "x",
        fullName: "Local Admin",
        role: "SUPER_ADMIN",
        isInternalAccount: true,
      },
    });
  }

  // Private /start must NOT require contact
  await handleAttendanceUpdate({
    update_id: 2001,
    message: {
      message_id: 1,
      chat: { id: FAKE_USER_ID, type: "private" },
      from: { id: FAKE_USER_ID, first_name: "Tester" },
      text: "/start",
    },
  });
  if (sent.some((s) => /request_contact|Telefon raqam/i.test(s))) {
    throw new Error("/start still asks for phone");
  }
  if (!sent.some((s) => /selfi/i.test(s))) {
    throw new Error("/start should point to group selfie");
  }

  // Photo outside group must be ignored
  sent.length = 0;
  await handleAttendanceUpdate({
    update_id: 2002,
    message: {
      message_id: 2,
      chat: { id: 999001, type: "group" },
      from: { id: FAKE_USER_ID, first_name: "Tester" },
      photo: [{ file_id: "outside", width: 800, height: 800 }],
    },
  });
  if (await prisma.attendanceBotLink.findUnique({ where: { telegramUserId: String(FAKE_USER_ID) } })) {
    throw new Error("outside-group photo registered a profile");
  }

  // Group selfie → auto profile + KELDI
  sent.length = 0;
  await handleAttendanceUpdate({
    update_id: 2003,
    message: {
      message_id: 3,
      chat: { id: FAKE_GROUP_ID, type: "supergroup" },
      from: { id: FAKE_USER_ID, first_name: "Mohira", last_name: "opa", username: "mohira_t" },
      photo: [
        { file_id: "smoke-small", width: 90, height: 90 },
        {
          file_id: "smoke-large",
          file_unique_id: "uniq-smoke",
          width: 800,
          height: 800,
        },
      ],
    },
  });

  const link = await prisma.attendanceBotLink.findUnique({
    where: { telegramUserId: String(FAKE_USER_ID) },
    include: { employee: true },
  });
  if (!link) throw new Error("auto profile not created");
  if (link.profileStatus !== "UNVERIFIED") throw new Error("expected UNVERIFIED profile");
  if (!sent.some((s) => /ISHGA KELDINGIZ/i.test(s))) {
    throw new Error("KELDI group reply missing");
  }
  if (!sent.some((s) => /tasdiqlanmagan/i.test(s))) {
    throw new Error("UNVERIFIED badge missing in reply");
  }

  const checkIns = await prisma.attendanceCheckIn.findMany({
    where: { employeeId: link.employeeId },
  });
  if (checkIns.length !== 1 || checkIns[0].status !== "KELDI") {
    throw new Error("KELDI check-in failed");
  }
  if (checkIns[0].verificationStatus !== "UNVERIFIED") {
    throw new Error("check-in should be UNVERIFIED");
  }

  // Duplicate selfie
  sent.length = 0;
  await handleAttendanceUpdate({
    update_id: 2004,
    message: {
      message_id: 4,
      chat: { id: FAKE_GROUP_ID, type: "supergroup" },
      from: { id: FAKE_USER_ID, first_name: "Mohira" },
      photo: [{ file_id: "smoke-2", width: 800, height: 800 }],
    },
  });
  if (
    (await prisma.attendanceCheckIn.count({ where: { employeeId: link.employeeId } })) !==
    1
  ) {
    throw new Error("duplicate check-in created");
  }

  // Assign task to auto employee, then BAJARDIM → COMPLETED
  const task = await prisma.workTask.create({
    data: {
      workspaceId: link.workspaceId,
      title: "Smoke: ofis tekshiruvi",
      unit: "LWN",
      assignedEmployeeId: link.employeeId,
      createdByUserId: admin.id,
      source: "WEB",
      status: "NEW",
      priority: "NORMAL",
    },
  });

  await handleAttendanceUpdate({
    update_id: 2005,
    callback_query: {
      id: "cb-smoke",
      data: taskDoneCallbackData(task.id),
      from: { id: FAKE_USER_ID, first_name: "Mohira" },
      message: { chat: { id: FAKE_GROUP_ID }, message_id: 5 },
    },
  });
  const updated = await prisma.workTask.findUniqueOrThrow({ where: { id: task.id } });
  if (updated.status !== "COMPLETED") {
    throw new Error(`expected COMPLETED, got ${updated.status}`);
  }

  // Other user cannot BAJARDIM
  sent.length = 0;
  const task2 = await prisma.workTask.create({
    data: {
      workspaceId: link.workspaceId,
      title: "Smoke: ownership",
      unit: "LWN",
      assignedEmployeeId: link.employeeId,
      createdByUserId: admin.id,
      source: "WEB",
      status: "NEW",
      priority: "NORMAL",
    },
  });
  await handleAttendanceUpdate({
    update_id: 2006,
    callback_query: {
      id: "cb-other",
      data: taskDoneCallbackData(task2.id),
      from: { id: 99988877, first_name: "Other" },
      message: { chat: { id: FAKE_GROUP_ID }, message_id: 6 },
    },
  });
  const stillNew = await prisma.workTask.findUniqueOrThrow({ where: { id: task2.id } });
  if (stillNew.status !== "NEW") {
    throw new Error("other user should not complete task");
  }

  console.log(
    JSON.stringify({
      ok: true,
      profileStatus: link.profileStatus,
      checkInVerification: checkIns[0].verificationStatus,
      bajardimStatus: updated.status,
      ownershipBlocked: stillNew.status === "NEW",
    })
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
