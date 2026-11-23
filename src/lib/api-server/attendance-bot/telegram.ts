import {
  attendanceBotToken,
  isAttendanceBotConfigured,
} from "@/lib/api-server/attendance-bot/config";

const TELEGRAM_API = "https://api.telegram.org";

function requireToken() {
  const token = attendanceBotToken();
  if (!token) throw new Error("IJARA_ATTENDANCE_BOT_TOKEN sozlanmagan");
  return token;
}

async function request<T>(
  method: string,
  body?: Record<string, unknown>
): Promise<T> {
  const res = await fetch(`${TELEGRAM_API}/bot${requireToken()}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = (await res.json()) as {
    ok: boolean;
    description?: string;
    result?: T;
  };
  if (!data.ok) {
    throw new Error(data.description ?? "Attendance Telegram API xatosi");
  }
  return data.result as T;
}

export async function attendanceSendMessage(
  chatId: string | number,
  text: string,
  extra?: Record<string, unknown>
) {
  if (!isAttendanceBotConfigured()) return false;
  await request("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    ...extra,
  });
  return true;
}

export async function attendanceAnswerCallback(
  callbackQueryId: string,
  text?: string
) {
  if (!isAttendanceBotConfigured()) return;
  await request("answerCallbackQuery", {
    callback_query_id: callbackQueryId,
    ...(text ? { text, show_alert: false } : {}),
  });
}

export async function attendanceSetWebhook(webhookUrl: string, secret: string) {
  return request<boolean>("setWebhook", {
    url: webhookUrl,
    allowed_updates: ["message", "callback_query"],
    drop_pending_updates: true,
    ...(secret ? { secret_token: secret } : {}),
  });
}

export async function attendanceDeleteWebhook() {
  return request<boolean>("deleteWebhook", { drop_pending_updates: false });
}

export async function attendanceGetUpdates(opts: {
  offset?: number;
  timeout?: number;
}) {
  return request<AttendanceUpdate[]>("getUpdates", {
    offset: opts.offset,
    timeout: opts.timeout ?? 25,
    allowed_updates: ["message", "callback_query"],
  });
}

export async function attendanceGetWebhookInfo() {
  return request<{ url?: string; pending_update_count?: number }>(
    "getWebhookInfo"
  );
}

export async function attendanceGetFile(fileId: string) {
  return request<{
    file_id: string;
    file_unique_id?: string;
    file_size?: number;
    file_path?: string;
  }>("getFile", { file_id: fileId });
}

/** Download file bytes. Token stays server-side only. */
export async function attendanceDownloadFile(filePath: string) {
  const res = await fetch(
    `${TELEGRAM_API}/file/bot${requireToken()}/${filePath}`
  );
  if (!res.ok) throw new Error("Davomat selfisini yuklab bo‘lmadi");
  return res.arrayBuffer();
}

export type AttendanceUpdate = {
  update_id: number;
  callback_query?: {
    id: string;
    data?: string;
    from?: {
      id: number;
      first_name?: string;
      last_name?: string;
      username?: string;
    };
    message?: { chat: { id: number }; message_id?: number };
  };
  message?: {
    message_id: number;
    chat: { id: number; type: string };
    from?: {
      id: number;
      first_name?: string;
      last_name?: string;
      username?: string;
    };
    text?: string;
    caption?: string;
    contact?: {
      phone_number: string;
      first_name?: string;
      user_id?: number;
    };
    photo?: Array<{
      file_id: string;
      file_unique_id?: string;
      file_size?: number;
      width?: number;
      height?: number;
    }>;
  };
};
