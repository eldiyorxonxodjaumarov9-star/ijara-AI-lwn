"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User,
} from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";

import { auth, db, isFirebaseConfigured } from "@/lib/firebase/config";
import { apiFetch, isApiConfigured, tokenStore } from "@/lib/api/client";
import { recordClientLead } from "@/lib/clients";
import {
  mergeCloudOnLogin,
  pushAccountState,
  refreshFromCloud,
  scheduleCloudPush,
} from "@/lib/cloud/sync-client";
import { getCollectionApi } from "@/lib/data/store";
import { clearDemoStorage } from "@/lib/demo-storage";
import type { AppUser, Role, Tenant } from "@/types";

function mapApiRole(role?: string): Role {
  switch (role) {
    case "SUPER_ADMIN":
    case "ADMIN":
      return "admin";
    case "EMPLOYEE":
      return "employee";
    case "TENANT":
      return "tenant";
    default:
      return "manager";
  }
}

function normalizePhone(value: string): string {
  return value.replace(/\D/g, "");
}

interface ApiUser {
  id: string;
  email: string;
  fullName?: string;
  phone?: string;
  role?: string;
  avatarUrl?: string;
  language?: string;
  company?: string;
  createdAt?: string;
}

function mapApiUser(u: ApiUser): AppUser {
  return {
    id: u.id,
    uid: u.id,
    email: u.email,
    displayName: u.fullName ?? "",
    phone: u.phone,
    role: mapApiRole(u.role),
    photoURL: u.avatarUrl,
    language: (u.language as AppUser["language"]) ?? "uz",
    company: u.company,
    createdAt: u.createdAt,
  };
}

interface RegisterPayload {
  displayName: string;
  email: string;
  password: string;
  role?: Role;
  company?: string;
}

