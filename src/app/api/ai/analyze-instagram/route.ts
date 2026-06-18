import { NextResponse } from "next/server";
import { z } from "zod";

import { runDemoAnalysis, simulateDemoDelay } from "@/lib/ai/demo";

const bodySchema = z.object({
  instagramUrl: z.string().min(3),
  extraContext: z.string().optional(),
});

/** Demo rejim: Instagram o'qilmaydi, tayyor tahlil qaytariladi */
export async function POST(req: Request) {
  try {
    const body = bodySchema.parse(await req.json());
    await simulateDemoDelay();

    const result = runDemoAnalysis(body.instagramUrl, body.extraContext);
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      ...result,
      profileFetchNote: "Demo rejim — namuna profil ma'lumotlari ishlatildi.",
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Ma'lumot noto'g'ri" }, { status: 400 });
    }
    return NextResponse.json(
      { error: "Tahlil vaqtida xatolik yuz berdi" },
      { status: 500 }
    );
  }
}
