# ArendaHub 🏢

Ko'chmas mulk ijarasini boshqarish uchun zamonaviy, professional **SaaS dashboard** platformasi. Minimalist oq + yashil dizayn, dark mode, real-time ma'lumotlar va to'liq CRUD funksiyalari bilan.

![Next.js](https://img.shields.io/badge/Next.js-16-black) ![TypeScript](https://img.shields.io/badge/TypeScript-5-blue) ![Tailwind](https://img.shields.io/badge/TailwindCSS-4-38bdf8) ![Firebase](https://img.shields.io/badge/Firebase-12-orange)

## ✨ Imkoniyatlar

- **Dashboard** — statistik kartalar, daromad/xarajat grafigi, mulklar holati, so'nggi to'lovlar, ogohlantirishlar
- **Aktivlar (Properties)** — to'liq CRUD, rasm yuklash, status boshqaruvi, filter va qidiruv
- **Arendatorlar (Tenants)** — ijarachilar bazasi, Telegram/passport/aloqa ma'lumotlari
- **Shartnomalar** — mulk + arendator bog'lash, **PDF generatsiya**, elektron imzo maydoni
- **To'lovlar** — naqd/karta/bank, avtomatik summa to'ldirish
- **Qarzdorliklar** — kechikkan to'lovlarni **avtomatik hisoblash**, qizil ogohlantirish
- **Xarajatlar** — kategoriyalar, chek rasmi
- **Ta'mirlash** — muammo, holat, xarajat, rasmlar
- **Xabarlar** — notification markazi + **Telegram integratsiya moduli**
- **Hisobotlar** — oylik/yillik, **PDF va Excel eksport**
- **Sozlamalar** — profil, kompaniya, til (UZ/RU/EN), Dark Mode

### Texnik xususiyatlar
- 🔐 Firebase Authentication (login / register / parolni tiklash)
- 👥 Rollar tizimi: **Admin / Manager / Employee** (himoyalangan route'lar)
- 🔥 Firestore real-time yangilanishlar
- 📦 Firebase Storage rasm yuklash
- 🎨 Shadcn/ui uslubidagi qayta ishlatiluvchi komponentlar
- 📱 To'liq responsive (Desktop + Mobile)
- ⚡ Loading skeletonlar, toast bildirishnomalar, Framer Motion animatsiyalar
- 🔍 Search, Filter, Pagination
- 🧩 Clean Architecture (modulli struktura)

## 🛠 Texnologiyalar

| Qatlam | Texnologiya |
|--------|-------------|
| Framework | Next.js 16 (App Router) |
| Til | TypeScript |
| Styling | Tailwind CSS v4 |
| UI | Shadcn/ui (Radix) + lucide-react |
| Auth/DB/Storage | Firebase |
| Grafiklar | Recharts |
| Formalar | React Hook Form + Zod |
| Animatsiya | Framer Motion |
| Eksport | jsPDF, SheetJS (xlsx) |
| Toast | Sonner |

## 🚀 Ishga tushirish

```bash
# 1. Bog'liqliklarni o'rnatish
npm install

# 2. (Ixtiyoriy) Firebase sozlash — .env.example dan nusxa oling
cp .env.example .env.local
# .env.local ni Firebase qiymatlari bilan to'ldiring

# 3. Dev server
npm run dev
```

Brauzerda: [http://localhost:3000](http://localhost:3000)

### 🧪 Demo rejim
Agar `.env.local` to'ldirilmagan bo'lsa, ilova **demo rejimda** ishlaydi — barcha ma'lumotlar brauzer `localStorage` da saqlanadi va namuna (seed) ma'lumotlar avtomatik yuklanadi.

**Demo kirish:**
- Email: `admin@arendahub.uz`
- Parol: `123456`

## 🔥 Firebase sozlash

1. [Firebase Console](https://console.firebase.google.com) da loyiha yarating
2. **Authentication** > Email/Password ni yoqing
3. **Firestore Database** ni yarating
4. **Storage** ni yoqing
5. Web App qo'shing va konfiguratsiyani `.env.local` ga ko'chiring
6. Security Rules ni joylang:
   ```bash
   # Firestore
   firestore.rules faylidagi qoidalarni Console > Firestore > Rules ga joylang
   # Storage
   storage.rules faylidagi qoidalarni Console > Storage > Rules ga joylang
   ```

### Firestore kolleksiyalari
```
users          # foydalanuvchilar va rollar
properties     # mulklar
tenants        # arendatorlar
contracts      # shartnomalar
payments       # to'lovlar
expenses       # xarajatlar
maintenance    # ta'mirlash
notifications  # bildirishnomalar
```

## 📁 Folder strukturasi

```
src/
├── app/
│   ├── (auth)/              # login, register, forgot-password
│   ├── (dashboard)/         # himoyalangan asosiy sahifalar
│   │   ├── dashboard/
│   │   ├── properties/
│   │   ├── tenants/
│   │   ├── contracts/
│   │   ├── payments/
│   │   ├── debts/
│   │   ├── expenses/
│   │   ├── maintenance/
│   │   ├── notifications/
│   │   ├── reports/
│   │   └── settings/
│   ├── layout.tsx
│   └── globals.css
├── components/
│   ├── ui/                  # shadcn primitivlari
│   ├── shared/              # PageHeader, StatCard, EmptyState ...
│   ├── layout/              # Sidebar, Header
│   ├── charts/              # Recharts wrapperlari
│   ├── auth/                # ProtectedRoute
│   └── <module>/            # har modul uchun dialog formalari
├── context/                 # AuthContext
├── hooks/                   # useCollection, useTableData
├── lib/
│   ├── firebase/            # config, storage
│   ├── data/                # store (Firestore/local), seed
│   ├── analytics.ts         # metrikalar va qarzdorlik hisobi
│   ├── validations.ts       # Zod schemalar
│   ├── export.ts            # PDF/Excel eksport
│   ├── pdf.ts               # shartnoma PDF
│   └── constants.ts
├── config/                  # navigatsiya
└── types/                   # TypeScript tiplar
```

## 📜 Skriptlar

```bash
npm run dev     # development server
npm run build   # production build
npm run start   # production server
npm run lint    # eslint
```

## 📄 Litsenziya

Ushbu loyiha namuna sifatida yaratilgan. Erkin foydalanishingiz mumkin.

---

ArendaHub bilan ko'chmas mulk biznesingizni bir joydan boshqaring. 🚀
