import { NextRequest } from "next/server";
import { z } from "zod";

import { runDemoAnalysis, simulateDemoDelay } from "@/lib/ai/demo";
import { fail, ok } from "@/lib/api-server/http";
import { requireStaffUser } from "@/lib/api-server/rbac";

const bodySchema = z.object({
  instagramUrl: z.string().min(3),
  extraContext: z.string().optional(),
});

/** Demo rejim: Instagram o'qilmaydi, tayyor tahlil qaytariladi */
export async function POST(req: NextRequest) {
  const auth = await requireStaffUser(req);
  if (auth.error) return auth.error;

  try {
    const body = bodySchema.parse(await req.json());
    await simulateDemoDelay();

    const result = runDemoAnalysis(body.instagramUrl, body.extraContext);
    if ("error" in result) {
      return fail(result.error, 400);
    }

    return ok({
      ...result,
      profileFetchNote: "Demo rejim — namuna profil ma'lumotlari ishlatildi.",
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return fail("Ma'lumot noto'g'ri", 400);
    }
    return fail("Tahlil vaqtida xatolik yuz berdi", 500);
  }
}
