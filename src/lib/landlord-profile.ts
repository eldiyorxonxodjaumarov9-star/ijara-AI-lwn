import {
  createPendingLandlordAccess,
  deleteLandlordAccess,
  isLandlordAccessGranted,
  renameLandlordAccess,
} from "@/lib/landlord-access";

export const PROPERTY_TYPES = [
  "Kvartira / uy",
  "Ofis",
  "Do'kon",
  "Ombor",
  "Yer maydoni",
  "Noturar joy",
  "Boshqa",
] as const;

export type LandlordProfileForm = {
  login: string;
  password: string;
  fullName: string;
  phone: string;
  email: string;
  company: string;
  city: string;
  propertyType: string;
  propertyCount: string;
  about: string;
};

export type LandlordProfile = {
  login: string;
  password: string;
  fullName: string;
  phone: string;
  email: string;
  company?: string;
  city: string;
  propertyType: string;
  propertyCount: number;
  about?: string;
  createdAt: string;
  updatedAt: string;
};

const ACCOUNTS_KEY = "arenda:landlord-accounts";
const SESSION_KEY = "arenda:landlord-session";
const LEGACY_KEY = "arenda:landlord-profile";

type LandlordAccountStore = Record<string, LandlordProfile>;

function normalizeLogin(login: string) {
  return login.trim().toLowerCase();
}

function getAccounts(): LandlordAccountStore {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(ACCOUNTS_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as LandlordAccountStore;
  } catch {
    return {};
  }
}

function saveAccounts(accounts: LandlordAccountStore) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
}

function getSessionLogin(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { login?: string };
    return parsed.login ? normalizeLogin(parsed.login) : null;
  } catch {
    return null;
  }
}

function setSession(login: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    SESSION_KEY,
    JSON.stringify({ login: normalizeLogin(login) })
  );
}

export function normalizeLandlordForm(
  data: Partial<LandlordProfileForm> | Partial<LandlordProfile> = {}
): LandlordProfileForm {
  return {
    login: data.login ?? "",
    password: data.password ?? "",
    fullName: data.fullName ?? "",
    phone: data.phone ?? "",
    email: data.email ?? "",
    company: data.company ?? "",
    city: data.city ?? "Toshkent",
    propertyType: data.propertyType ?? PROPERTY_TYPES[0],
    propertyCount:
      data.propertyCount !== undefined
        ? String(data.propertyCount)
        : "1",
    about: data.about ?? "",
  };
}

function toProfile(
  form: LandlordProfileForm,
  existing?: LandlordProfile
): LandlordProfile {
  const now = new Date().toISOString();
  return {
    login: normalizeLogin(form.login),
    password: form.password || existing?.password || "",
    fullName: form.fullName.trim(),
    phone: form.phone.trim(),
    email: form.email.trim(),
    company: form.company.trim() || undefined,
    city: form.city.trim() || "Toshkent",
    propertyType: form.propertyType,
    propertyCount: Math.max(1, Number(form.propertyCount) || 1),
    about: form.about.trim() || undefined,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
}

function migrateLegacyProfile() {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(LEGACY_KEY);
    if (!raw) return;
    const legacy = JSON.parse(raw) as LandlordProfile & {
      login?: string;
      password?: string;
    };
    const login = normalizeLogin(
      legacy.login || legacy.email || legacy.fullName || "landlord"
    );
    const accounts = getAccounts();
    if (!accounts[login]) {
      accounts[login] = {
        login,
        password: legacy.password || "1234",
        fullName: legacy.fullName,
        phone: legacy.phone,
        email: legacy.email,
        company: legacy.company,
        city: legacy.city,
        propertyType: legacy.propertyType,
        propertyCount: legacy.propertyCount,
        about: legacy.about,
        createdAt: legacy.createdAt ?? new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      saveAccounts(accounts);
      setSession(login);
    }
    window.localStorage.removeItem(LEGACY_KEY);
  } catch {
    window.localStorage.removeItem(LEGACY_KEY);
  }
}

export function getLandlordProfile(): LandlordProfile | null {
  if (typeof window === "undefined") return null;
  migrateLegacyProfile();
  const login = getSessionLogin();
  if (!login) return null;
  if (!isLandlordAccessGranted(login)) return null;
  return getAccounts()[login] ?? null;
}

export type SaveLandlordResult =
  | { ok: true; profile: LandlordProfile; needsApproval?: boolean }
  | { ok: false; error: string };

export function saveLandlordProfile(form: LandlordProfileForm): SaveLandlordResult {
  const login = normalizeLogin(form.login);
  if (!login || login.length < 3) {
    return { ok: false, error: "Login kamida 3 belgidan iborat bo'lsin" };
  }
  if (!form.fullName.trim() || !form.phone.trim() || !form.email.trim()) {
    return { ok: false, error: "Ism, telefon va email majburiy" };
  }

  const sessionLogin = getSessionLogin();
  const accounts = getAccounts();
  const existing = sessionLogin ? accounts[sessionLogin] : accounts[login];

  if (!sessionLogin) {
    if (!form.password || form.password.length < 4) {
      return { ok: false, error: "Parol kamida 4 belgidan iborat bo'lsin" };
    }
    if (accounts[login]) {
      return {
        ok: false,
        error: "Bu login band. Boshqa login tanlang yoki kirish qiling",
      };
    }
  } else if (sessionLogin !== login) {
    return { ok: false, error: "Loginni o'zgartirib bo'lmaydi" };
  }

  const profile = toProfile(form, existing);
  accounts[login] = profile;
  saveAccounts(accounts);
  if (!sessionLogin) {
    createPendingLandlordAccess(login);
    return { ok: true, profile, needsApproval: true };
  }
  setSession(login);
  return { ok: true, profile };
}

export type LoginLandlordResult =
  | { ok: true; profile: LandlordProfile }
  | { ok: false; reason: "invalid" | "no_access" };

export function loginLandlord(
  login: string,
  password: string
): LoginLandlordResult {
  migrateLegacyProfile();
  const key = normalizeLogin(login);
  if (!key) return { ok: false, reason: "invalid" };
  const account = getAccounts()[key];
  if (!account || account.password !== password) {
    return { ok: false, reason: "invalid" };
  }
  if (!isLandlordAccessGranted(key)) {
    return { ok: false, reason: "no_access" };
  }
  setSession(key);
  return { ok: true, profile: account };
}

/** Sessiyadan chiqish (profil saqlanadi) */
export function clearLandlordProfile() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(SESSION_KEY);
}

