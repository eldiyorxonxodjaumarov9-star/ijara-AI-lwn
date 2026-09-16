/**
 * API-server RBAC helpers.
 *
 * Role policy (Prisma Role):
 * - SUPER_ADMIN / ADMIN: all methods on all resources below.
 * - MANAGER: all methods on all listed resources (including employees + task management).
 * - EMPLOYEE:
 *   - GET on: tenants, contracts, payments, expenses, maintenance,
 *     notifications, properties, clients, tasks
 *   - Mutate allowed on operational resources: tenants, contracts, maintenance,
 *     notifications, properties, clients (POST/PATCH/PUT/DELETE)
 *   - NO finance mutate: payments & expenses — GET only (no POST/PATCH/PUT/DELETE)
 *   - NO employees resource (any method)
 *   - tasks: GET only (managers/admins manage tasks)
 */
import type { Role, User } from "@prisma/client";
import type { NextRequest } from "next/server";
import type { NextResponse } from "next/server";

import { requireUser } from "@/lib/api-server/auth";
import { fail } from "@/lib/api-server/http";

export const STAFF_ROLES = [
  "SUPER_ADMIN",
  "ADMIN",
  "MANAGER",
] as const satisfies readonly Role[];

export const ADMIN_ROLES = [
  "SUPER_ADMIN",
  "ADMIN",
] as const satisfies readonly Role[];

/** All authenticated dashboard users (includes EMPLOYEE). */
export const ANY_STAFF_ROLES = [
  "SUPER_ADMIN",
  "ADMIN",
  "MANAGER",
  "EMPLOYEE",
] as const satisfies readonly Role[];

export type RbacResource =
  | "tenants"
  | "contracts"
  | "payments"
  | "expenses"
  | "maintenance"
  | "notifications"
  | "properties"
  | "employees"
  | "clients"
  | "tasks";

export type RbacMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

const ALL_RESOURCES: readonly RbacResource[] = [
  "tenants",
  "contracts",
  "payments",
  "expenses",
  "maintenance",
  "notifications",
  "properties",
  "employees",
  "clients",
  "tasks",
] as const;

const EMPLOYEE_GET_RESOURCES = new Set<RbacResource>([
  "tenants",
  "contracts",
  "payments",
  "expenses",
  "maintenance",
  "notifications",
  "properties",
  "clients",
  "tasks",
]);

/** Operational resources EMPLOYEE may mutate (not finance, not employees, not tasks). */
const EMPLOYEE_MUTATE_RESOURCES = new Set<RbacResource>([
  "tenants",
  "contracts",
  "maintenance",
  "notifications",
  "properties",
  "clients",
]);

const FINANCE_RESOURCES = new Set<RbacResource>(["payments", "expenses"]);

export function isStaffRole(role: Role): boolean {
  return (STAFF_ROLES as readonly Role[]).includes(role);
}

export function isAdminRole(role: Role): boolean {
  return (ADMIN_ROLES as readonly Role[]).includes(role);
}

type AuthOk = { user: User; error?: undefined };
type AuthErr = { error: NextResponse; user?: undefined };
type AuthResult = AuthOk | AuthErr;

export async function requireRoles(
  req: NextRequest,
  roles: Role[]
): Promise<AuthResult> {
  const auth = await requireUser(req);
  if (auth.error) return auth;
  if (!roles.includes(auth.user.role)) {
    return { error: fail("Ruxsat yo‘q", 403) };
  }
  return { user: auth.user };
}

export async function requireStaffUser(req: NextRequest): Promise<AuthResult> {
  return requireRoles(req, [...STAFF_ROLES]);
}

export async function requireAnyStaffUser(
  req: NextRequest
): Promise<AuthResult> {
  return requireRoles(req, [...ANY_STAFF_ROLES]);
}

export async function requireAdminUser(req: NextRequest): Promise<AuthResult> {
  return requireRoles(req, [...ADMIN_ROLES]);
}

/**
 * Resource RBAC gate — 401 if unauthenticated, 403 if role cannot access.
 */
export async function requireResourceAccess(
  req: NextRequest,
  resource: RbacResource,
  method: RbacMethod
): Promise<AuthResult> {
  const auth = await requireUser(req);
  if (auth.error) return auth;
  if (!canAccessResource(auth.user.role, resource, method)) {
    return { error: fail("Ruxsat yo‘q", 403) };
  }
  return { user: auth.user };
}

/**
 * Resource × method matrix. See file header for full policy notes.
 */
export function canAccessResource(
  role: Role,
  resource: RbacResource,
  method: RbacMethod
): boolean {
  if (!ALL_RESOURCES.includes(resource)) return false;

  if (role === "SUPER_ADMIN" || role === "ADMIN" || role === "MANAGER") {
    return true;
  }

  if (role !== "EMPLOYEE") return false;

  // EMPLOYEE: no employees resource at all
  if (resource === "employees") return false;

  if (method === "GET") {
    return EMPLOYEE_GET_RESOURCES.has(resource);
  }

  // tasks: GET only for EMPLOYEE
  if (resource === "tasks") return false;

  // finance: no mutate
  if (FINANCE_RESOURCES.has(resource)) return false;

  return EMPLOYEE_MUTATE_RESOURCES.has(resource);
}
