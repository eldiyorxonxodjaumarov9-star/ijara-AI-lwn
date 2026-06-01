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
import type { AppUser, Role } from "@/types";

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
  const demoMode = !isFirebaseConfigured;

  useEffect(() => {
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
        setUser(JSON.parse(raw));
      } catch {
        setUser(null);
      }
    }
    setLoading(false);
  }, [demoMode]);

  const login = useCallback(
    async (email: string, password: string) => {
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
      const { password: _pw, ...safe } = found;
      void _pw;
      window.localStorage.setItem(DEMO_SESSION_KEY, JSON.stringify(safe));
      setUser(safe);
    },
    [demoMode]
  );

  const register = useCallback(
    async (payload: RegisterPayload) => {
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
    },
    [demoMode]
  );

  const logout = useCallback(async () => {
    if (!demoMode && auth) {
      await signOut(auth);
      return;
    }
    window.localStorage.removeItem(DEMO_SESSION_KEY);
    setUser(null);
  }, [demoMode]);

  const resetPassword = useCallback(
    async (email: string) => {
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
    [demoMode]
  );

  const updateUser = useCallback(
    async (data: Partial<AppUser>) => {
      setUser((prev) => {
        if (!prev) return prev;
        const next = { ...prev, ...data };
        if (demoMode && typeof window !== "undefined") {
          window.localStorage.setItem(DEMO_SESSION_KEY, JSON.stringify(next));
          const users = readDemoUsers().map((u) =>
            u.id === next.id ? { ...u, ...data } : u
          );
          writeDemoUsers(users);
        }
        return next;
      });
      if (!demoMode && db && user) {
        await setDoc(doc(db, "users", user.uid), data, { merge: true });
      }
    },
    [demoMode, user]
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      demoMode,
      login,
      register,
      logout,
      resetPassword,
      updateUser,
    }),
    [user, loading, demoMode, login, register, logout, resetPassword, updateUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth AuthProvider ichida ishlatilishi kerak");
  return ctx;
}