export function getAllLandlordAccounts(): LandlordProfile[] {
  if (typeof window === "undefined") return [];
  migrateLegacyProfile();
  return Object.values(getAccounts()).sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

export function getLandlordAccountByLogin(login: string): LandlordProfile | null {
  migrateLegacyProfile();
  return getAccounts()[normalizeLogin(login)] ?? null;
}

export type AdminUpdateLandlordResult =
  | { ok: true; profile: LandlordProfile }
  | { ok: false; error: string };

/** Dashboard admin: login, email, parol va boshqa maydonlarni yangilash */
export function adminUpdateLandlordAccount(
  login: string,
  data: {
    login?: string;
    email?: string;
    password?: string;
    phone?: string;
    fullName?: string;
  }
): AdminUpdateLandlordResult {
  migrateLegacyProfile();
  const key = normalizeLogin(login);
  const accounts = getAccounts();
  const existing = accounts[key];
  if (!existing) {
    return { ok: false, error: "Akkaunt topilmadi" };
  }

  const newLoginRaw = data.login?.replace(/^@/, "").trim();
  const newKey = newLoginRaw ? normalizeLogin(newLoginRaw) : key;

  if (newKey.length < 3) {
    return { ok: false, error: "Login kamida 3 belgidan iborat bo'lsin" };
  }
  if (newKey !== key && accounts[newKey]) {
    return { ok: false, error: "Bu login band. Boshqa nom tanlang" };
  }
  if (data.email !== undefined && !data.email.trim()) {
    return { ok: false, error: "Email bo'sh bo'lmasin" };
  }
  if (
    data.password !== undefined &&
    data.password.length > 0 &&
    data.password.length < 4
  ) {
    return { ok: false, error: "Parol kamida 4 belgidan iborat bo'lsin" };
  }

  const updated: LandlordProfile = {
    ...existing,
    login: newKey,
    email: data.email?.trim() ?? existing.email,
    password:
      data.password && data.password.length >= 4
        ? data.password
        : existing.password,
    phone: data.phone?.trim() ?? existing.phone,
    fullName: data.fullName?.trim() ?? existing.fullName,
    updatedAt: new Date().toISOString(),
  };

  if (newKey !== key) {
    delete accounts[key];
    renameLandlordAccess(key, newKey);
    if (getSessionLogin() === key) {
      setSession(newKey);
    }
  }
  accounts[newKey] = updated;
  saveAccounts(accounts);
  return { ok: true, profile: updated };
}

/** Dashboard admin: akkauntni butunlay o'chirish */
export function deleteLandlordAccount(login: string): boolean {
  migrateLegacyProfile();
  const key = normalizeLogin(login);
  const accounts = getAccounts();
  if (!accounts[key]) return false;
  delete accounts[key];
  saveAccounts(accounts);
  if (getSessionLogin() === key) {
    clearLandlordProfile();
  }
  deleteLandlordAccess(key);
  return true;
}
