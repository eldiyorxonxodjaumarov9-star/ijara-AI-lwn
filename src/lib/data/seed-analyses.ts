import type { BusinessAnalysis } from "@/types";

const now = new Date();
const iso = (daysAgo: number) =>
  new Date(now.getTime() - daysAgo * 86400000).toISOString();

export const seedAnalyses: BusinessAnalysis[] = [
  {
    id: "demo-a1",
    instagramUrl: "https://www.instagram.com/toshkent_kafe/",
    username: "toshkent_kafe",
    businessName: "Toshkent Kafe",
    businessType: "Kafe / qahvaxona",
    summary:
      "Toshkent Kafe — faol qahvaxona biznesi. Arenda uchun yuqori moslik: doimiy joy, yuqori oqim va brend mavjudligi ijaraga mos ob'ekt talab qiladi.",
    rentalFit: "high",
    rentalFitReason:
      "Kafe faoliyati uchun doimiy jismoniy joy shart — oshxona, zal va mijozlar uchun kirish kerak.",
    footTraffic: "high",
    footTrafficReason:
      "Qahvaxonalar kunduzi va kechasi yuqori oqimga ega. Ijtimoiy tarmoqdagi faollik mijozlar borligini ko'rsatadi.",
    recommendations: [
      "Birinchi qavatdagi 40-80 m² tijorat maydoni ideal.",
      "Yonida avtoturargoh yoki metro yaqinligi muhim.",
    ],
    confidence: 0.92,
    source: "demo",
    rawBio: "☕ Premium qahva | 🍰 Desertlar | 08:00-23:00 · 12.4K followers · 340 posts",
    createdAt: iso(3),
  },
  {
    id: "demo-a2",
    instagramUrl: "https://www.instagram.com/digital_coach_uz/",
    username: "digital_coach_uz",
    businessName: "Digital Coach UZ",
    businessType: "Onlayn biznes / kurslar",
    summary:
      "Digital Coach UZ — onlayn biznes. Arenda ehtiyoji past, mijoz oqimi ofisga emas, internetga bog'liq.",
    rentalFit: "low",
    rentalFitReason:
      "Asosiy faoliyat onlayn — katta savdo zali yoki do'kon kerak emas.",
    footTraffic: "low",
    footTrafficReason: "Mijozlar ofisga kelmaydi, onlayn xizmat ko'rsatiladi.",
    recommendations: [
      "Kichik ofis (15-25 m²) yetarli bo'lishi mumkin.",
      "Yirik tijorat maydoni tavsiya etilmaydi.",
    ],
    confidence: 0.92,
    source: "demo",
    rawBio: "📱 Onlayn kurslar | SMM · 45K followers · 890 posts",
    createdAt: iso(1),
  },
];
