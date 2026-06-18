# ArendaHub — ahost server + arendaai.uz (Vercel)

Hozir **www.arendaai.uz** Vercel'da, lekin **backend ahost serverda** — ulash kerak.

## Muammo (404)

`/api/health` yoki `/api/docs` ochsangiz **404** chiqadi — chunki Vercel'da faqat frontend bor, NestJS backend yo'q.

---

## 1-qadam: ahost serverga backend o'rnatish

SSH orqali ahost serveringizga kiring:

```bash
git clone https://github.com/eldiyorxonxodjaumarov9-star/ijara-AI-lwn.git arendahub
cd arendahub
```

`.env` fayl yarating (ildiz papkada):

```env
POSTGRES_USER=arendahub
POSTGRES_PASSWORD=KuchliParol123!
POSTGRES_DB=arendahub
CORS_ORIGIN=https://www.arendaai.uz,https://arendaai.uz
JWT_ACCESS_SECRET=uzun-xavfsiz-access-kalit
JWT_REFRESH_SECRET=uzun-xavfsiz-refresh-kalit
```

Backend + PostgreSQL ishga tushiring:

```bash
docker compose up -d --build
docker compose exec api npm run prisma:seed
```

Tekshiring (server IP o'rniga o'zingiznikini qo'ying):

```bash
curl http://SERVER_IP:4000/health
# {"status":"ok","service":"arendahub-api",...}
curl http://SERVER_IP/api/docs
# Swagger (80-port nginx orqali)
```

**Firewall:** ahost panelida **4000** va **80** portlar ochiq bo'lsin.

---

## 2-qadam: Vercel'ga backend ulash

1. [vercel.com](https://vercel.com) → loyihangiz (arendaai.uz)
2. **Settings → Environment Variables** qo'shing:

| O'zgaruvchi | Qiymat |
|-------------|--------|
| `NEXT_PUBLIC_API_URL` | `/api` |
| `BACKEND_URL` | `http://SERVER_IP:4000` |

Masalan: `BACKEND_URL=http://185.123.45.67:4000`

3. **Deployments → Redeploy** (Production)

4. Tekshiring: `https://www.arendaai.uz/api/health` → `{"status":"ok",...}`

---

## 3-qadam: Kirish

Backend rejimida demo parol **ishlamaydi**. Seed'dan keyin:

- **Email:** `superadmin@arendahub.uz`
- **Parol:** `Admin@12345`

Kirgach Sozlamalardan parolni o'zgartiring.

---

## Banner holati

| Banner | Ma'nosi |
|--------|---------|
| 🟢 Server rejimi — PostgreSQL | Hammasi to'g'ri, barcha qurilmalarda bir xil |
| 🔴 Server ulanmagan | BACKEND_URL noto'g'ri yoki ahost backend o'chiq |
| 🟡 Demo rejim | NEXT_PUBLIC_API_URL o'rnatilmagan |

---

## Variant B: Hammasi ahost'da (Vercel'siz)

DNS `arendaai.uz` ni ahost server IP ga yo'naltiring, Vercel'ni o'chiring:

```bash
docker compose up -d --build
```

Sayt: `http://SERVER_IP` yoki domen orqali.

---

## Foydali buyruqlar (ahost)

```bash
docker compose ps
docker compose logs -f api
docker compose restart api
docker compose exec api npm run prisma:seed
```

Batafsil: [DEPLOY.md](./DEPLOY.md)
