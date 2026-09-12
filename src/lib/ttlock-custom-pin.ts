/**
 * Maxsus TTLock PIN validatsiyasi — client va server uchun xavfsiz (sof).
 * Rasmiy: /v3/keyboardPwd/add — 4–9 raqam.
 * @see https://euopen.ttlock.com/documentPages/htmlPages/cloud/passcode/addEn.html
 */

export const CUSTOM_PIN_MIN_LEN = 4;
export const CUSTOM_PIN_MAX_LEN = 9;

export function validateCustomKeyboardPin(
  raw: string | null | undefined
): { ok: true; pin: string } | { ok: false; message: string } {
  const pin = String(raw ?? "").trim();
  if (!pin) {
    return { ok: false, message: "PIN-kodni kiriting." };
  }
  if (!/^\d+$/.test(pin)) {
    return { ok: false, message: "PIN faqat raqamlardan iborat bo‘lishi kerak." };
  }
  if (pin.length < CUSTOM_PIN_MIN_LEN || pin.length > CUSTOM_PIN_MAX_LEN) {
    return {
      ok: false,
      message: `PIN uzunligi ${CUSTOM_PIN_MIN_LEN}–${CUSTOM_PIN_MAX_LEN} raqam bo‘lishi kerak.`,
    };
  }
  return { ok: true, pin };
}

export const CUSTOM_PIN_GATEWAY_REQUIRED_MESSAGE =
  "Maxsus PIN-ni saytdan qulfga o‘rnatish uchun Gateway yoki Wi‑Fi qulf kerak. Hozir gateway yo‘q. Reja saqlanishi mumkin; PIN-ni TTLock ilovasida qulf yonida (Bluetooth) o‘rnating yoki gateway ulang.";

export const CUSTOM_PIN_CLOUD_ACCEPTED_MESSAGE =
  "PIN TTLock API tomonidan qabul qilindi (gateway/Wi‑Fi orqali yozish). Qurilmada ishlashini qulf yonida tekshiring — tasdiqlanmaguncha «Faol» deb belgilamaymiz.";

export const CUSTOM_PIN_PLAN_ONLY_MESSAGE =
  "PIN reja sifatida saqlandi. Qurilmaga o‘rnatilmadi.";

export const CUSTOM_PIN_REVOKE_GATEWAY_MESSAGE =
  "Parolni qulfdan o‘chirish uchun Gateway yoki Wi‑Fi qulf kerak. Hozir gateway yo‘q — TTLock ilovasida qulf yonida (Bluetooth) o‘chiring yoki gateway ulang. Saytdagi reja bekor holatiga o‘tkazilmadi.";
