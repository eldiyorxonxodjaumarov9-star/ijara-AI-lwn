# Bulut sinxronizatsiya (telefon + kompyuter bir xil ma'lumot)

Hozir `arendaai.uz` da bulut **ulanmagan** — shuning uchun telefon va kompyuter alohida saqlaydi.

## Variant 1: Neon Postgres (eng oson — tavsiya)

1. [Vercel Dashboard](https://vercel.com) → loyihangiz → **Storage** → **Neon** → **Create**
2. `DATABASE_URL` avtomatik qo'shiladi
3. **Redeploy** qiling (Deployments → ... → Redeploy)
4. Banner yashil bo'ladi: *"Bulut sinxron faol"*

## Variant 2: Upstash Redis

1. Vercel → **Storage** → **Redis** (Upstash)
2. Redeploy

## Variant 3: Vercel Blob

1. Vercel → **Storage** → **Blob**
2. `BLOB_READ_WRITE_TOKEN` avtomatik qo'shiladi
3. Redeploy

## Variant 4: Firebase Firestore

`.env` ga Firebase o'zgaruvchilari:

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

## Tekshirish

- `https://www.arendaai.uz/api/sync/status` → `{"available":true,...}`
- Sozlamalar → **Hozir sinxronlash** tugmasi ishlaydi

## Qanday ishlaydi

- Login qilganda bulutdagi oxirgi ma'lumot yuklanadi
- O'zgarishlar avtomatik bulutga saqlanadi
- Boshqa qurilmada shu email bilan kirsangiz — bir xil ko'rinadi
