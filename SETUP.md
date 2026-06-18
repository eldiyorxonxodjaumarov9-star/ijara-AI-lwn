# ArendaHub — avtomatik sozlash

## ✅ Men bajarib bo'ldim

1. **To'liq backend API** Vercel ichida (PostgreSQL + JWT)
2. **Vercel env** sozlandi: `NEXT_PUBLIC_API_URL=/api`, JWT secret'lar
3. **Production deploy** — https://www.arendaai.uz yangilandi
4. GitHub'ga push qilindi

## ⚠️ Sizdan 1 ta bosish kerak (30 soniya)

PostgreSQL bazasi uchun Vercel'da Neon shartlarini qabul qiling:

👉 **[Neon qo'shish — shu yerga bosing](https://vercel.com/eldiyorxonxodjaumarov9-5892s-projects/~/integrations/accept-terms/neon?source=cli)**

Keyin menga **"qildim"** deb yozing — men avtomatik bazani yarataman va seed qilaman.

Yoki o'zingiz:
1. Vercel → loyiha → **Storage** → **Neon** → Create
2. Terminalda: `npx vercel integration add neon`
3. Redeploy
4. Baza init: 
```powershell
$secret = "JWT_ACCESS_SECRET_qiymati"
Invoke-RestMethod -Method POST -Uri "https://www.arendaai.uz/api/setup/init" -Headers @{ "x-setup-secret" = $secret }
```

## Kirish (baza tayyor bo'lgach)

- **Email:** `superadmin@arendahub.uz`
- **Parol:** `Admin@12345`

## ahost server (ixtiyoriy)

Agar ahost VPS ishlatmoqchi bo'lsangiz — `AHOST.md` va `DEPLOY.md` ga qarang.
Vercel + Neon bilan ahost shart emas — hammasi bir joyda ishlaydi.
