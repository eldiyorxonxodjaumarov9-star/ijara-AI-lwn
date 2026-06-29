import { isDatabaseConfigured, prisma } from "@/lib/api-server/prisma";

let postingTablesReady: boolean | null = null;

function isMissingTableError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { code?: string; message?: string };
  const msg = e.message ?? "";
  return (
    e.code === "P2021" ||
    msg.includes("does not exist") ||
    msg.includes("posting_channels")
  );
}

/** DATABASE_URL bor, lekin posting jadvallari migratsiya qilinmagan bo'lishi mumkin */
export async function isPostingDbReady(): Promise<boolean> {
  if (!isDatabaseConfigured()) return false;
  if (postingTablesReady === true) return true;
  if (postingTablesReady === false) return false;

  try {
    await prisma.postingChannel.findFirst({ select: { id: true } });
    postingTablesReady = true;
    return true;
  } catch (err) {
    if (isMissingTableError(err)) {
      postingTablesReady = false;
      return false;
    }
    throw err;
  }
}

export function resetPostingDbReadyCache() {
  postingTablesReady = null;
}
