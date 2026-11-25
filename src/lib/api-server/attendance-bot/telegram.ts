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
  if (!isAttendanceBotConfigured()) return null;
  const result = await request<{ message_id: number }>("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    ...extra,
  });
  return result;
}

/** Multipart sendPhoto — token never logged. */
export async function attendanceSendPhotoBuffer(opts: {
  chatId: string | number;
  buffer: Buffer;
  mimeType: string;
  filename?: string;
  caption?: string;
}) {
  if (!isAttendanceBotConfigured()) return null;
  const form = new FormData();
  form.append("chat_id", String(opts.chatId));
  if (opts.caption) {
    form.append("caption", opts.caption.slice(0, 1024));
    form.append("parse_mode", "HTML");
  }
  const ext =
    opts.mimeType === "image/png"
      ? "png"
      : opts.mimeType === "image/webp"
        ? "webp"
        : "jpg";
  form.append(
    "photo",
    new Blob([new Uint8Array(opts.buffer)], { type: opts.mimeType }),
    opts.filename || `photo.${ext}`
  );
  const res = await fetch(
    `${TELEGRAM_API}/bot${requireToken()}/sendPhoto`,
    { method: "POST", body: form }
  );
  const data = (await res.json()) as {
    ok: boolean;
    description?: string;
    result?: { message_id: number };
  };
  if (!data.ok) {
    throw new Error(data.description ?? "Attendance sendPhoto xatosi");
  }
  return data.result ?? null;
}

/** Media group (2–10 photos). Caption on the first item only. */
export async function attendanceSendPhotoGroup(opts: {
  chatId: string | number;
  photos: Array<{ buffer: Buffer; mimeType: string; filename?: string }>;
  caption?: string;
}) {
  if (!isAttendanceBotConfigured()) return [];
  if (opts.photos.length === 0) return [];
  if (opts.photos.length === 1) {
    const one = await attendanceSendPhotoBuffer({
      chatId: opts.chatId,
      buffer: opts.photos[0].buffer,
      mimeType: opts.photos[0].mimeType,
      filename: opts.photos[0].filename,
      caption: opts.caption,
    });
    return one ? [one.message_id] : [];
  }

  const form = new FormData();
  form.append("chat_id", String(opts.chatId));
  const media = opts.photos.map((p, i) => {
    const item: Record<string, unknown> = {
      type: "photo",
      media: `attach://qrphoto${i}`,
    };
    if (i === 0 && opts.caption) {
      item.caption = opts.caption.slice(0, 1024);
      item.parse_mode = "HTML";
    }
    return item;
  });
  form.append("media", JSON.stringify(media));
  opts.photos.forEach((p, i) => {
    const ext =
      p.mimeType === "image/png"
        ? "png"
        : p.mimeType === "image/webp"
          ? "webp"
          : "jpg";
    form.append(
      `qrphoto${i}`,
      new Blob([new Uint8Array(p.buffer)], { type: p.mimeType }),
      p.filename || `photo${i}.${ext}`
    );
  });

  const res = await fetch(
    `${TELEGRAM_API}/bot${requireToken()}/sendMediaGroup`,
    { method: "POST", body: form }
  );
  const data = (await res.json()) as {
    ok: boolean;
    description?: string;
    result?: Array<{ message_id: number }>;
  };
  if (!data.ok) {
    throw new Error(data.description ?? "Attendance sendMediaGroup xatosi");
  }
  return (data.result ?? []).map((m) => m.message_id);
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
      is_bot?: boolean;
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
