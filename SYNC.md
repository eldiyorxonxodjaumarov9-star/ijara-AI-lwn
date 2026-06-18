# Bulut sinxronizatsiya (barcha qurilmalarda bir xil ma'lumot)

## Variant 1: Upstash Redis (Vercel — tavsiya)

1. [Vercel Dashboard](https://vercel.com) → loyihangiz → **Storage** → **Redis** (Upstash) qo'shing
2. Environment variables avtomatik qo'shiladi:
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`
3. Redeploy qiling

## Variant 2: Firebase Firestore

Agar Redis bo'lmasa, `.env` ga Firebase o'zgaruvchilarini qo'ying — profil va ma'lumotlar `accountSync` kolleksiyasida saqlanadi.

```
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
```

Firestore qoidalari (demo):
```
match /accountSync/{doc} {
  allow read, write: if true;
}
```

## Qanday ishlaydi

- Admin bir xil email bilan kirganda profil + barcha ma'lumotlar bulutdan yuklanadi
- Sozlamalar, mulklar, shartnomalar o'zgarganda avtomatik saqlanadi
- Boshqa qurilmada login qilsangiz — oxirgi o'zgarishlar ko'rinadi
