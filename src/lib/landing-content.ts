import {
  Bot,
  Building2,
  Headphones,
  LayoutDashboard,
  MapPin,
  Megaphone,
  Search,
  Sparkles,
  TrendingUp,
  Users,
  type LucideIcon,
} from "lucide-react";

export const LANDING_FEATURES: {
  id: string;
  icon: LucideIcon;
  title: string;
  description: string;
}[] = [
  {
    id: "ai-qidiruv",
    icon: Search,
    title: "AI Qidiruv",
    description:
      'Foydalanuvchi oddiy tilda yozadi: "Chilonzorda 2 xonali kvartira kerak, budjet 5 million". AI hudud, narx, xona soni va talablarni tushunib, mos e\'lonlarni chiqaradi.',
  },
  {
    id: "ai-broker",
    icon: Sparkles,
    title: "AI Broker",
    description:
      "Mijozga eng mos variantlarni tavsiya qiladi, qidiruvni osonlashtiradi va vaqtni tejaydi.",
  },
  {
    id: "e-lon",
    icon: Megaphone,
    title: "E'lon joylash",
    description:
      "Uy egasi yoki agentlik mulk ma'lumotlarini kiritadi, rasm yuklaydi va e'lonni platformaga joylaydi.",
  },
  {
    id: "narx",
    icon: TrendingUp,
    title: "AI Narx Baholash",
    description:
      "Hudud, xona soni, maydon va mulk turiga qarab taxminiy bozor narxini chiqaradi.",
  },
  {
    id: "telegram",
    icon: Bot,
    title: "Telegram Bot Integratsiyasi",
    description:
      "Foydalanuvchi Telegram orqali e'lon yuborishi, qidiruv qilishi va mijozlar bilan tez aloqa qilishi mumkin.",
  },
  {
    id: "admin",
    icon: LayoutDashboard,
    title: "Admin Dashboard",
    description:
      "Adminlar e'lonlar, foydalanuvchilar, AI so'rovlar, premium e'lonlar, daromad va statistikani boshqaradi.",
  },
  {
    id: "xarita",
    icon: MapPin,
    title: "Xarita orqali qidiruv",
    description:
      "Foydalanuvchi hudud, radius yoki aniq joylashuv bo'yicha ijara obyektlarini topadi.",
  },
  {
    id: "call-center",
    icon: Headphones,
    title: "AI Call Center",
    description:
      "Kelajakda mijoz telefon orqali so'rov qoldiradi, AI operator esa mos variantlarni tavsiya qiladi.",
  },
];

export const LANDING_AUDIENCE: {
  icon: LucideIcon;
  title: string;
  description: string;
}[] = [
  {
    icon: Building2,
    title: "Uy egalari",
    description: "Mulkingizni tez joylashtiring, ijarachilarni boshqaring va daromadni kuzating.",
  },
  {
    icon: Users,
    title: "Ijarachilar",
    description: "AI yordamida o'zingizga mos uy, ofis yoki do'konni tez va oson toping.",
  },
  {
    icon: Sparkles,
    title: "Agentliklar",
    description: "Mijozlar bilan ishlashni avtomatlashtiring, e'lonlar va leadlarni bir joyda boshqaring.",
  },
  {
    icon: Building2,
    title: "Qurilish kompaniyalari",
    description: "Yangi obyektlarni bozorga chiqaring, talab va narx trendlarini AI orqali tahlil qiling.",
  },
  {
    icon: MapPin,
    title: "Noturar joy egalari",
    description: "Do'kon, ombor, ofis va yer maydonlarini samarali ijaraga berish va nazorat qilish.",
  },
];

export const DASHBOARD_CAPABILITIES = [
  "Mulklar va xonalar boshqaruvi",
  "Arendatorlar va shartnomalar",
  "To'lovlar, qarzdorlik va eslatmalar",
  "Telegram bot integratsiyasi",
  "Hisobotlar va statistika",
  "AI agent va tahlil vositalari",
];
