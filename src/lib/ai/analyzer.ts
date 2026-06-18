import type { AnalysisLevel, BusinessAnalysis } from "@/types";
import type { InstagramProfileData } from "@/lib/ai/instagram";

export interface AnalyzeInput {
  profile: InstagramProfileData;
  extraContext?: string;
}

const RENTAL_HIGH = [
  "restoran",
  "restaurant",
  "kafe",
  "cafe",
  "coffee",
  "do'kon",
  "dokon",
  "shop",
  "store",
  "salon",
  "barber",
  "gym",
  "fitness",
  "clinic",
  "stomat",
  "pharmacy",
  "darmon",
  "bakery",
  "non",
  "market",
  "showroom",
  "studio",
  "spa",
];
const RENTAL_LOW = [
  "online",
  "onlayn",
  "freelance",
  "blogger",
  "influencer",
  "coach",
  "kurs",
  "course",
  "digital",
  "crypto",
  "delivery only",
];
const TRAFFIC_HIGH = [
  "restoran",
  "kafe",
  "cafe",
  "fast food",
  "shop",
  "do'kon",
  "market",
  "mall",
  "24/7",
  "poputka emas",
  "trend",
];

function levelFromScore(score: number): AnalysisLevel {
  if (score >= 0.65) return "high";
  if (score >= 0.4) return "medium";
  if (score > 0) return "low";
  return "unknown";
}

function keywordScore(text: string, keywords: string[]) {
  const lower = text.toLowerCase();
  let hits = 0;
  for (const kw of keywords) {
    if (lower.includes(kw)) hits++;
  }
  return Math.min(1, hits / 2);
}

function detectBusinessType(text: string): string {
  const pairs: [string[], string][] = [
    [["restoran", "restaurant", "taom"], "Restoran / oziq-ovqat"],
    [["kafe", "cafe", "coffee"], "Kafe / qahvaxona"],
    [["do'kon", "dokon", "shop", "store", "boutique"], "Chakana savdo / do'kon"],
    [["salon", "barber", "beauty", "go'zallik"], "Go'zallik / xizmat salon"],
    [["gym", "fitness", "sport"], "Sport / fitnes"],
    [["clinic", "stomat", "med", "darmon"], "Tibbiyot / klinika"],
    [["online", "onlayn", "digital"], "Onlayn biznes"],
    [["studio", "media", "photo", "video"], "Media / studiya"],
  ];
  const lower = text.toLowerCase();
  for (const [keys, label] of pairs) {
    if (keys.some((k) => lower.includes(k))) return label;
  }
  return "Noma'lum biznes turi";
}

export function analyzeWithHeuristics(input: AnalyzeInput): Omit<
  BusinessAnalysis,
  "id" | "createdAt" | "instagramUrl" | "username"
> {
  const corpus = [
    input.profile.displayName ?? "",
    input.profile.bio ?? "",
    input.extraContext ?? "",
  ].join(" ");

  const rentalScore =
    keywordScore(corpus, RENTAL_HIGH) - keywordScore(corpus, RENTAL_LOW) * 0.5;
  const trafficScore = keywordScore(corpus, TRAFFIC_HIGH);

  const rentalFit = levelFromScore(Math.max(0, rentalScore));
  const footTraffic = levelFromScore(trafficScore);

  const businessType = detectBusinessType(corpus);
  const name = input.profile.displayName ?? input.profile.username;

  const rentalFitReason =
    rentalFit === "high"
      ? "Biznes turi odatda jismoniy joy (arenda) talab qiladi — do'kon, kafe, salon va h.k."
      : rentalFit === "medium"
        ? "Arenda kerak bo'lishi mumkin, lekin qo'shimcha tekshiruv tavsiya etiladi."
        : rentalFit === "low"
          ? "Onlayn yoki kam joy talab qiladigan faoliyatga o'xshaydi."
          : "Profil ma'lumoti yetarli emas — qo'shimcha kontekst kiriting.";

  const footTrafficReason =
    footTraffic === "high"
      ? "Oziq-ovqat, chakana savdo yoki xizmat ko'rsatish — odatda ko'p mijoz oqimi bo'ladi."
      : footTraffic === "medium"
        ? "Mijoz oqimi o'rtacha bo'lishi mumkin."
        : footTraffic === "low"
          ? "Kam oqimli yoki onlayn modelga o'xshaydi."
          : "Oqimni aniqlash uchun ko'proq ma'lumot kerak.";

  const recommendations: string[] = [];
  if (rentalFit === "high") {
    recommendations.push("Tijorat maydoni yoki birinchi qavat do'koni mos kelishi mumkin.");
    recommendations.push("Shartnomada oylik ijara + kommunal xarajatlarni aniq yozing.");
  } else if (rentalFit === "medium") {
    recommendations.push("Ofis yoki kichik studiya formatini ko'rib chiqing.");
  } else {
    recommendations.push("Avval biznes modelini aniqlang — ofis yoki ombor yetarli bo'lishi mumkin.");
  }
  if (footTraffic === "high") {
    recommendations.push("Markaziy ko'cha yoki savdo markazidagi ob'ekt tavsiya etiladi.");
  }
  if (!input.profile.bio && !input.extraContext) {
    recommendations.push(
      "Instagram bio yoki postlar matnini qo'shimcha maydonga qo'shing — aniqlik oshadi."
    );
  }

  return {
    businessName: name,
    businessType,
    summary: `${name} (@${input.profile.username}) — ${businessType}. ${rentalFitReason} ${footTrafficReason}`,
    rentalFit,
    rentalFitReason,
    footTraffic,
    footTrafficReason,
    recommendations,
    confidence: input.profile.bio || input.extraContext ? 0.55 : 0.3,
    source: "heuristic",
    rawBio: input.profile.bio,
  };
}

