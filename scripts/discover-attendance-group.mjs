/**
 * One-shot getUpdates to discover attendance group chat.id.
 * Stops if another poller may be running — caller must stop poll first.
 * Never prints bot token.
 */
import fs from "node:fs";
import { config } from "dotenv";

config({ path: ".env.local", override: true });

const token = process.env.IJARA_ATTENDANCE_BOT_TOKEN?.trim();
if (!token) {
  console.log(JSON.stringify({ ok: false, reason: "no_token" }));
  process.exit(1);
}
if (process.env.DATABASE_URL?.includes("neon.tech")) {
  console.log(JSON.stringify({ ok: false, reason: "neon_db" }));
  process.exit(1);
}

async function api(method, body) {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  return res.json();
}

const me = await api("getMe");
if (!me.ok) {
  console.log(JSON.stringify({ ok: false, getMe: "FAIL", description: me.description }));
  process.exit(1);
}

await api("deleteWebhook", { drop_pending_updates: false });
const updates = await api("getUpdates", {
  timeout: 0,
  allowed_updates: ["message", "my_chat_member", "callback_query"],
});

if (!updates.ok) {
  console.log(JSON.stringify({ ok: false, reason: updates.description || "getUpdates" }));
  process.exit(1);
}

const groups = [];
const seen = new Set();
for (const u of updates.result || []) {
  const chat =
    u.message?.chat ||
    u.my_chat_member?.chat ||
    u.callback_query?.message?.chat;
  if (!chat) continue;
  if (chat.type !== "group" && chat.type !== "supergroup") continue;
  const id = String(chat.id);
  if (seen.has(id)) continue;
  seen.add(id);
  groups.push({
    id,
    title: chat.title || null,
    type: chat.type,
    update_id: u.update_id,
  });
}

const preferred =
  groups.find((g) => /davomat|vazifa|ijara/i.test(g.title || "")) ||
  groups[0] ||
  null;

if (!preferred) {
  console.log(
    JSON.stringify(
      {
        ok: false,
        getMe: "PASS",
        username: me.result.username,
        groupFound: false,
        pendingUpdates: (updates.result || []).length,
        hint: "Guruhda istalgan xabar yuboring (masalan: ping), keyin skriptni qayta ishga tushiring.",
      },
      null,
      2
    )
  );
  process.exit(2);
}

// Persist GROUP_ID
const envPath = ".env.local";
let lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
let found = false;
lines = lines.map((line) => {
  if (line.match(/^IJARA_ATTENDANCE_GROUP_ID=/)) {
    found = true;
    return `IJARA_ATTENDANCE_GROUP_ID="${preferred.id}"`;
  }
  return line;
});
if (!found) lines.push(`IJARA_ATTENDANCE_GROUP_ID="${preferred.id}"`);
fs.writeFileSync(envPath, lines.join("\n"), "utf8");

// Consume updates up to latest so poller starts clean
const maxId = Math.max(...(updates.result || []).map((u) => u.update_id));
if (Number.isFinite(maxId)) {
  await api("getUpdates", { offset: maxId + 1, timeout: 0 });
}

console.log(
  JSON.stringify(
    {
      ok: true,
      getMe: "PASS",
      username: me.result.username,
      groupFound: true,
      groupId: preferred.id,
      groupTitle: preferred.title,
      groupType: preferred.type,
      candidates: groups.length,
      savedToEnv: true,
    },
    null,
    2
  )
);
