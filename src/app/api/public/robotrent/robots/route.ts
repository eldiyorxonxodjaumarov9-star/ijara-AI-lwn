import { listRobotRentRobotModels } from "@/lib/api-server/robotrent/applications";
import { fail, ok } from "@/lib/api-server/http";
import { isDatabaseConfigured } from "@/lib/api-server/prisma";

export async function GET() {
  if (!isDatabaseConfigured()) return fail("Xizmat vaqtincha ishlamaydi", 501);
  const models = await listRobotRentRobotModels(true);
  return ok(
    models.map((m) => ({
      id: m.id,
      slug: m.slug,
      name: m.name,
      description: m.description,
      imageUrl: m.imageUrl,
      highlights: m.highlights,
    }))
  );
}