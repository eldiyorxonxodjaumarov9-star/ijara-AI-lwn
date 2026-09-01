/**
 * Verify TTLock migrations on embedded PostgreSQL 18:
 * 1) fresh database — full migrate deploy
 * 2) main-only baseline — deploy applies only TTLock migrations
 */
import { readFileSync } from "node:fs";
import { mkdtempSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const require = createRequire(import.meta.url);

const MAIN_MIGRATION_DIRS = [
  "20260725000000_init",
  "20260726000000_guest_services",
  "20260830210000_arenda_schema_baseline_bridge",
  "20260830220000_employees_started_at_phone_unique",
  "20260831010000_tasks_telegram_module",
];

const TTLOCK_TABLES = [
  "ttlock_connections",
  "ttlock_cached_locks",
  "ttlock_gateways",
  "ttlock_access_credentials",
  "ttlock_remote_commands",
  "ttlock_callback_inbox",
  "room_lock_settings",
  "room_access_grants",
  "room_access_log_events",
];

function run(cmd, args, env = {}) {
  const res = spawnSync(cmd, args, {
    cwd: process.cwd(),
    env: { ...process.env, ...env },
    encoding: "utf8",
    shell: false,
  });
  if (res.status !== 0) {
    throw new Error(
      `${cmd} ${args.join(" ")} failed:\n${res.stderr || res.stdout}`
    );
  }
  return res.stdout;
}

async function withPg(fn) {
  const scratchDir = mkdtempSync(join(tmpdir(), "arenda-ttlock-mig-"));
  const EmbeddedPostgres = (await import("embedded-postgres")).default;
  const port = 57432 + Math.floor(Math.random() * 1000);
  const pg = new EmbeddedPostgres({
    databaseDir: join(scratchDir, "pgdata"),
    user: "postgres",
    password: "postgres",
    port,
    persistent: false,
    initdbFlags: ["--encoding=UTF8", "--locale=C"],
  });
  await pg.initialise();
  await pg.start();
  const databaseUrl = `postgresql://postgres:postgres@127.0.0.1:${port}/postgres?client_encoding=UTF8`;
  process.env.PGCLIENTENCODING = "UTF8";
  try {
    await fn(databaseUrl, pg);
  } finally {
    await pg.stop();
    try {
      rmSync(scratchDir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
}

async function execSql(databaseUrl, sql) {
  const { Client } = await import("pg");
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    await client.query(sql);
  } finally {
    await client.end();
  }
}

async function tableExists(databaseUrl, table) {
  const { Client } = await import("pg");
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    const r = await client.query(`SELECT to_regclass('public.${table}') AS reg`);
    return Boolean(r.rows[0]?.reg);
  } finally {
    await client.end();
  }
}

async function assertTtlockTables(databaseUrl) {
  for (const table of TTLOCK_TABLES) {
    const ok = await tableExists(databaseUrl, table);
    if (!ok) throw new Error(`missing table after migrate: ${table}`);
  }
}

async function applyMainBaseline(databaseUrl) {
  await execSql(
    databaseUrl,
  `CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
    id VARCHAR(36) PRIMARY KEY,
    checksum VARCHAR(64) NOT NULL,
    finished_at TIMESTAMPTZ,
    migration_name VARCHAR(255) NOT NULL,
    logs TEXT,
    rolled_back_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    applied_steps_count INTEGER NOT NULL DEFAULT 0
  );`);

  for (const dir of MAIN_MIGRATION_DIRS) {
    const sqlPath = join("server/prisma/migrations", dir, "migration.sql");
    const sql = readFileSync(sqlPath, "utf8");
    await execSql(databaseUrl, sql);
    await execSql(
      databaseUrl,
      `INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, applied_steps_count)
       VALUES (gen_random_uuid()::text, 'baseline', now(), '${dir}', 1);`
    );
  }
}

async function freshDatabaseTest() {
  await withPg(async (databaseUrl) => {
    run(
      process.execPath,
      [
        require.resolve("prisma/build/index.js"),
        "migrate",
        "deploy",
        "--schema=server/prisma/schema.prisma",
      ],
      { DATABASE_URL: databaseUrl }
    );
    await assertTtlockTables(databaseUrl);
    console.log("PASS: fresh database migrate deploy");
  });
}

async function mainBaselineUpgradeTest() {
  await withPg(async (databaseUrl) => {
    await applyMainBaseline(databaseUrl);
    const before = await tableExists(databaseUrl, "ttlock_connections");
    if (before) throw new Error("baseline should not include ttlock_connections");

    run(
      process.execPath,
      [
        require.resolve("prisma/build/index.js"),
        "migrate",
        "deploy",
        "--schema=server/prisma/schema.prisma",
      ],
      { DATABASE_URL: databaseUrl }
    );
    await assertTtlockTables(databaseUrl);
    console.log("PASS: main baseline + TTLock migrate deploy");
  });
}

try {
  await freshDatabaseTest();
  await mainBaselineUpgradeTest();
  console.log("ALL MIGRATION TESTS PASS");
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}
