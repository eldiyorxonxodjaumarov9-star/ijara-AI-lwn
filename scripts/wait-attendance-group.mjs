/**
 * Wait up to N seconds for a group/supergroup update, save IJARA_ATTENDANCE_GROUP_ID.
 * Single getUpdates loop — do not run alongside another poller.
 */
import fs from "node:fs";
import { config } from "dotenv";

config({ path: ".env.local", override: true });

const token = process.env.IJARA_ATTENDANCE_BOT_TOKEN?.trim();
const waitSec = Number(process.env.ATTENDANCE_GROUP_WAIT_SEC || 120);
if (!token) {
  console.log(JSON.stringify({ ok: false, reason: "no_token" }));
  process.exit(1);
}

async function api(method, body, attempt = 1) {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
    });
    return res.json();
  } catch (e) {
    if (attempt >= 4) throw e;
    await new Promise((r) => setTimeout(r, 1000 * attempt));
    return api(method, body, attempt + 1);
  }
}

function saveGroupId(id) {
  const envPath = ".env.local";
  let lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  let found = false;
  lines = lines.map((line) => {
    if (line.match(/^IJARA_ATTENDANCE_GROUP_ID=/)) {
      found = true;
      return `IJARA_ATTENDANCE_GROUP_ID="${id}"`;
    }
    return line;
  });
  if (!found) lines.push(`IJARA_ATTENDANCE_GROUP_ID="${id}"`);
  fs.writeFileSync(envPath, lines.join("\n"), "utf8");
}

const me = await api("getMe");
if (!me.ok) {
  console.log(JSON.stringify({ ok: false, getMe: "FAIL", description: me.description }));
  process.exit(1);
}
console.log(
  JSON.stringify({
    phase: "waiting",
    username: me.result.username,
    waitSec,
    instruction: "Guruhda istalgan xabar yuboring (masalan: ping)",
  })
);

await api("deleteWebhook", { drop_pending_updates: false });
let offset = 0;
const deadline = Date.now() + waitSec * 1000;

while (Date.now() < deadline) {
  const timeout = Math.max(1, Math.min(20, Math.ceil((deadline - Date.now()) / 1000)));
  let updates;
  try {
    updates = await api("getUpdates", {
      offset,
      timeout,
      allowed_updates: ["message", "my_chat_member", "callback_query"],
    });
  } catch (e) {
    console.log(
      JSON.stringify({
        phase: "retry",
        error: String(e?.message || e),
      })
    );
    await new Promise((r) => setTimeout(r, 2000));
    continue;
  }
  if (!updates.ok) {
    console.log(JSON.stringify({ ok: false, reason: updates.description || "getUpdates" }));
    process.exit(1);
  }
  for (const u of updates.result || []) {
    offset = u.update_id + 1;
    const chat =
      u.message?.chat ||
      u.my_chat_member?.chat ||
      u.callback_query?.message?.chat;
    if (!chat) continue;
    if (chat.type !== "group" && chat.type !== "supergroup") continue;
    const id = String(chat.id);
    saveGroupId(id);
    console.log(
      JSON.stringify(
        {
          ok: true,
          getMe: "PASS",
          username: me.result.username,
          groupFound: true,
          groupId: id,
          groupTitle: chat.title || null,
          groupType: chat.type,
          savedToEnv: true,
        },
        null,
        2
      )
    );
    process.exit(0);
  }
}

console.log(
  JSON.stringify({
    ok: false,
    getMe: "PASS",
    username: me.result.username,
    groupFound: false,
    hint: "Timeout. Guruhda bot admin ekanini va Privacy Mode o‘chirilganini tekshirib, qayta urining.",
  })
);
process.exit(2);
