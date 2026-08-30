import { NextRequest } from "next/server";
import { z } from "zod";

import { requireUser } from "@/lib/api-server/auth";
import { fail, ok, paginated, parsePagination } from "@/lib/api-server/http";
import { isDatabaseConfigured } from "@/lib/api-server/prisma";
import {
  assertStaffCanManageTasks,
  createTask,
  getTaskStats,
  listTasks,
} from "@/lib/api-server/tasks/task-service";

const createSchema = z.object({
  title: z.string().min(2),
  description: z.string().optional().nullable(),
  unit: z.enum(["SUNNUR", "LWN"]),
  assignedEmployeeId: z.string().min(1),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).optional(),
  dueAt: z.string().optional().nullable(),
  notifyTelegram: z.boolean().optional().default(true),
});

export async function GET(req: NextRequest) {
  if (!isDatabaseConfigured()) return fail("DATABASE_URL sozlanmagan", 501);
  const auth = await requireUser(req);
  if (auth.error) return auth.error;

  try {
    await assertStaffCanManageTasks(auth.user);
  } catch {
    return fail("Ruxsat yo‘q", 403);
  }

  const url = new URL(req.url);
  if (url.searchParams.get("stats") === "1") {
    const stats = await getTaskStats();
    return ok(stats);
  }

  const { page, limit, skip, search } = parsePagination(url);
  const unit = url.searchParams.get("unit") as "SUNNUR" | "LWN" | null;
  const status = url.searchParams.get("status") as
    | "NEW"
    | "IN_PROGRESS"
    | "SUBMITTED"
    | "COMPLETED"
    | "NOT_COMPLETED"
    | "CANCELLED"
    | null;
  const employeeId = url.searchParams.get("employeeId") ?? undefined;
  const priority = url.searchParams.get("priority") as
    | "LOW"
    | "NORMAL"
    | "HIGH"
    | "URGENT"
    | null;
  const overdueOnly = url.searchParams.get("overdue") === "1";

  const result = await listTasks({
    page,
    limit,
    skip,
    search,
    unit: unit ?? undefined,
    status: status ?? undefined,
    employeeId,
    priority: priority ?? undefined,
    overdueOnly,
  });

  return ok(paginated(result.data, result.total, page, limit));
}

export async function POST(req: NextRequest) {
  if (!isDatabaseConfigured()) return fail("DATABASE_URL sozlanmagan", 501);
  const auth = await requireUser(req);
  if (auth.error) return auth.error;

  try {
    await assertStaffCanManageTasks(auth.user);
  } catch {
    return fail("Ruxsat yo‘q", 403);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("JSON noto‘g‘ri", 400);
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Validation xato", 400);
  }

  try {
    const result = await createTask({
      title: parsed.data.title,
      description: parsed.data.description,
      unit: parsed.data.unit,
      assignedEmployeeId: parsed.data.assignedEmployeeId,
      createdByUserId: auth.user.id,
      source: "WEB",
      priority: parsed.data.priority,
      dueAt: parsed.data.dueAt ? new Date(parsed.data.dueAt) : null,
      notifyTelegram: parsed.data.notifyTelegram,
    });
    return ok(result, 201);
  } catch (err) {
    const status = (err as { status?: number }).status ?? 400;
    return fail(err instanceof Error ? err.message : "Xatolik", status);
  }
}
