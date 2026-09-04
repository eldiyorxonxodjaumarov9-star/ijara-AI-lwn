/**
 * Safe payment cleanup (dry-run by default).
 * - Backfill null periodYear/periodMonth from paymentDate (Asia/Tashkent)
 * - Report exact duplicate candidates
 * - NEVER deletes unless --apply-delete-duplicates AND exact match
 * Real partial payments (e.g. 3600+720) are preserved.
 *
 * Usage:
 *   node scripts/cleanup-payment-period-duplicates.mjs
 *   node scripts/cleanup-payment-period-duplicates.mjs --apply-backfill
 *   node scripts/cleanup-payment-period-duplicates.mjs --apply-delete-duplicates
 */
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const APPLY_BACKFILL = process.argv.includes("--apply-backfill");
const APPLY_DELETE = process.argv.includes("--apply-delete-duplicates");

function loadEnv() {
  const path = join(root, ".env.local");
  if (!existsSync(path)) throw new Error("missing .env.local");
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq <= 0) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    process.env[key] = val;
  }
}

function tashkentParts(date) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tashkent",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(date).map((p) => [p.type, p.value])
  );
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
  };
}

loadEnv();
const url = process.env.DATABASE_URL || "";
if (!url.includes("neon.tech")) {
  console.error("BLOCKED: DATABASE_URL is not Neon");
  process.exit(1);
}

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient({ datasources: { db: { url } } });

try {
  const payments = await prisma.payment.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      contractId: true,
      amount: true,
      paymentDate: true,
      periodYear: true,
      periodMonth: true,
      paymentMethod: true,
      createdAt: true,
      contract: {
        select: {
          monthlyRent: true,
          property: { select: { title: true } },
          tenant: { select: { fullName: true } },
        },
      },
    },
  });

  const nullPeriod = payments.filter((p) => !p.periodYear || !p.periodMonth);
  console.log(`null_period_count=${nullPeriod.length}`);

  if (APPLY_BACKFILL) {
    let updated = 0;
    for (const p of nullPeriod) {
      const parts = tashkentParts(new Date(p.paymentDate));
      await prisma.payment.update({
        where: { id: p.id },
        data: { periodYear: parts.year, periodMonth: parts.month },
      });
      updated += 1;
    }
    console.log(`backfill_updated=${updated}`);
  } else {
    console.log("backfill=dry-run (pass --apply-backfill to write)");
  }

  // Exact duplicates: same contract+amount+method+period, created within 60s
  const byKey = new Map();
  for (const p of payments) {
    const periodY = p.periodYear ?? tashkentParts(new Date(p.paymentDate)).year;
    const periodM =
      p.periodMonth ?? tashkentParts(new Date(p.paymentDate)).month;
    const key = `${p.contractId}|${p.amount}|${p.paymentMethod}|${periodY}-${periodM}`;
    const list = byKey.get(key) ?? [];
    list.push(p);
    byKey.set(key, list);
  }

  const duplicateGroups = [];
  for (const [key, list] of byKey) {
    if (list.length < 2) continue;
    // Keep first; candidates after within 60s of previous
    const sorted = list.slice().sort(
      (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
    );
    const toDelete = [];
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const cur = sorted[i];
      const delta =
        new Date(cur.createdAt).getTime() - new Date(prev.createdAt).getTime();
      if (delta <= 60_000) toDelete.push(cur.id);
    }
    if (toDelete.length) {
      duplicateGroups.push({
        key,
        keep: sorted[0].id,
        deleteIds: toDelete,
        property: sorted[0].contract?.property?.title,
        tenant: sorted[0].contract?.tenant?.fullName,
        amount: sorted[0].amount,
      });
    }
  }

  console.log(`exact_duplicate_groups=${duplicateGroups.length}`);
  console.log(JSON.stringify(duplicateGroups, null, 2));

  // Partial payments report (same contract+period, different amounts that sum to rent)
  const byContractPeriod = new Map();
  for (const p of payments) {
    const periodY = p.periodYear ?? tashkentParts(new Date(p.paymentDate)).year;
    const periodM =
      p.periodMonth ?? tashkentParts(new Date(p.paymentDate)).month;
    const key = `${p.contractId}|${periodY}-${periodM}`;
    const list = byContractPeriod.get(key) ?? [];
    list.push(p);
    byContractPeriod.set(key, list);
  }

  const partialOk = [];
  for (const [key, list] of byContractPeriod) {
    if (list.length < 2) continue;
    const amounts = list.map((p) => p.amount);
    const sum = amounts.reduce((s, a) => s + a, 0);
    const rent = list[0].contract?.monthlyRent ?? 0;
    const uniqueAmounts = new Set(amounts);
    if (uniqueAmounts.size > 1) {
      partialOk.push({
        key,
        property: list[0].contract?.property?.title,
        tenant: list[0].contract?.tenant?.fullName,
        amounts,
        sum,
        monthlyRent: rent,
        preserve: true,
      });
    }
  }
  console.log(`partial_payment_groups_preserved=${partialOk.length}`);
  console.log(JSON.stringify(partialOk, null, 2));

  if (APPLY_DELETE && duplicateGroups.length) {
    let deleted = 0;
    for (const g of duplicateGroups) {
      await prisma.payment.deleteMany({ where: { id: { in: g.deleteIds } } });
      deleted += g.deleteIds.length;
    }
    console.log(`duplicates_deleted=${deleted}`);
  } else {
    console.log(
      "delete=dry-run (pass --apply-delete-duplicates only for exact 60s dupes)"
    );
  }
} finally {
  await prisma.$disconnect();
}
