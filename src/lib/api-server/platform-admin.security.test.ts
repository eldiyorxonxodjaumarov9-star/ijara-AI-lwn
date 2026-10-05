import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { after, before, beforeEach, describe, it } from "node:test";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { NextRequest } from "next/server";

import { POST as login } from "@/app/api/super-admin/auth/login/route";
import { POST as logout } from "@/app/api/super-admin/auth/logout/route";
import { GET as me } from "@/app/api/super-admin/auth/me/route";
import { requireUser } from "@/lib/api-server/auth";
import {
  __resetPlatformAdminBootstrapForTests,
  ensurePlatformAdminBootstrap,
} from "@/lib/api-server/platform-admin/bootstrap";
import { PLATFORM_ADMIN_COOKIE, signPlatformAdminSession } from "@/lib/api-server/platform-admin/session";
import { prisma } from "@/lib/api-server/prisma";

// Real handlers, real signing and cookies; only database I/O is replaced by an in-memory table.
const signingKey = randomBytes(32).toString("hex");
const ENV_KEYS = [
  "DATABASE_URL",
  "JWT_ACCESS_SECRET",
  "PLATFORM_ADMIN_SESSION_SECRET",
  "PLATFORM_ADMIN_EMAIL",
  "PLATFORM_ADMIN_PASSWORD",
] as const;
const originalEnv = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
const PASSWORD = "correct-horse-battery-staple";

type AdminRow = {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  isActive: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};
let admins: AdminRow[] = [];
let ipCounter = 0;
const restores: (() => void)[] = [];

function stub(model: object, name: string, implementation: unknown) {
  const original = Reflect.get(model, name);
  Reflect.set(model, name, implementation);
  restores.push(() => Reflect.set(model, name, original));
}

function row(partial: Partial<AdminRow> & Pick<AdminRow, "id" | "email">): AdminRow {
  const now = new Date();
  return {
    passwordHash: bcrypt.hashSync(PASSWORD, 4),
    name: "Test Admin",
    isActive: true,
    lastLoginAt: null,
    createdAt: now,
    updatedAt: now,
    ...partial,
  };
}

before(() => {
  process.env.DATABASE_URL = "postgresql://test:test@localhost:1/test";
  process.env.JWT_ACCESS_SECRET = signingKey;
  delete process.env.PLATFORM_ADMIN_SESSION_SECRET;
  delete process.env.PLATFORM_ADMIN_EMAIL;
  delete process.env.PLATFORM_ADMIN_PASSWORD;

  const model = prisma.platformAdmin;
  stub(model, "findUnique", async ({ where }: { where: { id?: string; email?: string } }) =>
    admins.find((a) => (where.id ? a.id === where.id : a.email === where.email)) ?? null
  );
  stub(model, "update", async ({ where, data }: { where: { id: string }; data: Partial<AdminRow> }) => {
    const found = admins.find((a) => a.id === where.id);
    if (!found) throw new Error("not found");
    Object.assign(found, data);
    return found;
  });
  stub(model, "count", async () => admins.length);
  stub(model, "create", async ({ data }: { data: Omit<AdminRow, "id" | "isActive" | "lastLoginAt" | "createdAt" | "updatedAt"> }) => {
    const created = row({ id: `admin-${admins.length + 1}`, ...data });
    admins.push(created);
    return created;
  });
  stub(prisma.user, "findUnique", async () => null);
});

after(() => {
  restores.reverse().forEach((restore) => restore());
  for (const key of ENV_KEYS) {
    if (originalEnv[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnv[key];
  }
});

beforeEach(() => {
  admins = [
    row({ id: "admin-1", email: "owner@example.invalid" }),
    row({ id: "admin-2", email: "disabled@example.invalid", isActive: false }),
  ];
  __resetPlatformAdminBootstrapForTests();
});

function loginRequest(body: unknown) {
  ipCounter += 1;
  return new NextRequest("http://localhost/api/super-admin/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": `10.0.0.${ipCounter}` },
    body: JSON.stringify(body),
  });
}

function getRequest(path: string, headers: Record<string, string> = {}) {
  return new NextRequest(`http://localhost${path}`, { headers });
}

function sessionCookieFrom(res: Response): string {
  const header = res.headers.get("set-cookie") ?? "";
  const match = header.match(new RegExp(`${PLATFORM_ADMIN_COOKIE}=([^;]*)`));
  return match?.[1] ?? "";
}

function workspaceAccessToken() {
  return jwt.sign({ sub: "user-a", email: "user@example.invalid", role: "ADMIN", workspaceId: "ws-a" }, signingKey);
}