async function analyzeWithOpenAI(
  input: AnalyzeInput
): Promise<Omit<BusinessAnalysis, "id" | "createdAt" | "instagramUrl" | "username"> | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const prompt = `Sen ko'chmas mulk ijarasi (arenda) bo'yicha biznes tahlilchisisan.
Instagram profili ma'lumotlari:
- Username: @${input.profile.username}
- Nomi: ${input.profile.displayName ?? "noma'lum"}
- Bio: ${input.profile.bio ?? "yo'q"}
- Followers: ${input.profile.followersHint ?? "noma'lum"}
- Posts: ${input.profile.postsHint ?? "noma'lum"}
- Qo'shimcha: ${input.extraContext ?? "yo'q"}

Vazifa: bu biznes uchun ijaraga joy kerakmi, ko'p mijoz keladimi, qanday mulk mos.
FAQAT JSON qaytaring (boshqa matn yo'q):
{
  "businessName": "string",
  "businessType": "string",
  "summary": "string (o'zbekcha, 2-3 gap)",
  "rentalFit": "high|medium|low|unknown",
  "rentalFitReason": "string",
  "footTraffic": "high|medium|low|unknown",
  "footTrafficReason": "string",
  "recommendations": ["string", "string"],
  "confidence": 0.0-1.0
}`;

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
        messages: [
          { role: "system", content: "You are a real estate rental analyst. Reply only valid JSON." },
          { role: "user", content: prompt },
        ],
        temperature: 0.3,
        response_format: { type: "json_object" },
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) return null;
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = data.choices?.[0]?.message?.content;
    if (!content) return null;

    const parsed = JSON.parse(content) as Record<string, unknown>;
    const level = (v: unknown): AnalysisLevel =>
      ["high", "medium", "low", "unknown"].includes(String(v))
        ? (String(v) as AnalysisLevel)
        : "unknown";

    return {
      businessName: String(parsed.businessName ?? input.profile.displayName ?? ""),
      businessType: String(parsed.businessType ?? "Noma'lum"),
      summary: String(parsed.summary ?? ""),
      rentalFit: level(parsed.rentalFit),
      rentalFitReason: String(parsed.rentalFitReason ?? ""),
      footTraffic: level(parsed.footTraffic),
      footTrafficReason: String(parsed.footTrafficReason ?? ""),
      recommendations: Array.isArray(parsed.recommendations)
        ? parsed.recommendations.map(String)
        : [],
      confidence: Math.min(1, Math.max(0, Number(parsed.confidence) || 0.7)),
      source: "ai",
      rawBio: input.profile.bio,
    };
  } catch {
    return null;
  }
}

export async function analyzeBusiness(input: AnalyzeInput) {
  const ai = await analyzeWithOpenAI(input);
  if (ai) return ai;
  return analyzeWithHeuristics(input);
}
