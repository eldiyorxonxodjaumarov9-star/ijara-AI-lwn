import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const envPath = path.join(process.cwd(), ".env.local");
const envText = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";

function readEnv(name) {
  const match = envText.match(new RegExp(`^${name}\\s*=\\s*"?([^"\\r\\n]+)"?`, "m"));
  return match?.[1] ?? process.env[name] ?? "";
}

const vars = [
  ["TELEGRAM_BOT_TOKEN", readEnv("TELEGRAM_BOT_TOKEN")],
  ["CRON_SECRET", readEnv("CRON_SECRET")],
  ["NEXT_PUBLIC_APP_URL", readEnv("NEXT_PUBLIC_APP_URL")],
];

for (const [name, value] of vars) {
  if (!value) {
    console.warn(`skip ${name}: empty`);
    continue;
  }
  const res = spawnSync(
    "npx",
    ["vercel", "env", "add", name, "production", "--force"],
    {
      input: value,
      encoding: "utf8",
      shell: true,
      stdio: ["pipe", "inherit", "inherit"],
    }
  );
  if (res.status !== 0) {
    console.error(`failed ${name}`);
    process.exit(res.status ?? 1);
  }
  console.log(`added ${name}`);
}

console.log("done");
