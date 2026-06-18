# ArendaHub — Serverga joylash (Deploy)

Hammasi bitta server'da Docker bilan ishlaydi: **PostgreSQL + Backend (API) + Frontend (Web) + Nginx**.

## 0. Talablar
- Docker va Docker Compose o'rnatilgan Linux server (VPS).
- (Ixtiyoriy) domen nomi.

## 1. Loyihani serverga ko'chiring
```bash
git clone <repo-url> arendahub   # yoki fayllarni yuklang
cd arendahub
```

## 2. `.env` ni tekshiring
Loyiha ildizidagi `.env` faylida parol va secret'lar avtomatik to'ldirilgan.
Faqat `CORS_ORIGIN` ni serveringiz manziliga moslang:
```env
CORS_ORIGIN=http://SERVER_IP        # yoki https://domeningiz
```

## 3. Ishga tushiring
```bash
docker compose up -d --build
```
Bu barcha xizmatlarni ko'taradi va baza migratsiyalarini avtomatik bajaradi.

## 4. Boshlang'ich ma'lumot (bir marta)
Admin va demo ma'lumotlar uchun:
```bash
docker compose exec api npm run prisma:seed
```

## 5. Ochish
- Sayt: `http://SERVER_IP`
- API hujjati (Swagger): `http://SERVER_IP/api/docs`
- Kirish: `superadmin@arendahub.uz` / `Admin@12345`
  (Kirgach parolni Sozlamalardan o'zgartiring.)

---

## HTTPS (SSL) — domen bo'lsa
1. Sertifikat oling (Let's Encrypt / certbot) va `nginx/certs/` ga `fullchain.pem`, `privkey.pem` joylang.
2. `nginx/nginx.conf` ichidagi `# ===== SSL READY =====` blokini yoqing (izohdan chiqaring) va `server_name` ni domeningizga o'zgartiring.
3. `docker compose restart nginx`

## Foydali buyruqlar
```bash
docker compose ps              # holat
docker compose logs -f api     # backend loglari
docker compose logs -f web     # frontend loglari
docker compose down            # to'xtatish
docker compose up -d --build   # qayta qurish/ishga tushirish
```
