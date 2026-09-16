export const LANDING_BRAND = "Ijara AI";

export const LANDING_NAV = [
  { href: "/#platforma", label: "Platforma" },
  { href: "/#imkoniyatlar", label: "Imkoniyatlar" },
  { href: "/#ai", label: "AI" },
  { href: "/#kimlar-uchun", label: "Kimlar uchun" },
  { href: "/#biz-haqimizda", label: "Biz haqimizda" },
] as const;

export const PORTAL_NAV = [
  { href: "/", label: "Bosh sahifa", path: "/" },
  { href: "/ijara-qidiruv", label: "Ijara qidiruv", path: "/ijara-qidiruv" },
  { href: "/ijara-egalari", label: "Ijara egalari", path: "/ijara-egalari" },
] as const;

export const TRUST_CATEGORIES = [
  { id: "finance", label: "Moliya" },
  { id: "tenants", label: "Arendatorlar" },
  { id: "staff", label: "Xodimlar" },
  { id: "ai", label: "AI" },
  { id: "lock", label: "Smart Lock" },
  { id: "telegram", label: "Telegram" },
] as const;

export const PROBLEMS = {
  featured: {
    title: "Qarzdorlik kechikkan to‘lovlardan keyin ko‘rinadi",
    text: "Arendator kechiktiradi, eslatma kech qoladi, qarz esa hisobotga tushguncha o‘sib ketadi. Nazorat qo‘lda qolsa, raqamlar kechikadi.",
  },
  secondary: [
    {
      title: "Kirim va chiqim tarqoq",
      text: "To‘lov bir joyda, kommunal boshqa jadvalda, maosh esa chatda. Oylik manzara yig‘ilmaydi.",
    },
    {
      title: "Xarajat nima uchun oshgani noma’lum",
      text: "Elektr, suv yoki ofis xarajati oshganda farqni qo‘lda qidirish kerak. Sabab kech topiladi.",
    },
  ],
  rest: [
    {
      title: "Vazifa beriladi — yakun nazoratsiz",
      text: "Xodimga topshiriq ketadi, bajarilgani, rasm va vaqt esa keyin so‘raladi.",
    },
    {
      title: "Xona holatini isbotlash qiyin",
      text: "Kirish va chiqishdagi holat og‘zaki bahs bo‘lib qoladi. Solishtirish uchun tizimli yozuv yo‘q.",
    },
    {
      title: "PIN va kalit qo‘lda yuritiladi",
      text: "Kim qachon kirgani, PIN qachon yopilishi kerakligi xotirada yoki daftarda qoladi.",
    },
    {
      title: "Hisobot kech va qimmat",
      text: "Oylararo solishtirish uchun jadvallarni yig‘ish kerak. Qaror kechikadi.",
    },
    {
      title: "To‘lov kechiksa zanjir uziladi",
      text: "Eslatma, qarz va keyingi oy hisobi bir-biriga ulanmasa, operatsiya sekinlashadi.",
    },
  ],
} as const;

export const OS_MODULES = [
  {
    id: "property",
    kicker: "A",
    title: "Mulk va xonalar",
    lead: "Obyekt, xona, bandlik, arendator va shartnoma bitta kartochkada turadi.",
    points: [
      "Obyekt va xona tuzilmasi",
      "Band / bo‘sh holat",
      "Arendator bog‘lanishi",
      "Shartnoma muddati",
    ],
  },
  {
    id: "finance",
    kicker: "B",
    title: "To‘lov va moliya",
    lead: "Ijara to‘lovi, qarzdorlik, kirim-chiqim va oylararo farq bitta moliyaviy oqimda.",
    points: [
      "Ijara to‘lovlari",
      "Qarzdorlik nazorati",
      "Kirim va chiqim",
      "Oylik takroriy xarajat",
      "Oylararo solishtirish",
      "Moliyaviy hisobot",
    ],
  },
  {
    id: "team",
    kicker: "C",
    title: "Xodim va vazifalar",
    lead: "Maosh, topshiriq, hisobot va Telegramdagi ish oqimi bir xil statusda yuritiladi.",
    points: [
      "Xodimlar va maosh",
      "Vazifa berish",
      "Bajarildi / bajarilmadi",
      "Izoh, rasm, vaqt",
      "Telegram sinxroni",
    ],
  },
  {
    id: "access",
    kicker: "D",
    title: "Smart Access",
    lead: "TTLock orqali xonaga PIN, muddat, huquq va kirish tarixi bog‘lanadi.",
    points: [
      "Xona bilan qulf bog‘lash",
      "Vaqtli PIN",
      "Huquq berish / bekor qilish",
      "Kirish tarixi",
    ],
  },
] as const;

export const ANALYTICS_INSIGHTS = [
  {
    label: "Avgust xarajatlari",
    value: "+12.8%",
    hint: "Iyulga nisbatan",
  },
  {
    label: "Elektr",
    value: "+300 000",
    hint: "Iyul 1.25 mln → Avgust 1.55 mln (+24%)",
  },
  {
    label: "Ofis jihozlari",
    value: "+11%",
    hint: "Ikkinchi eng katta o‘sish",
  },
] as const;

export const INSPECTION_FINDINGS = [
  { item: "Devor", result: "O‘zgarish yo‘q", tone: "ok" },
  { item: "Mebel", result: "Normal", tone: "ok" },
  { item: "Stol", result: "Tirnalish aniqlandi", tone: "warn" },
  {
    item: "Umumiy holat",
    result: "Qo‘shimcha tekshiruv tavsiya etiladi",
    tone: "review",
  },
] as const;

