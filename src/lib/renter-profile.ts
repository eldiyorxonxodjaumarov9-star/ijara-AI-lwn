import type { RenterSearchForm } from "@/lib/renter-search-form";
import { normalizeRenterForm } from "@/lib/renter-search-form";

export type RenterProfile = RenterSearchForm & {
  createdAt: string;
  updatedAt: string;
};

const ACCOUNTS_KEY = "arenda:renter-accounts";
const SESSION_KEY = "arenda:renter-session";
const LEGACY_KEY = "arenda:renter-profile";

type RenterAccountStore = Record<string, RenterProfile>;

function normalizeLogin(login: string) {
  return login.trim().toLowerCase();
}

function getAccounts(): RenterAccountStore {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(ACCOUNTS_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as RenterAccountStore;
  } catch {
    return {};
  }
}

function saveAccounts(accounts: RenterAccountStore) {
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

function normalizeProfile(account: Partial<RenterProfile>): RenterProfile {
  const form = normalizeRenterForm(account);
  return {
    ...form,
    createdAt: account.createdAt ?? new Date().toISOString(),
    updatedAt: account.updatedAt ?? new Date().toISOString(),
  };
}

function patchStoredAccounts() {
  const accounts = getAccounts();
  let changed = false;
  for (const [key, account] of Object.entries(accounts)) {
    const normalized = normalizeProfile(account);
    if (JSON.stringify(account) !== JSON.stringify(normalized)) {
      accounts[key] = normalized;
      changed = true;
    }
  }
  if (changed) saveAccounts(accounts);
}

function migrateLegacyProfile() {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(LEGACY_KEY);
    if (!raw) return;
    const legacy = JSON.parse(raw) as RenterProfile & { login?: string };
    const login = normalizeLogin(legacy.login || legacy.companyName || "user");
    const accounts = getAccounts();
    if (!accounts[login]) {
      accounts[login] = normalizeProfile({
        ...legacy,
        login,
        password: legacy.password || "1234",
        phone: legacy.phone || "",
      });
      saveAccounts(accounts);
      setSession(login);
    }
    window.localStorage.removeItem(LEGACY_KEY);
  } catch {
    window.localStorage.removeItem(LEGACY_KEY);
  }
}

export function getRenterProfile(): RenterProfile | null {
  if (typeof window === "undefined") return null;
  migrateLegacyProfile();
  patchStoredAccounts();
  const login = getSessionLogin();
  if (!login) return null;
  const account = getAccounts()[login];
  if (!account) return null;
  return normalizeProfile(account);
}

export type SaveRenterResult =
  | { ok: true; profile: RenterProfile }
  | { ok: false; error: string };

export function saveRenterProfile(form: RenterSearchForm): SaveRenterResult {
  const login = normalizeLogin(form.login);
  if (!login || login.length < 3) {
    return { ok: false, error: "Login kamida 3 belgidan iborat bo'lsin" };
  }

  const sessionLogin = getSessionLogin();
  const accounts = getAccounts();
  const existing = sessionLogin ? accounts[sessionLogin] : accounts[login];

  if (!sessionLogin) {
    if (!form.password || form.password.length < 4) {
      return { ok: false, error: "Parol kamida 4 belgidan iborat bo'lsin" };
    }
    if (accounts[login]) {
      return { ok: false, error: "Bu login band. Boshqa login tanlang yoki kirish qiling" };
    }
  } else if (sessionLogin !== login) {
    return { ok: false, error: "Loginni o'zgartirib bo'lmaydi" };
  }

  const now = new Date().toISOString();
  const profile: RenterProfile = {
    ...form,
    login,
    password: form.password || existing?.password || "",
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  accounts[login] = profile;
  saveAccounts(accounts);
  setSession(login);
  return { ok: true, profile };
}

export function loginRenter(login: string, password: string): RenterProfile | null {
  migrateLegacyProfile();
  patchStoredAccounts();
  const key = normalizeLogin(login);
  if (!key) return null;
  const account = getAccounts()[key];
  if (!account || account.password !== password) return null;
  setSession(key);
  return normalizeProfile(account);
}

export function clearRenterProfile() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(SESSION_KEY);
}

export function deleteRenterAccount(login?: string) {
  if (typeof window === "undefined") return;
  const key = normalizeLogin(login || getSessionLogin() || "");
  if (!key) return;
  const accounts = getAccounts();
  delete accounts[key];
  saveAccounts(accounts);
  window.localStorage.removeItem(SESSION_KEY);
}

/** Dashboard: barcha arendator akkauntlari */
export function getAllRenterAccounts(): RenterProfile[] {
  if (typeof window === "undefined") return [];
  migrateLegacyProfile();
  patchStoredAccounts();
  return Object.values(getAccounts()).sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}