describe("platform super admin authentication", () => {
  it("valid admin login returns 200 with a secure HttpOnly session cookie and no secrets", async () => {
    const res = await login(loginRequest({ email: "  OWNER@example.invalid ", password: PASSWORD }));
    assert.equal(res.status, 200);
    const cookie = res.headers.get("set-cookie") ?? "";
    assert.match(cookie, new RegExp(`^${PLATFORM_ADMIN_COOKIE}=`));
    assert.match(cookie, /HttpOnly/i);
    assert.match(cookie, /SameSite=lax/i);
    assert.match(cookie, /Path=\//);
    assert.match(cookie, /Max-Age=\d+/);
    const text = await res.text();
    assert.equal(/passwordHash|correct-horse/.test(text), false);
    assert.ok(admins[0]!.lastLoginAt instanceof Date);
  });

  it("wrong password and unknown email return the same generic 401", async () => {
    const wrong = await login(loginRequest({ email: "owner@example.invalid", password: "nope-nope-nope" }));
    const unknown = await login(loginRequest({ email: "ghost@example.invalid", password: PASSWORD }));
    assert.equal(wrong.status, 401);
    assert.equal(unknown.status, 401);
    const [a, b] = [await wrong.json(), await unknown.json()];
    assert.equal(a.message, "Email yoki parol noto‘g‘ri");
    assert.equal(b.message, a.message);
    assert.equal(wrong.headers.get("set-cookie"), null);
    assert.equal(unknown.headers.get("set-cookie"), null);
  });

  it("inactive admin cannot log in", async () => {
    const res = await login(loginRequest({ email: "disabled@example.invalid", password: PASSWORD }));
    assert.equal(res.status, 401);
    assert.equal(res.headers.get("set-cookie"), null);
  });

  it("/me without a session is 401", async () => {
    const res = await me(getRequest("/api/super-admin/auth/me"));
    assert.equal(res.status, 401);
  });

  it("/me with an admin session returns only public fields", async () => {
    const loginRes = await login(loginRequest({ email: "owner@example.invalid", password: PASSWORD }));
    const token = sessionCookieFrom(loginRes);
    const res = await me(getRequest("/api/super-admin/auth/me", { cookie: `${PLATFORM_ADMIN_COOKIE}=${token}` }));
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.deepEqual(Object.keys(body.data.admin).sort(), ["email", "id", "lastLoginAt", "name"]);
    assert.equal(JSON.stringify(body).includes("passwordHash"), false);
  });

  it("/me rejects a session for an admin that was deactivated", async () => {
    const token = signPlatformAdminSession("admin-2");
    const res = await me(getRequest("/api/super-admin/auth/me", { cookie: `${PLATFORM_ADMIN_COOKIE}=${token}` }));
    assert.equal(res.status, 401);
  });

  it("ordinary workspace auth cannot reach super-admin /me", async () => {
    const access = workspaceAccessToken();
    const viaBearer = await me(getRequest("/api/super-admin/auth/me", { authorization: `Bearer ${access}` }));
    assert.equal(viaBearer.status, 401);
    const viaCookie = await me(getRequest("/api/super-admin/auth/me", { cookie: `${PLATFORM_ADMIN_COOKIE}=${access}` }));
    assert.equal(viaCookie.status, 401);
    const forged = jwt.sign({ platformAdminId: "admin-1", type: "PLATFORM_ADMIN" }, signingKey);
    const viaForged = await me(getRequest("/api/super-admin/auth/me", { cookie: `${PLATFORM_ADMIN_COOKIE}=${forged}` }));
    assert.equal(viaForged.status, 401);
  });

  it("admin session grants no workspace user privileges", async () => {
    const token = signPlatformAdminSession("admin-1");
    const withCookie = await requireUser(getRequest("/api/workspace/me", { cookie: `${PLATFORM_ADMIN_COOKIE}=${token}` }));
    assert.ok(withCookie.error);
    assert.equal(withCookie.error.status, 401);
    const asBearer = await requireUser(getRequest("/api/workspace/me", { authorization: `Bearer ${token}` }));
    assert.ok(asBearer.error);
    assert.equal(asBearer.error.status, 401);
  });

  it("logout clears the session cookie", async () => {
    const res = await logout();
    assert.equal(res.status, 200);
    const cookie = res.headers.get("set-cookie") ?? "";
    assert.match(cookie, new RegExp(`^${PLATFORM_ADMIN_COOKIE}=;`));
    assert.match(cookie, /Max-Age=0/);
    assert.match(cookie, /HttpOnly/i);
  });

  it("rate limits repeated login attempts for one email", async () => {
    let last: Response | undefined;
    for (let i = 0; i < 9; i += 1) {
      last = await login(loginRequest({ email: "limited@example.invalid", password: "wrong-password" }));
    }
    assert.equal(last!.status, 429);
    assert.ok(Number(last!.headers.get("retry-after")) > 0);
  });

  it("registration cannot create platform admins or SUPER_ADMIN users", () => {
    const src = readFileSync(join(process.cwd(), "src/app/api/auth/register/route.ts"), "utf8");
    assert.equal(/platformAdmin|PlatformAdmin/.test(src), false);
    assert.equal(/Role\.SUPER_ADMIN|["'`]SUPER_ADMIN["'`]/.test(src), false);
    assert.match(src, /Role\.ADMIN/);
    assert.equal(/body\.role|role:\s*body|\.\.\.body/.test(src), false);
  });
});

describe("platform admin env bootstrap", () => {
  it("creates the first admin with a bcrypt hash only when the table is empty", async () => {
    admins = [];
    process.env.PLATFORM_ADMIN_EMAIL = " Boss@Example.invalid ";
    process.env.PLATFORM_ADMIN_PASSWORD = "very-long-bootstrap-pass";
    try {
      await ensurePlatformAdminBootstrap();
      assert.equal(admins.length, 1);
      assert.equal(admins[0]!.email, "boss@example.invalid");
      assert.notEqual(admins[0]!.passwordHash, "very-long-bootstrap-pass");
      assert.ok(await bcrypt.compare("very-long-bootstrap-pass", admins[0]!.passwordHash));
    } finally {
      delete process.env.PLATFORM_ADMIN_EMAIL;
      delete process.env.PLATFORM_ADMIN_PASSWORD;
    }
  });

  it("never overwrites an existing admin", async () => {
    const before = admins[0]!.passwordHash;
    process.env.PLATFORM_ADMIN_EMAIL = "owner@example.invalid";
    process.env.PLATFORM_ADMIN_PASSWORD = "another-long-password!";
    try {
      await ensurePlatformAdminBootstrap();
      assert.equal(admins.length, 2);
      assert.equal(admins[0]!.passwordHash, before);
    } finally {
      delete process.env.PLATFORM_ADMIN_EMAIL;
      delete process.env.PLATFORM_ADMIN_PASSWORD;
    }
  });
});