interface AuthContextValue {
  user: AppUser | null;
  loading: boolean;
  demoMode: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginTenant: (fullName: string, phone: string) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updateUser: (data: Partial<AppUser>) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const DEMO_USERS_KEY = "arendahub:users";
const DEMO_SESSION_KEY = "arendahub:session";

const DEFAULT_DEMO_USER: AppUser & { password: string } = {
  id: "demo-admin",
  uid: "demo-admin",
  email: "admin@arendahub.uz",
  password: "123456",
  displayName: "Demo Administrator",
  role: "admin",
  company: "ArendaHub MChJ",
  language: "uz",
  createdAt: new Date().toISOString(),
};

function readDemoUsers(): (AppUser & { password: string })[] {
  if (typeof window === "undefined") return [DEFAULT_DEMO_USER];
  const raw = window.localStorage.getItem(DEMO_USERS_KEY);
  if (!raw) {
    window.localStorage.setItem(
      DEMO_USERS_KEY,
      JSON.stringify([DEFAULT_DEMO_USER])
    );
    return [DEFAULT_DEMO_USER];
  }
  try {
    return JSON.parse(raw);
  } catch {
    return [DEFAULT_DEMO_USER];
  }
}

function writeDemoUsers(users: (AppUser & { password: string })[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(DEMO_USERS_KEY, JSON.stringify(users));
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const apiMode = isApiConfigured;
  const demoMode = !isFirebaseConfigured && !isApiConfigured;

  useEffect(() => {
    // API (NestJS backend) rejimi
    if (apiMode) {
      if (tokenStore.access) {
        clearDemoStorage();
        apiFetch<ApiUser>("/auth/me")
          .then((u) => setUser(mapApiUser(u)))
          .catch(() => {
            tokenStore.clear();
            clearDemoStorage();
            setUser(null);
          })
          .finally(() => setLoading(false));
      } else {
        // Eski demo sessiya — server rejimida admin sifatida qoldirilmaydi
        const raw =
          typeof window !== "undefined"
            ? window.localStorage.getItem(DEMO_SESSION_KEY)
            : null;
        if (raw) {
          try {
            const saved = JSON.parse(raw) as AppUser;
            if (saved.role === "tenant") {
              setUser(saved);
            } else {
              clearDemoStorage();
            }
          } catch {
            clearDemoStorage();
          }
        }
        setLoading(false);
      }
      return;
    }

    if (!demoMode && auth) {
      const unsub = onAuthStateChanged(auth, async (fbUser: User | null) => {
        if (fbUser && db) {
          const snap = await getDoc(doc(db, "users", fbUser.uid));
          const profile = snap.exists() ? (snap.data() as Partial<AppUser>) : {};
          setUser({
            id: fbUser.uid,
            uid: fbUser.uid,
            email: fbUser.email ?? "",
            displayName: fbUser.displayName ?? profile.displayName ?? "",
            role: (profile.role as Role) ?? "employee",
            photoURL: fbUser.photoURL ?? undefined,
            company: profile.company,
            phone: profile.phone,
            language: profile.language ?? "uz",
            createdAt: profile.createdAt,
          });
        } else {
          setUser(null);
        }
        setLoading(false);
      });
      return unsub;
    }

    // Demo rejim
    const raw =
      typeof window !== "undefined"
        ? window.localStorage.getItem(DEMO_SESSION_KEY)
        : null;
    if (raw) {
      try {
        const saved = JSON.parse(raw) as AppUser;
        setUser(saved);
        if (saved.email && saved.role !== "tenant") {
          void refreshFromCloud(saved.email).then((updated) => {
            if (!updated) return;
            const rawSession = window.localStorage.getItem(DEMO_SESSION_KEY);
            if (!rawSession) return;
            try {
              setUser(JSON.parse(rawSession) as AppUser);
            } catch {
              /* e'tiborsiz */
            }
          });
        }
      } catch {
        setUser(null);
      }
    }
    setLoading(false);
  }, [apiMode, demoMode]);

  const login = useCallback(
    async (email: string, password: string) => {
      if (apiMode) {
        const res = await apiFetch<{
          user: ApiUser;
          accessToken: string;
          refreshToken: string;
        }>("/auth/login", {
          method: "POST",
          auth: false,
          body: { email, password },
        });
        tokenStore.set(res.accessToken, res.refreshToken);
        clearDemoStorage();
        setUser(mapApiUser(res.user));
        return;
      }
      if (!demoMode && auth) {
        await signInWithEmailAndPassword(auth, email, password);
        return;
      }
      const users = readDemoUsers();
      const found = users.find(
        (u) => u.email.toLowerCase() === email.toLowerCase()
      );
      if (!found || found.password !== password) {
        throw new Error("Email yoki parol noto'g'ri");
      }

      await mergeCloudOnLogin(email.toLowerCase());

      const refreshed = readDemoUsers().find(
        (u) => u.email.toLowerCase() === email.toLowerCase()
      );
      const active = refreshed ?? found;
      if (active.password !== password) {
        throw new Error("Email yoki parol noto'g'ri");
      }

      const { password: _pw, ...safe } = active;
      void _pw;
      window.localStorage.setItem(DEMO_SESSION_KEY, JSON.stringify(safe));
      setUser(safe);
    },
    [apiMode, demoMode]
  );

  const loginTenant = useCallback(
    async (fullName: string, phone: string) => {
      const wantedName = fullName.trim().toLowerCase();
      const wantedPhone = normalizePhone(phone);

      let tenants: Tenant[] = [];
      try {
        tenants = await getCollectionApi<Tenant>("tenants").list();
      } catch {
        throw new Error("Ijarachilar ro'yxatini olishda xatolik");
      }

      const match = tenants.find(
        (t) =>
          t.fullName.trim().toLowerCase() === wantedName &&
          normalizePhone(t.phone) === wantedPhone
      );
      if (!match) {
        await recordClientLead(fullName, phone);
        throw new Error(
          "Bunday ijarachi topilmadi. Ism familiya va telefonni tekshiring."
        );
      }

      await recordClientLead(fullName, phone, match.id);

      const tenantUser: AppUser = {
        id: match.id,
        uid: match.id,
        email: match.email ?? "",
        displayName: match.fullName,
        phone: match.phone,
        role: "tenant",
        tenantId: match.id,
        language: "uz",
        createdAt: match.createdAt,
      };

      if (typeof window !== "undefined") {
        window.localStorage.setItem(
          DEMO_SESSION_KEY,
          JSON.stringify(tenantUser)
        );
      }
      setUser(tenantUser);
    },
    []
  );

  const register = useCallback(
    async (payload: RegisterPayload) => {
      if (apiMode) {
        const roleToApi: Record<Role, string> = {
          admin: "ADMIN",
          manager: "MANAGER",
          employee: "EMPLOYEE",
          tenant: "TENANT",
        };
        const res = await apiFetch<{
          user: ApiUser;
          accessToken: string;
          refreshToken: string;
        }>("/auth/register", {
          method: "POST",
          auth: false,
          body: {
            email: payload.email,
            password: payload.password,
            fullName: payload.displayName,
            role: roleToApi[payload.role ?? "manager"],
          },
        });
        tokenStore.set(res.accessToken, res.refreshToken);
        clearDemoStorage();
        setUser(mapApiUser(res.user));
        return;
      }
      if (!demoMode && auth && db) {
        const cred = await createUserWithEmailAndPassword(
          auth,
          payload.email,
          payload.password
        );
        await updateProfile(cred.user, { displayName: payload.displayName });
        const profile: AppUser = {
          id: cred.user.uid,
          uid: cred.user.uid,
          email: payload.email,
          displayName: payload.displayName,
          role: payload.role ?? "manager",
          company: payload.company,
          language: "uz",
          createdAt: new Date().toISOString(),
        };
        await setDoc(doc(db, "users", cred.user.uid), profile);
        return;
      }

      const users = readDemoUsers();
      if (users.some((u) => u.email.toLowerCase() === payload.email.toLowerCase())) {
        throw new Error("Bu email allaqachon ro'yxatdan o'tgan");
      }
      const newUser: AppUser & { password: string } = {
        id: crypto.randomUUID(),
        uid: crypto.randomUUID(),
        email: payload.email,
        password: payload.password,
        displayName: payload.displayName,
        role: payload.role ?? "manager",
        company: payload.company,
        language: "uz",
        createdAt: new Date().toISOString(),
      };
      writeDemoUsers([...users, newUser]);
      const { password: _pw, ...safe } = newUser;
      void _pw;
      window.localStorage.setItem(DEMO_SESSION_KEY, JSON.stringify(safe));
      setUser(safe);
      await pushAccountState(safe.email);
    },
    [apiMode, demoMode]
  );

  const clearTenantSession = () => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(DEMO_SESSION_KEY);
    }
  };

