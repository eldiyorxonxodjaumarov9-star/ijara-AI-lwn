import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  isAttendanceBotConfigured,
  isAttendanceBotEnabled,
  isAttendanceGroupChat,
} from "@/lib/api-server/attendance-bot/config";
import { assertSingleFaceSelfiePresence } from "@/lib/api-server/attendance-bot/face-presence";
import {
  buildKeldiGroupMessage,
  buildTelegramDisplayName,
  displayNameForAttendanceLink,
  parseTaskDoneCallback,
  phonesMatch,
  taskDoneCallbackData,
  tashkentWorkDate,
} from "@/lib/api-server/attendance-bot/service";

const root = process.cwd();
const read = (p: string) => readFileSync(join(root, p), "utf8");

describe("attendance bot isolation", () => {
  it("module never imports main TELEGRAM_BOT_TOKEN helpers for sending", () => {
    const telegram = read("src/lib/api-server/attendance-bot/telegram.ts");
    const handler = read("src/lib/api-server/attendance-bot/handler.ts");
    const webhook = read("src/app/api/attendance-bot/webhook/route.ts");
    for (const src of [telegram, handler, webhook]) {
      assert.equal(/TELEGRAM_BOT_TOKEN/.test(src), false);
      assert.equal(/api-server\/telegram-bot/.test(src), false);
      assert.equal(/handleTelegramUpdate/.test(src), false);
    }
    assert.match(telegram, /IJARA_ATTENDANCE_BOT_TOKEN|attendanceBotToken/);
  });

  it("main telegram webhook route is unchanged path", () => {
    const src = read("src/app/api/telegram/webhook/route.ts");
    assert.match(src, /handleTelegramUpdate/);
    assert.match(src, /TELEGRAM_BOT_TOKEN|isTelegramBotConfigured/);
    assert.equal(/attendance/i.test(src), false);
  });

  it("webhook uses attendance secret header", () => {
    const src = read("src/app/api/attendance-bot/webhook/route.ts");
    assert.match(src, /IJARA_ATTENDANCE_WEBHOOK_SECRET|attendanceWebhookSecret/);
    assert.match(src, /x-telegram-bot-api-secret-token/);
    assert.match(src, /handleAttendanceUpdate/);
  });

  it("handler has no contact /start registration flow", () => {
    const handler = read("src/lib/api-server/attendance-bot/handler.ts");
    assert.equal(/request_contact/.test(handler), false);
    assert.equal(/sendContactPrompt/.test(handler), false);
    assert.equal(/registerEmployeeByPhone/.test(handler), false);
    assert.match(handler, /ensureAttendanceProfileFromTelegram/);
    assert.match(handler, /isAttendanceGroupChat/);
  });
});

describe("attendance bot helpers", () => {
  it("enabled flag parsing requires group for configured", () => {
    const prev = process.env.IJARA_ATTENDANCE_ENABLED;
    const prevTok = process.env.IJARA_ATTENDANCE_BOT_TOKEN;
    const prevGroup = process.env.IJARA_ATTENDANCE_GROUP_ID;
    try {
      process.env.IJARA_ATTENDANCE_ENABLED = "true";
      process.env.IJARA_ATTENDANCE_BOT_TOKEN = "test-token";
      process.env.IJARA_ATTENDANCE_GROUP_ID = "-1003911506368";
      assert.equal(isAttendanceBotEnabled(), true);
      assert.equal(isAttendanceBotConfigured(), true);
      process.env.IJARA_ATTENDANCE_GROUP_ID = "";
      assert.equal(isAttendanceBotConfigured(), false);
      process.env.IJARA_ATTENDANCE_ENABLED = "false";
      process.env.IJARA_ATTENDANCE_GROUP_ID = "-1003911506368";
      assert.equal(isAttendanceBotEnabled(), false);
      assert.equal(isAttendanceBotConfigured(), false);
    } finally {
      process.env.IJARA_ATTENDANCE_ENABLED = prev;
      process.env.IJARA_ATTENDANCE_BOT_TOKEN = prevTok;
      process.env.IJARA_ATTENDANCE_GROUP_ID = prevGroup;
    }
  });

  it("phone match uses last 9 digits", () => {
    assert.equal(phonesMatch("+998901112233", "901112233"), true);
    assert.equal(phonesMatch("998901112233", "+998 90 111 22 33"), true);
    assert.equal(phonesMatch("901112233", "901112244"), false);
  });

  it("callback data round-trip (ownership payload)", () => {
    const id = "task-uuid-123";
    const data = taskDoneCallbackData(id);
    assert.ok(data.length <= 64);
    assert.equal(parseTaskDoneCallback(data), id);
    assert.equal(parseTaskDoneCallback("other"), null);
    assert.equal(parseTaskDoneCallback("att:done:"), null);
  });

  it("workDate is YYYY-MM-DD Asia/Tashkent", () => {
    assert.match(
      tashkentWorkDate(new Date("2026-11-23T10:00:00Z")),
      /^\d{4}-\d{2}-\d{2}$/
    );
  });

  it("group chat matcher supports negative ids (workspace isolation gate)", () => {
    const prev = process.env.IJARA_ATTENDANCE_GROUP_ID;
    try {
      process.env.IJARA_ATTENDANCE_GROUP_ID = "-1003911506368";
      assert.equal(isAttendanceGroupChat(-1003911506368), true);
      assert.equal(isAttendanceGroupChat("-1003911506368"), true);
      assert.equal(isAttendanceGroupChat(-100999), false);
      assert.equal(isAttendanceGroupChat(12345), false);
    } finally {
      process.env.IJARA_ATTENDANCE_GROUP_ID = prev;
    }
  });

  it("display name: unverified uses telegram name, verified uses employee", () => {
    assert.equal(
      displayNameForAttendanceLink({
        profileStatus: "UNVERIFIED",
        telegramDisplayName: "Mohira opa",
        employee: { fullName: "Auto stub" },
      }),
      "Mohira opa"
    );
    assert.equal(
      displayNameForAttendanceLink({
        profileStatus: "VERIFIED",
        telegramDisplayName: "Mohira opa",
        employee: { fullName: "Mohira Karimova" },
      }),
      "Mohira Karimova"
    );
  });

  it("telegram display name builder", () => {
    assert.equal(
      buildTelegramDisplayName({
        id: 1,
        first_name: "Mohira",
        last_name: "opa",
      }),
      "Mohira opa"
    );
    assert.equal(
      buildTelegramDisplayName({ id: 2, username: "mohira" }),
      "@mohira"
    );
  });

  it("KELDI group message format", () => {
    const text = buildKeldiGroupMessage({
      displayName: "Mohira opa",
      unverified: true,
      taskCount: 3,
      now: new Date("2026-11-23T03:30:00Z"),
    });
    assert.match(text, /ISHGA KELDINGIZ/);
    assert.match(text, /Mohira opa/);
    assert.match(text, /tasdiqlanmagan/);
    assert.match(text, /Bugungi vazifalar: 3 ta/);
    assert.match(text, /\d{2}\.\d{2}\.\d{4}/);
    assert.match(text, /\d{2}:\d{2}/);
  });
});

