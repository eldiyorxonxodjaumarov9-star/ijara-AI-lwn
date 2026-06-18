import { parseInstagramUrl } from "@/lib/ai/instagram";
import type { AnalysisLevel, BusinessAnalysis } from "@/types";

export interface DemoProfile {
  username: string;
  displayName: string;
  bio: string;
  followersHint: string;
  postsHint: string;
  businessType: string;
  rentalFit: AnalysisLevel;
  rentalFitReason: string;
  footTraffic: AnalysisLevel;
  footTrafficReason: string;
  recommendations: string[];
  summary: string;
}

/** Demo uchun tayyor Instagram biznes profillari */
export const DEMO_PROFILES: DemoProfile[] = [
  {
    username: "toshkent_kafe",
    displayName: "Toshkent Kafe",
    bio: "☕ Premium qahva | 🍰 Desertlar | 08:00-23:00 | Yunusobod, Toshkent",
    followersHint: "12.4K",
    postsHint: "340",
    businessType: "Kafe / qahvaxona",
    rentalFit: "high",
    rentalFitReason:
      "Kafe faoliyati uchun doimiy jismoniy joy shart — oshxona, zal va mijozlar uchun kirish kerak.",
    footTraffic: "high",
    footTrafficReason:
      "Qahvaxonalar kunduzi va kechasi yuqori oqimga ega. Ijtimoiy tarmoqdagi faollik mijozlar borligini ko'rsatadi.",
    recommendations: [
      "Birinchi qavatdagi 40-80 m² tijorat maydoni ideal.",
      "Yonida avtoturargoh yoki metro yaqinligi muhim.",
      "Shartnomada kommunal (gaz, elektr) bo'linishini aniq yozing.",
    ],
    summary:
      "Toshkent Kafe — faol qahvaxona biznesi. Arenda uchun yuqori moslik: doimiy joy, yuqori oqim va brend mavjudligi ijaraga mos ob'ekt talab qiladi.",
  },
  {
    username: "style_boutique_uz",
    displayName: "Style Boutique UZ",
    bio: "👗 Ayollar kiyimi | Yangi kolleksiya har hafta | Do'kon: Chilonzor 14",
    followersHint: "8.2K",
    postsHint: "512",
    businessType: "Chakana savdo / boutique",
    rentalFit: "high",
    rentalFitReason:
      "Boutique do'kon sotuv zali va vitrina talab qiladi — ijaraga joy zarur.",
    footTraffic: "high",
    footTrafficReason:
      "Moda do'konlari savdo markazlari va ko'cha oqimiga bog'liq. Instagramda tez-tez yangi kolleksiya — faol savdo belgisi.",
    recommendations: [
      "Savdo markazi yoki markaziy ko'chadagi 25-50 m² do'kon mos.",
      "Vitrina va kirish ko'rinishi shartnoma shartlariga qo'shilsin.",
      "Mijoz oqimi past bo'lsa, ijarani qisqartirish bandi qo'yish mumkin.",
    ],
    summary:
      "Style Boutique UZ — chakana savdo. Arenda mosligi yuqori, mijoz oqimi ham yaxshi. Markaziy joy tavsiya etiladi.",
  },
  {
    username: "digital_coach_uz",
    displayName: "Digital Coach UZ",
    bio: "📱 Onlayn kurslar | SMM o'rgataman | Telegram: @coach | Butun O'zbekiston",
    followersHint: "45K",
    postsHint: "890",
    businessType: "Onlayn biznes / kurslar",
    rentalFit: "low",
    rentalFitReason:
      "Asosiy faoliyat onlayn — katta savdo zali yoki do'kon kerak emas. Ofis/studiya ixtiyoriy.",
    footTraffic: "low",
    footTrafficReason:
      "Mijozlar ofisga kelmaydi, onlayn xizmat ko'rsatiladi. Jismoniy oqim past.",
    recommendations: [
      "Kichik ofis (15-25 m²) yoki uyda ishlash yetarli bo'lishi mumkin.",
      "Yirik tijorat maydoni tavsiya etilmaydi.",
      "Agar studiya kerak bo'lsa, qisqa muddatli ijarani ko'rib chiqing.",
    ],
    summary:
      "Digital Coach UZ — onlayn biznes. Arenda ehtiyoji past, mijoz oqimi ofisga emas, internetga bog'liq.",
  },
  {
    username: "umarxonmedia_studio",
    displayName: "UmarxonMedia Studio",
    bio: "🎬 Video prodakshn | Reklama | Studio ijarasi | Toshkent",
    followersHint: "5.1K",
    postsHint: "156",
    businessType: "Media / video studiya",
    rentalFit: "medium",
    rentalFitReason:
      "Studiya va ofis kerak, lekin ochiq savdo zali shart emas — o'rtacha maydon yetadi.",
    footTraffic: "medium",
    footTrafficReason:
      "Mijozlar kelishadi, lekin ommaviy oqim emas — oldindan yozilgan uchrashuvlar asosida.",
    recommendations: [
      "60-120 m² studiya/ofis kombinatsiyasi mos.",
      "Shovqin izolyatsiyasi va yuqori shift talab qilinishi mumkin.",
      "Uzoq muddatli shartnoma (12+ oy) barqarorlik uchun yaxshi.",
    ],
    summary:
      "UmarxonMedia Studio — media biznes. Arenda mosligi o'rtacha: studiya formatidagi ob'ekt kerak, ommaviy oqim shart emas.",
  },
];

