import { CRM_NAV, type CrmViewId } from "@/lib/arenda-crm/constants";

const ACCOUNTS_KEY = "arenda:landlord-accounts";
const ACCESS_KEY = "arenda:landlord-access";

export type CrmModuleMap = Record<CrmViewId, boolean>;

export type LandlordAccessRecord = {
  login: string;
  granted: boolean;
  modules: CrmModuleMap;
  grantedAt?: string;
  grantedBy?: string;
  note?: string;
};

export type LandlordAccountStub = {
  login: string;
  fullName: string;
  email: string;
  phone: string;
  company?: string;
  city: string;
  createdAt: string;
};

function normalizeLogin(login: string) {
  return login.trim().toLowerCase();
}

export function defaultCrmModules(all = true): CrmModuleMap {
  return Object.fromEntries(
    CRM_NAV.map((n) => [n.id, all])
  ) as CrmModuleMap;
}

function mergeModules(partial?: Partial<CrmModuleMap>): CrmModuleMap {
  const base = defaultCrmModules(true);
  if (!partial) return base;
  return { ...base, ...partial };
}

function readStore(): Record<string, LandlordAccessRecord> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(ACCESS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, LandlordAccessRecord & { modules?: Partial<CrmModuleMap> }>;
    const out: Record<string, LandlordAccessRecord> = {};
    for (const [key, val] of Object.entries(parsed)) {
      out[key] = {
        ...val,
        modules: mergeModules(val.modules),
      };
    }
    return out;
  } catch {
    return {};
  }
}

function writeStore(store: Record<string, LandlordAccessRecord>) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ACCESS_KEY, JSON.stringify(store));
}

function readAccountStubs(): LandlordAccountStub[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(ACCOUNTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Record<string, LandlordAccountStub>;
    return Object.values(parsed);
  } catch {
    return [];
  }
}

function ensureRecord(
  store: Record<string, LandlordAccessRecord>,
  login: string,
  patch: Partial<LandlordAccessRecord> = {}
): LandlordAccessRecord {
  const key = normalizeLogin(login);
  const existing = store[key];
  return {
    login: key,
    granted: patch.granted ?? existing?.granted ?? false,
    modules: mergeModules(patch.modules ?? existing?.modules),
    grantedAt: patch.grantedAt ?? existing?.grantedAt,
    grantedBy: patch.grantedBy ?? existing?.grantedBy,
    note: patch.note ?? existing?.note,
  };
}

/** Mavjud akkauntlar uchun avtomatik kirish huquqi */
export function migrateLandlordAccess() {
  if (typeof window === "undefined") return;
  const store = readStore();
  let changed = false;
  for (const account of readAccountStubs()) {
    const key = normalizeLogin(account.login);
    if (!store[key]) {
      store[key] = {
        login: key,
        granted: true,
        modules: defaultCrmModules(true),
        grantedAt: account.createdAt,
        grantedBy: "system",
        note: "Avtomatik migratsiya",
      };
      changed = true;
    } else if (!store[key].modules) {
      store[key] = { ...store[key], modules: defaultCrmModules(true) };
      changed = true;
    }
  }
  if (changed) writeStore(store);
}

export function getLandlordAccess(login: string): LandlordAccessRecord | null {
  migrateLandlordAccess();
  return readStore()[normalizeLogin(login)] ?? null;
}

export function isLandlordAccessGranted(login: string): boolean {
  migrateLandlordAccess();
  const record = readStore()[normalizeLogin(login)];
  if (!record) return false;
  return record.granted;
}

export function isCrmModuleAllowed(login: string, module: CrmViewId): boolean {
  if (!isLandlordAccessGranted(login)) return false;
  const record = getLandlordAccess(login);
  if (!record) return false;
  return record.modules[module] ?? true;
}

export function getAllowedCrmModules(login: string): CrmViewId[] {
  migrateLandlordAccess();
  const record = readStore()[normalizeLogin(login)];
  if (!record?.granted) return [];
  return CRM_NAV.filter((n) => record.modules[n.id] !== false).map((n) => n.id);
}

export function setLandlordAccess(
  login: string,
  granted: boolean,
  grantedBy: string,
  note?: string
): LandlordAccessRecord {
  migrateLandlordAccess();
  const key = normalizeLogin(login);
  const store = readStore();
  const now = new Date().toISOString();
  const prev = store[key];
  const record = ensureRecord(store, key, {
    granted,
    grantedAt: granted ? now : prev?.grantedAt,
    grantedBy,
    modules: granted
      ? mergeModules(prev?.modules)
      : defaultCrmModules(false),
    note:
      note ??
      (granted ? "Dashboard orqali tasdiqlandi" : "Kirish huquqi bekor qilindi"),
  });
  store[key] = record;
  writeStore(store);
  return record;
}

export function setCrmModuleAccess(
  login: string,
  module: CrmViewId,
  allowed: boolean,
  grantedBy: string
): LandlordAccessRecord {
  migrateLandlordAccess();
  const key = normalizeLogin(login);
  const store = readStore();
  const prev = store[key] ?? ensureRecord(store, key, {
    granted: false,
    modules: defaultCrmModules(false),
  });
  const modules = { ...mergeModules(prev.modules), [module]: allowed };
  const record: LandlordAccessRecord = {
    ...prev,
    login: key,
    modules,
    grantedBy,
    note: allowed
      ? `"${module}" moduliga ruxsat berildi`
      : `"${module}" moduli o'chirildi`,
  };
  store[key] = record;
  writeStore(store);
  return record;
}

export function createPendingLandlordAccess(login: string) {
  const key = normalizeLogin(login);
  const store = readStore();
  if (store[key]) return store[key];
  const record: LandlordAccessRecord = {
    login: key,
    granted: false,
    modules: defaultCrmModules(false),
    grantedBy: "system",
    note: "Yangi ro'yxatdan o'tish — admin tasdig'i kutilmoqda",
  };
  store[key] = record;
  writeStore(store);
  return record;
}

export function deleteLandlordAccess(login: string) {
  const store = readStore();
  delete store[normalizeLogin(login)];
  writeStore(store);
}

/** Login o'zgarganda ruxsat yozuvini yangi kalitga ko'chirish */
export function renameLandlordAccess(oldLogin: string, newLogin: string) {
  const oldKey = normalizeLogin(oldLogin);
  const newKey = normalizeLogin(newLogin);
  if (oldKey === newKey) return;
  const store = readStore();
  const record = store[oldKey];
  if (record) {
    store[newKey] = { ...record, login: newKey };
    delete store[oldKey];
    writeStore(store);
  }
}

export type LandlordAccessWithProfile = LandlordAccessRecord & {
  profile?: LandlordAccountStub;
};

export function getAllLandlordAccessRecords(): LandlordAccessWithProfile[] {
  migrateLandlordAccess();
  const store = readStore();
  const accounts = readAccountStubs();
  const logins = new Set([
    ...accounts.map((a) => normalizeLogin(a.login)),
    ...Object.keys(store),
  ]);
  return Array.from(logins)
    .map((login) => {
      const account = accounts.find((a) => normalizeLogin(a.login) === login);
      const access = store[login];
      return {
        login,
        granted: access?.granted ?? false,
        modules: mergeModules(access?.modules),
        grantedAt: access?.grantedAt,
        grantedBy: access?.grantedBy,
        note: access?.note,
        profile: account,
      };
    })
    .sort((a, b) => {
      if (a.granted !== b.granted) return a.granted ? 1 : -1;
      return a.login.localeCompare(b.login);
    });
}
