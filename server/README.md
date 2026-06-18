# ArendaHub API (Backend)

Enterprise Property Management SaaS backend — **NestJS + Prisma + PostgreSQL + JWT + Swagger**.

## Texnologiyalar
NestJS 11 · TypeScript · Prisma ORM · PostgreSQL · JWT (access + refresh) · Bcrypt · Swagger · Multer · Helmet · Throttler (rate limit) · Audit logs.

## Arxitektura
- Clean Architecture + Modular structure
- Repository/Service layer (Prisma orqali)
- Global guards: `JwtAuthGuard` + `RolesGuard`
- Global filter, transform interceptor, audit interceptor

## Rollar
`SUPER_ADMIN` · `ADMIN` · `MANAGER` · `EMPLOYEE`

---

## 🚀 Ishga tushirish (2 ta variant)

### Variant A — Docker (eng oson, tavsiya etiladi)
Loyiha root papkasida (`docker-compose.yml` joylashgan joyda):

```bash
docker compose up -d --build
```

Bu PostgreSQL + API + Nginx ni ko'taradi. Migratsiya avtomatik ishlaydi.
- API: `http://localhost:4000/api`
- Swagger: `http://localhost:4000/api/docs`
- Nginx orqali: `http://localhost/api`

Seed (demo data + super admin) qo'shish:
```bash
docker compose exec api npx prisma db seed
```

### Variant B — Lokal (Node + PostgreSQL o'rnatilgan bo'lsa)

```bash
cd server

# 1. Bog'liqliklar
npm install

# 2. .env yaratish
copy .env.example .env        # Windows
# yoki: cp .env.example .env   (Linux/Mac)
# .env dagi DATABASE_URL ni o'z PostgreSQL ga moslang

# 3. Prisma client + migratsiya
npm run prisma:generate
npm run prisma:migrate

# 4. Demo ma'lumotlar
npm run prisma:seed

# 5. Serverni ishga tushirish
npm run start:dev
```

API: `http://localhost:4000/api` · Swagger: `http://localhost:4000/api/docs`

---

## 🔑 Demo kirish (seed dan keyin)
| Rol | Email | Parol |
|-----|-------|-------|
| Super Admin | superadmin@arendahub.uz | Admin@12345 |
| Manager | manager@arendahub.uz | Manager@123 |

---

## 📡 Asosiy endpointlar
| Metod | Yo'l | Tavsif |
|-------|------|--------|
| POST | `/api/auth/register` | Ro'yxatdan o'tish |
| POST | `/api/auth/login` | Kirish (access+refresh token) |
| POST | `/api/auth/refresh` | Tokenni yangilash |
| POST | `/api/auth/forgot-password` | Parol tiklash |
| POST | `/api/auth/change-password` | Parol o'zgartirish |
| GET | `/api/dashboard/stats` | Statistika |
| CRUD | `/api/properties` | Mulklar |
| CRUD | `/api/tenants` | Arendatorlar |
| CRUD | `/api/contracts` | Shartnomalar |
| CRUD | `/api/payments` | To'lovlar |
| CRUD | `/api/expenses` | Xarajatlar |
| CRUD | `/api/maintenance` | Ta'mirlash |
| GET | `/api/notifications/stream` | Real-time (SSE) |
| GET | `/api/reports/export/pdf` | PDF eksport |
| GET | `/api/reports/export/excel` | Excel eksport |
| POST | `/api/uploads` | Rasm yuklash |

Barcha himoyalangan endpointlar `Authorization: Bearer <accessToken>` talab qiladi.

---

## 🐘 PostgreSQL kerak
Agar lokal Postgres bo'lmasa, faqat bazani Docker'da ko'tarish mumkin:
```bash
docker run --name arendahub-pg -e POSTGRES_USER=arendahub -e POSTGRES_PASSWORD=arendahub -e POSTGRES_DB=arendahub -p 5432:5432 -d postgres:16-alpine
```

## 🚢 Deployment
- `Dockerfile` (multi-stage, production)
- `docker-compose.yml` (Postgres + API + Nginx)
- `nginx/nginx.conf` (reverse proxy, SSL-ready blok)
- `ecosystem.config.js` (PM2 cluster mode)