export const LOCK_STEPS = [
  { title: "Arendator", text: "Shartnoma va xona bilan bog‘lanadi" },
  { title: "Vaqt", text: "Kirish muddati belgilanadi" },
  { title: "PIN / access", text: "Vaqtinchalik kod beriladi" },
  { title: "Xona", text: "Huquq aniq qulfga yoziladi" },
  { title: "Tarix", text: "Kirishlar jurnalda qoladi" },
] as const;

export const AUDIENCE = [
  {
    title: "Ofis ijarasi",
    useCase: "Xona bandligi, to‘lov va kirish huquqini bitta obyekt bo‘yicha yuritish.",
  },
  {
    title: "Coworking",
    useCase: "Qisqa muddatli joylar, takroriy to‘lov va xodim vazifalarini bir ritmda ushlab turish.",
  },
  {
    title: "Kvartira / apart",
    useCase: "Ijarachi, shartnoma, qarz va xona holatini ketma-ket kuzatish.",
  },
  {
    title: "Mehmonxona / hostel",
    useCase: "Xona aylanmasi, xodim topshiriqlari va kirish nazoratini operatsiyaga ulash.",
  },
  {
    title: "Tijorat binolari",
    useCase: "Do‘kon va ofis bloklari bo‘yicha daromad, xarajat va bandlikni solishtirish.",
  },
  {
    title: "Omborlar",
    useCase: "Kam oqimli obyektlarda ham to‘lov, shartnoma va kirishni aniq qoldirish.",
  },
  {
    title: "Property management",
    useCase: "Bir nechta mulkni xodim, vazifa va hisobot bilan markazdan boshqarish.",
  },
  {
    title: "Ko‘p obyektli investorlar",
    useCase: "Oylararo moliya, qarzdorlik va samaradorlikni portfel ko‘rinishida ko‘rish.",
  },
] as const;

export const HOW_STEPS = [
  {
    n: "01",
    title: "Mulk va xonalarni kiriting",
    text: "Obyekt tuzilmasi, xona holati va bandlik asosiy kartotekaga tushadi.",
  },
  {
    n: "02",
    title: "Arendator va shartnomalarni ulang",
    text: "Kim qayerda turishi, muddat va shartnoma bitta yozuvda turadi.",
  },
  {
    n: "03",
    title: "To‘lov va xarajatlarni boshqaring",
    text: "Kirim, qarz, chiqim va oylik takroriy xarajat bir hisobda yig‘iladi.",
  },
  {
    n: "04",
    title: "Xodim va kirishni avtomatlashtiring",
    text: "Vazifa, Telegram va TTLock huquqlari operatsiyaga ulanadi.",
  },
  {
    n: "05",
    title: "AI tahlil va hisobotdan foydalaning",
    text: "Oylararo farq, risk va tavsiya qaror oldidan ko‘rinadi.",
  },
] as const;

export const ABOUT_POINTS = [
  {
    title: "Qo‘lda ish kamayadi",
    text: "To‘lov, vazifa va kirish yozuvlari tarqoq chatdan tizimga o‘tadi.",
  },
  {
    title: "Moliyaviy shaffoflik",
    text: "Kirim, chiqim va qarzdorlik oylar kesimida o‘qiladi.",
  },
  {
    title: "Operatsion nazorat",
    text: "Xona, xodim va topshiriq statusi bir joyda turadi.",
  },
  {
    title: "Mijoz bilan ishlash",
    text: "Shartnoma, to‘lov va eslatma ketma-ket kuzatiladi.",
  },
  {
    title: "Kirish raqamlanadi",
    text: "PIN, muddat va tarix xonaga bog‘lanadi.",
  },
  {
    title: "Qaror tezroq",
    text: "AI farq, sabab va tavsiyani hisobot yoniga qo‘yadi.",
  },
] as const;

export const HUMAN_AI = {
  ai: [
    "Moliyaviy tahlil va oylararo solishtirish",
    "Xarajat o‘sishini summa va foizda ko‘rsatish",
    "Qarzdorlik va risk belgilari",
    "Eslatma va hisobot xulosasi",
    "Xona rasmlarini solishtirish",
    "Qayerni tekshirish kerakligi bo‘yicha tavsiya",
  ],
  human: [
    "Shartnoma bo‘yicha yakuniy qaror",
    "Katta xarajatni tasdiqlash",
    "Zarur bo‘lsa jonli inspeksiya",
    "Nizo va da’vo bo‘yicha qaror",
    "Xavfsizlikka oid kritik qaror",
    "Mijoz bilan muzokara",
  ],
} as const;

export const FOOTER_PRODUCT = [
  { href: "/#platforma", label: "Platforma" },
  { href: "/#ai", label: "AI" },
  { href: "/#smart-access", label: "Smart Access" },
  { href: "/#vazifalar", label: "Vazifalar" },
] as const;

export const FOOTER_COMPANY = [
  { href: "/#biz-haqimizda", label: "Biz haqimizda" },
  { href: "/#kimlar-uchun", label: "Kimlar uchun" },
] as const;

export const FOOTER_ACCESS = [
  { href: "/login", label: "Kirish" },
  { href: "/login", label: "Dashboard" },
] as const;
