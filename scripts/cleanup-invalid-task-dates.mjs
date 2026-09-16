/**
 * Optional dry-run / cleanup for WorkTask rows with absurd dueAt years.
 * Does NOT run automatically — invoke manually when needed:
 *
 *   node scripts/cleanup-invalid-task-dates.mjs
 *   node scripts/cleanup-invalid-task-dates.mjs --apply
 */
import { PrismaClient } from "@prisma/client";

const MIN_YEAR = 2000;
const MAX_YEAR = 2100;
const apply = process.argv.includes("--apply");

const prisma = new PrismaClient();

function isInvalidDueAt(value) {
  if (!value) return false;
  const year = value.getFullYear();
  return !Number.isFinite(year) || year < MIN_YEAR || year > MAX_YEAR;
}

async function main() {
  const tasks = await prisma.workTask.findMany({
    where: { dueAt: { not: null } },
    select: { id: true, title: true, dueAt: true },
  });

  const invalid = tasks.filter((t) => isInvalidDueAt(t.dueAt));
  console.log(`Found ${invalid.length} task(s) with invalid dueAt.`);

  for (const task of invalid) {
    console.log(
      `- ${task.id} | ${task.title} | dueAt=${task.dueAt?.toISOString()}`
    );
  }

  if (!apply) {
    console.log("\nDry run only. Re-run with --apply to set dueAt = null.");
    return;
  }

  if (invalid.length === 0) return;

  await prisma.workTask.updateMany({
    where: { id: { in: invalid.map((t) => t.id) } },
    data: { dueAt: null },
  });
  console.log(`\nCleared dueAt on ${invalid.length} task(s).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
