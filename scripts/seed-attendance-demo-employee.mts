/** Local-only demo employee for attendance bot testing. */
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  if (process.env.DATABASE_URL?.includes("neon.tech")) {
    throw new Error("Refusing to seed on Neon");
  }
  let ws = await prisma.workspace.findFirst({ where: { isInternal: true } });
  if (!ws) {
    ws = await prisma.workspace.create({
      data: {
        name: "Ijara AI (Internal)",
        slug: "ijara-internal",
        isInternal: true,
        subscription: { create: { status: "ACTIVE", plan: "internal" } },
      },
    });
  }
  const emp = await prisma.employee.upsert({
    where: { phone: "+998901112233" },
    update: {
      active: true,
      fullName: "Davomat Test Xodim",
      workspaceId: ws.id,
    },
    create: {
      fullName: "Davomat Test Xodim",
      phone: "+998901112233",
      position: "Texnik",
      monthlySalary: 0,
      active: true,
      workspaceId: ws.id,
    },
  });
  console.log(
    JSON.stringify({
      workspaceId: ws.id,
      employeeId: emp.id,
      phone: emp.phone,
      name: emp.fullName,
    })
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
