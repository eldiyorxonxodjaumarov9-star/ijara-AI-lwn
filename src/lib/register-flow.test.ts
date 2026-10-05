import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { buildDemoWorkspaceCreateData } from "@/lib/api-server/workspace";
import { RENTAL_INDUSTRIES } from "@/lib/rental-industry";
import { registerSchema } from "@/lib/validations";

const validBase = {
  firstName: "Ali",
  lastName: "Karimov",
  phone: "+998901112233",
  email: "ali@example.com",
  password: "secret1",
  company: "Karimov Biznes",
};

describe("registration validation", () => {
  for (const industry of ["OFFICE_RENTAL", "HOTEL_HOSTEL", "CAR_RENTAL"] as const) {
    it(`accepts ${industry}`, () => {
      const parsed = registerSchema.safeParse({ ...validBase, industry });
      assert.equal(parsed.success, true);
      if (!parsed.success) return;
      assert.equal(parsed.data.industry, industry);
      assert.equal("plan" in parsed.data, false);
      assert.equal("role" in parsed.data, false);
    });
  }

  it("accepts only the industry allowlist", () => {
    for (const industry of RENTAL_INDUSTRIES) {
      const parsed = registerSchema.safeParse({ ...validBase, industry });
      assert.equal(parsed.success, true, industry);
    }
  });

  it("rejects invalid industry", () => {
    for (const industry of ["PRO", "office_rental", "", "DROP TABLE", null]) {
      const parsed = registerSchema.safeParse({ ...validBase, industry });
      assert.equal(parsed.success, false, String(industry));
    }
  });

  it("rejects bad email, empty phone, short password, and empty business name", () => {
    assert.equal(
      registerSchema.safeParse({ ...validBase, industry: "OTHER", email: "not-an-email" })
        .success,
      false
    );
    assert.equal(
      registerSchema.safeParse({ ...validBase, industry: "OTHER", phone: "   " }).success,
      false
    );
    assert.equal(
      registerSchema.safeParse({ ...validBase, industry: "OTHER", password: "12345" })
        .success,
      false
    );
    assert.equal(
      registerSchema.safeParse({ ...validBase, industry: "OTHER", company: "  " }).success,
      false
    );
  });

  it("strips client plan and role", () => {
    const parsed = registerSchema.safeParse({
      ...validBase,
      industry: "OFFICE_RENTAL",
      plan: "pro",
      role: "SUPER_ADMIN",
      premium: true,
    });
    assert.equal(parsed.success, true);
    if (!parsed.success) return;
    assert.equal("plan" in parsed.data, false);
    assert.equal("role" in parsed.data, false);
    assert.equal("premium" in parsed.data, false);
  });
});

describe("demo workspace payload", () => {
  for (const industry of ["OFFICE_RENTAL", "HOTEL_HOSTEL", "CAR_RENTAL"] as const) {
    it(`stores ${industry} with DEMO plan`, () => {
      const data = buildDemoWorkspaceCreateData({
        userId: "user-1",
        workspaceName: "Karimov Biznes",
        industry,
      });
      assert.equal(data.name, "Karimov Biznes");
      assert.equal(data.industry, industry);
      assert.equal(data.subscription.create.status, "DEMO");
      assert.equal(data.subscription.create.plan, "demo");
      assert.equal(data.memberships.create.role, "OWNER");
      assert.equal(data.isInternal, false);
    });
  }

  it("falls back to OTHER for missing industry and never accepts a client plan", () => {
    const data = buildDemoWorkspaceCreateData({
      userId: "user-1",
      workspaceName: "Eski oqim",
      industry: "PRO",
    });
    assert.equal(data.industry, "OTHER");
    assert.equal(data.subscription.create.plan, "demo");
    assert.equal(data.subscription.create.status, "DEMO");
  });
});

describe("registration redirect and login stay intact", () => {
  it("register page redirects to /dashboard after signup", () => {
    const src = readFileSync(
      join(process.cwd(), "src/app/(auth)/register/page.tsx"),
      "utf8"
    );
    assert.match(src, /router\.push\("\/dashboard"\)/);
    assert.match(src, /Siz qaysi ijara biznesini boshqarasiz/);
  });

  it("password and OTP login handlers remain on the login page", () => {
    const src = readFileSync(
      join(process.cwd(), "src/app/(auth)/login/page.tsx"),
      "utf8"
    );
    assert.match(src, /onPasswordLogin/);
    assert.match(src, /verifyEmailOtp/);
    assert.match(src, /href="\/register"/);
  });
});