export const DEMO_QUICK_PICKS = DEMO_PROFILES.map((p) => ({
  username: p.username,
  label: p.displayName,
}));

function hashUsername(username: string): number {
  let h = 0;
  for (let i = 0; i < username.length; i++) {
    h = (h << 5) - h + username.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

function buildGenericDemo(username: string, extraContext?: string): DemoProfile {
  const text = `${username} ${extraContext ?? ""}`.toLowerCase();
  const corpus = text;

  const isCafe = /kafe|cafe|coffee|qahva|restoran|taom/.test(corpus);
  const isShop = /shop|do'kon|dokon|boutique|store|market/.test(corpus);
  const isOnline = /online|onlayn|coach|kurs|digital|blogger|freelance/.test(corpus);
  const isSalon = /salon|barber|beauty|go'zallik|spa/.test(corpus);

  if (isCafe) return { ...DEMO_PROFILES[0], username, displayName: username.replace(/_/g, " ") };
  if (isShop) return { ...DEMO_PROFILES[1], username, displayName: username.replace(/_/g, " ") };
  if (isOnline) return { ...DEMO_PROFILES[2], username, displayName: username.replace(/_/g, " ") };
  if (isSalon) {
    return {
      username,
      displayName: username.replace(/_/g, " "),
      bio: "💈 Sartaroshxona | ✂️ Soch olish | 📍 Toshkent",
      followersHint: "3.2K",
      postsHint: "210",
      businessType: "Go'zallik / sartaroshxona",
      rentalFit: "high",
      rentalFitReason: "Salon xizmati uchun doimiy joy va mijoz qabul qilish zali kerak.",
      footTraffic: "medium",
      footTrafficReason: "Mahalliy mijozlar muntazam keladi, lekin restoran darajasida emas.",
      recommendations: [
        "20-40 m² tijorat maydoni yetarli.",
        "Yuqori ko'rinishli kirish va yorug'lik muhim.",
      ],
      summary: `${username} — xizmat ko'rsatish biznesi. Arenda kerak, oqim o'rtacha.`,
    };
  }

  const h = hashUsername(username);
  const templates = DEMO_PROFILES;
  const picked = templates[h % templates.length];
  return {
    ...picked,
    username,
    displayName: picked.displayName.includes(username)
      ? picked.displayName
      : username.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    summary: `${username} profili demo tahlil asosida baholandi. ${picked.summary}`,
  };
}

export type DemoAnalysisResult = Omit<BusinessAnalysis, "id" | "createdAt">;

export function runDemoAnalysis(
  instagramUrl: string,
  extraContext?: string
): DemoAnalysisResult | { error: string } {
  const username = parseInstagramUrl(instagramUrl);
  if (!username) {
    return { error: "Noto'g'ri Instagram havolasi. Masalan: instagram.com/username" };
  }

  const known = DEMO_PROFILES.find((p) => p.username === username);
  const profile = known ?? buildGenericDemo(username, extraContext);

  const bio = extraContext?.trim()
    ? `${profile.bio}\n\n[Qo'shimcha]: ${extraContext.trim()}`
    : profile.bio;

  return {
    instagramUrl: `https://www.instagram.com/${username}/`,
    username,
    businessName: profile.displayName,
    businessType: profile.businessType,
    summary: profile.summary,
    rentalFit: profile.rentalFit,
    rentalFitReason: profile.rentalFitReason,
    footTraffic: profile.footTraffic,
    footTrafficReason: profile.footTrafficReason,
    recommendations: profile.recommendations,
    confidence: known ? 0.92 : 0.78,
    source: "demo",
    rawBio: `${bio} · ${profile.followersHint} followers · ${profile.postsHint} posts`,
  };
}

/** Demo tahlil jarayonini simulyatsiya qilish (1.5-2.5 s) */
export function simulateDemoDelay() {
  const ms = 1500 + Math.random() * 1000;
  return new Promise((resolve) => setTimeout(resolve, ms));
}