  const logout = useCallback(async () => {
    if (apiMode) {
      // Ijarachi (tokensiz) bo'lmasa, serverga logout yuboramiz
      if (tokenStore.access) {
        try {
          await apiFetch("/auth/logout", { method: "POST" });
        } catch {
          // tokenni baribir tozalaymiz
        }
      }
      tokenStore.clear();
      clearDemoStorage();
      clearTenantSession();
      setUser(null);
      return;
    }
    if (!demoMode && auth) {
      await signOut(auth);
      return;
    }
    window.localStorage.removeItem(DEMO_SESSION_KEY);
    setUser(null);
  }, [apiMode, demoMode]);

  const resetPassword = useCallback(
    async (email: string) => {
      if (apiMode) {
        await apiFetch("/auth/forgot-password", {
          method: "POST",
          auth: false,
          body: { email },
        });
        return;
      }
      if (!demoMode && auth) {
        await sendPasswordResetEmail(auth, email);
        return;
      }
      const users = readDemoUsers();
      if (!users.some((u) => u.email.toLowerCase() === email.toLowerCase())) {
        throw new Error("Bunday foydalanuvchi topilmadi");
      }
      // Demo rejimda haqiqiy email yuborilmaydi
    },
    [apiMode, demoMode]
  );

  const updateUser = useCallback(
    async (data: Partial<AppUser>) => {
      if (demoMode && data.email && typeof window !== "undefined") {
        const users = readDemoUsers();
        const taken = users.some(
          (u) =>
            u.id !== user?.id &&
            u.email.toLowerCase() === data.email!.toLowerCase()
        );
        if (taken) {
          throw new Error("Bu email allaqachon ro'yxatdan o'tgan");
        }
      }

      setUser((prev) => {
        if (!prev) return prev;
        const next = { ...prev, ...data };
        if (demoMode && typeof window !== "undefined") {
          window.localStorage.setItem(DEMO_SESSION_KEY, JSON.stringify(next));
          const users = readDemoUsers().map((u) =>
            u.id === next.id ? { ...u, ...data } : u
          );
          writeDemoUsers(users);
          scheduleCloudPush(next.email);
        }
        return next;
      });
      if (apiMode && user) {
        try {
          await apiFetch(`/users/${user.id}`, {
            method: "PATCH",
            body: {
              fullName: data.displayName,
              phone: data.phone,
              email: data.email,
              avatarUrl: data.photoURL,
              language: data.language,
            },
          });
          const refreshed = await apiFetch<ApiUser>("/auth/me");
          setUser(mapApiUser(refreshed));
        } catch {
          // Profilni serverda yangilash huquqi bo'lmasligi mumkin
        }
        return;
      }
      if (!demoMode && db && user) {
        await setDoc(doc(db, "users", user.uid), data, { merge: true });
      }
    },
    [apiMode, demoMode, user]
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      demoMode,
      login,
      loginTenant,
      register,
      logout,
      resetPassword,
      updateUser,
    }),
    [
      user,
      loading,
      demoMode,
      login,
      loginTenant,
      register,
      logout,
      resetPassword,
      updateUser,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth AuthProvider ichida ishlatilishi kerak");
  return ctx;
}
