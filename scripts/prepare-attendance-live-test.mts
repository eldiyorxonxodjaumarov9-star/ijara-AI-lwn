/** Ensure demo employee + one NEW test task for live group test (local DB only). */
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local"), override: true });
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  if (process.env.DATABASE_URL?.includes("neon.tech")) throw new Error("Refuse Neon");
  const emp = await prisma.employee.findFirst({
    where: { phone: "+998901112233", active: true },
  });
  if (!emp?.workspaceId) throw new Error("Demo employee missing");

  let admin = await prisma.user.findFirst({
    where: { role: "SUPER_ADMIN", isActive: true },
  });
  if (!admin) throw new Error("No SUPER_ADMIN user");

  // Close leftover smoke tasks so UI is clear
  await prisma.workTask.updateMany({
    where: {
      assignedEmployeeId: emp.id,
      title: { startsWith: "Smoke:" },
      status: { in: ["NEW", "IN_PROGRESS", "SUBMITTED"] },
    },
    data: { status: "CANCELLED", cancelledAt: new Date(), cancelReason: "live-test cleanup" },
  });

  const task = await prisma.workTask.create({
    data: {
      workspaceId: emp.workspaceId,
      title: "Live test: guruh davomat vazifasi",
      description: "Faqat localhost live test uchun",
      unit: "LWN",
      assignedEmployeeId: emp.id,
      createdByUserId: admin.id,
      source: "WEB",
      status: "NEW",
      priority: "NORMAL",
    },
  });

  const link = await prisma.attendanceBotLink.findFirst({
    where: { employeeId: emp.id },
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        employee: emp.fullName,
        phone: emp.phone,
        employeeId: emp.id,
        taskId: task.id,
        taskStatus: task.status,
        alreadyLinked: Boolean(link),
        groupIdConfigured: Boolean(process.env.IJARA_ATTENDANCE_GROUP_ID?.trim()),
        groupId: process.env.IJARA_ATTENDANCE_GROUP_ID || null,
      },
      null,
      2
    )
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