describe("face presence is not identity", () => {
  it("rejects empty / tiny photos", () => {
    assert.equal(assertSingleFaceSelfiePresence([]).ok, false);
    assert.equal(
      assertSingleFaceSelfiePresence([
        { file_id: "x", width: 40, height: 40 },
      ]).ok,
      false
    );
  });

  it("accepts selfie sizes without claiming identity match", () => {
    const r = assertSingleFaceSelfiePresence([
      { file_id: "a", width: 90, height: 90 },
      { file_id: "b", width: 640, height: 640 },
    ]);
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.assumedFaceCount, 1);
      assert.equal(r.identityMatched, false);
      assert.equal(r.best.file_id, "b");
    }
  });
});

describe("attendance dashboard contracts", () => {
  it("nav includes Davomat after Vazifalar", () => {
    const nav = read("src/config/navigation.ts");
    assert.match(nav, /nav\.attendance/);
    assert.match(nav, /href: "\/attendance"/);
    assert.match(nav, /ClipboardCheck/);
    const tasksIdx = nav.indexOf('href: "/tasks"');
    const attIdx = nav.indexOf('href: "/attendance"');
    assert.ok(tasksIdx >= 0 && attIdx > tasksIdx);
  });

  it("selfie proxy never embeds bot token in path", () => {
    const route = read("src/app/api/attendance/selfies/[id]/route.ts");
    assert.equal(/IJARA_ATTENDANCE_BOT_TOKEN/.test(route), false);
    assert.match(route, /requireResourceAccess/);
    assert.match(route, /Rasm mavjud emas/);
  });

  it("media storage is workspace-scoped and prefers private Blob", () => {
    const media = read("src/lib/api-server/attendance-bot/media.ts");
    assert.match(media, /workspaceId/);
    assert.match(media, /IJARA_ATTENDANCE_MEDIA_RETENTION_DAYS|retention/);
    assert.match(media, /BLOB_READ_WRITE_TOKEN|@vercel\/blob/);
    assert.match(media, /access:\s*"private"/);
  });

  it("task notify uses attendance bot not main TELEGRAM_BOT_TOKEN", () => {
    const src = read("src/lib/api-server/attendance-bot/task-notify.ts");
    assert.equal(/TELEGRAM_BOT_TOKEN/.test(src), false);
    assert.match(src, /attendanceSendMessage|attendanceGroupId/);
    assert.match(src, /taskDoneCallbackData/);
  });
});

describe("duplicate / ownership contracts in source", () => {
  it("check-in uniqueness uses employeeId_workDate", () => {
    const service = read("src/lib/api-server/attendance-bot/service.ts");
    assert.match(service, /employeeId_workDate/);
    assert.match(service, /verificationStatus/);
    assert.match(service, /profileStatus/);
  });

  it("BAJARDIM enforces assigned employee ownership then COMPLETED", () => {
    const service = read("src/lib/api-server/attendance-bot/service.ts");
    assert.match(service, /assignedEmployeeId !== opts\.employeeId/);
    assert.match(service, /COMPLETED/);
    assert.match(service, /submitTaskReport/);
  });

  it("merge blocks cross-workspace", () => {
    const service = read("src/lib/api-server/attendance-bot/service.ts");
    assert.match(service, /WORKSPACE_MISMATCH/);
  });
});
