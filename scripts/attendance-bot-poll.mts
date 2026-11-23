/**
 * Local long-polling for the independent attendance bot.
 * Does NOT use TELEGRAM_BOT_TOKEN.
 *
 * Usage (with local Next + embedded PG running):
 *   npx tsx scripts/attendance-bot-poll.mts
 */
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });

async function main() {
  if (process.env.DATABASE_URL?.includes("neon.tech")) {
    console.error("ABORT: DATABASE_URL looks like Neon production. Use local PG.");
    process.exit(1);
  }
  if (process.env.IJARA_ATTENDANCE_ENABLED !== "true") {
    console.error("Set IJARA_ATTENDANCE_ENABLED=true in .env.local");
    process.exit(1);
  }
  if (!process.env.IJARA_ATTENDANCE_BOT_TOKEN?.trim()) {
    console.error("Set IJARA_ATTENDANCE_BOT_TOKEN in .env.local (never commit it)");
    process.exit(1);
  }

  const { attendanceDeleteWebhook, attendanceGetUpdates } = await import(
    "../src/lib/api-server/attendance-bot/telegram"
  );
  const { handleAttendanceUpdate } = await import(
    "../src/lib/api-server/attendance-bot/handler"
  );

  // Avoid dual delivery with webhook while polling locally
  try {
    await attendanceDeleteWebhook();
    console.log("Webhook cleared for polling mode");
  } catch (e) {
    console.warn("deleteWebhook:", e instanceof Error ? e.message : e);
  }

  let offset = 0;
  console.log("Attendance bot polling… Ctrl+C to stop");
  for (;;) {
    try {
      const updates = await attendanceGetUpdates({ offset, timeout: 25 });
      for (const u of updates) {
        offset = u.update_id + 1;
        await handleAttendanceUpdate(u);
      }
    } catch (e) {
      console.error("poll error", e instanceof Error ? e.message : e);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
}

main();
