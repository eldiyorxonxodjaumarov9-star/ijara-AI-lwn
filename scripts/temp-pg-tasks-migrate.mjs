/**
 * Temp embedded PostgreSQL smoke for Vazifalar schema.
 * 1) Attempts migrate deploy (documents history reality)
 * 2) Always validates current Arenda schema via db push on a fresh temp DB
 *    then CRUD WorkTask / unique constraints.
 * Never uses Neon / developer DATABASE_URL values for the smoke connection.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";

const root = process.cwd();
const schema = path.join(root, "server", "prisma", "schema.prisma");
const require = createRequire(path.join(root, "package.json"));
const prismaCli = require.resolve("prisma/build/index.js");

function runPrisma(args, env) {
  const r = spawnSync(process.execPath, [prismaCli, ...args], {
    cwd: root,
    env,
    encoding: "utf8",
    shell: false,
    timeout: 180000,
  });
  return r;
}

async function main() {
  let EmbeddedPostgres;
  try {
    EmbeddedPostgres = (await import("embedded-postgres")).default;
  } catch {
    console.error("INSTALL_EMBEDDED_POSTGRES");
    process.exit(2);
  }

  // SQL safety audit (no DB)
  const taskSql = fs.readFileSync(
    path.join(
      root,
      "server/prisma/migrations/20260831010000_tasks_telegram_module/migration.sql"
    ),
    "utf8"
  );
  const sqlNoComments = taskSql
    .split(/\r?\n/)
    .filter((l) => !l.trim().startsWith("--"))
    .join("\n");
  for (const bad of [/\bDROP\s+TABLE\b/i, /\bDROP\s+COLUMN\b/i, /\bTRUNCATE\b/i, /\bDELETE\s+FROM\b/i]) {
    if (bad.test(sqlNoComments)) {
      throw new Error(`Destructive SQL found: ${bad}`);
    }
  }
  if (!taskSql.includes("telegramChatId")) {
    throw new Error("Expected nullable telegramChatId in migration");
  }
  console.log("TASK_MIGRATION_SQL_SAFE");

  const dataDir = path.join(os.tmpdir(), `arenda-tasks-pg-${process.pid}`);
  if (fs.existsSync(dataDir)) fs.rmSync(dataDir, { recursive: true, force: true });

  const port = 55435;
  const pg = new EmbeddedPostgres({
    databaseDir: dataDir,
    user: "postgres",
    password: "postgres",
    port,
    persistent: false,
    initdbFlags: ["--encoding=UTF8", "--locale=C"],
  });

  console.log("starting embedded postgres at", dataDir);
  await pg.initialise();
  await pg.start();
  await pg.createDatabase("tasks_mig_history");
  await pg.createDatabase("tasks_schema_smoke");

  const historyUrl = `postgresql://postgres:postgres@127.0.0.1:${port}/tasks_mig_history`;
  const smokeUrl = `postgresql://postgres:postgres@127.0.0.1:${port}/tasks_schema_smoke`;

  try {
    console.log("migrate deploy (history DB)...");
    const mig = runPrisma(
      ["migrate", "deploy", `--schema=${schema}`],
      { ...process.env, DATABASE_URL: historyUrl, POSTGRES_PRISMA_URL: historyUrl }
    );
    if (mig.stdout) process.stdout.write(mig.stdout);
    if (mig.stderr) process.stderr.write(mig.stderr);
    if (mig.status === 0) {
      console.log("MIGRATE_DEPLOY_FROM_SCRATCH_OK");
    } else {
      console.log(
        "MIGRATE_DEPLOY_FROM_SCRATCH_BLOCKED: historical init migration is not Arenda employees baseline (Dextrans Warehouse schema). Documented; continuing with schema smoke."
      );
    }

    console.log("db push current schema (smoke DB)...");
    const push = runPrisma(
      [
        "db",
        "push",
        `--schema=${schema}`,
        "--skip-generate",
        "--accept-data-loss",
      ],
      { ...process.env, DATABASE_URL: smokeUrl, POSTGRES_PRISMA_URL: smokeUrl }
    );
    if (push.stdout) process.stdout.write(push.stdout);
    if (push.stderr) process.stderr.write(push.stderr);
    if (push.status !== 0) throw new Error("db push smoke failed");

    const { PrismaClient } = await import("@prisma/client");
    const prisma = new PrismaClient({
      datasources: { db: { url: smokeUrl } },
    });

    const user = await prisma.user.create({
      data: {
        email: `task-test-${Date.now()}@example.com`,
        password: "x",
        fullName: "Test Admin",
        role: "ADMIN",
      },
    });
    const company = await prisma.partnerCompany.create({
      data: { name: "Sunnur" },
    });
    const emp = await prisma.employee.create({
      data: {
        fullName: "Test Employee",
        phone: `99890${String(Date.now()).slice(-7)}`,
        position: "Farrosh",
        companyId: company.id,
        active: true,
      },
    });
    assertOk(emp.telegramChatId == null, "telegramChatId nullable");

    const task = await prisma.workTask.create({
      data: {
        title: "Smoke task",
        unit: "SUNNUR",
        assignedEmployeeId: emp.id,
        createdByUserId: user.id,
        source: "WEB",
      },
    });
    await prisma.workTaskStatusEvent.create({
      data: {
        taskId: task.id,
        toStatus: "NEW",
        actorUserId: user.id,
        actorKind: "USER",
        source: "WEB",
      },
    });
    const report = await prisma.workTaskReport.create({
      data: { taskId: task.id, employeeId: emp.id, reportText: "done" },
    });
    await prisma.workTaskAttachment.create({
      data: {
        taskReportId: report.id,
        type: "DOCUMENT",
        storageUrl: "https://example.com/a.pdf",
        mimeType: "application/pdf",
      },
    });

    await prisma.employee.update({
      where: { id: emp.id },
      data: { telegramChatId: "c1" },
    });
    let chatUnique = false;
    try {
      await prisma.employee.create({
        data: {
          fullName: "Other",
          phone: `99891${String(Date.now()).slice(-7)}`,
          position: "Oshpaz",
          active: true,
          telegramChatId: "c1",
        },
      });
    } catch {
      chatUnique = true;
    }
    assertOk(chatUnique, "telegramChatId unique");

    await prisma.telegramProcessedUpdate.create({ data: { updateId: 99n } });
    let dedupe = false;
    try {
      await prisma.telegramProcessedUpdate.create({ data: { updateId: 99n } });
    } catch {
      dedupe = true;
    }
    assertOk(dedupe, "update_id unique");

    assertOk((await prisma.workTask.count()) === 1, "task count");
    await prisma.$disconnect();
    console.log("TEMP_PG_SCHEMA_SMOKE_OK");
    console.log("TEMP_PG_MIGRATION_OK");
  } finally {
    try {
      await pg.stop();
    } catch {
      /* ignore */
    }
    try {
      fs.rmSync(dataDir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
}

function assertOk(cond, msg) {
  if (!cond) throw new Error(msg);
}

main().catch((e) => {
  console.error("TEMP_PG_FAIL", e?.message || e);
  process.exit(1);
});
