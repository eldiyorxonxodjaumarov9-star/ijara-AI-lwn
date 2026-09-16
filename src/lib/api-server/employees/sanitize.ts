import type { Role } from "@prisma/client";

/** Roles that may read salary and other HR-private employee fields. */
const FULL_EMPLOYEE_FIELD_ROLES: Role[] = ["SUPER_ADMIN", "ADMIN", "MANAGER"];

const PRIVATE_EMPLOYEE_KEYS = [
  "monthlySalary",
  "salaryPayDay",
  "notes",
  "phone",
] as const;

/**
 * Strip salary / private HR fields for non-manager roles (defense in depth).
 * Managers and admins receive the full record unchanged.
 */
export function sanitizeEmployeeForRole<T extends Record<string, unknown>>(
  employee: T,
  role: Role
): Omit<T, (typeof PRIVATE_EMPLOYEE_KEYS)[number]> {
  if (FULL_EMPLOYEE_FIELD_ROLES.includes(role)) {
    return employee;
  }
  const copy = { ...employee };
  for (const key of PRIVATE_EMPLOYEE_KEYS) {
    delete copy[key];
  }
  return copy;
}

export function sanitizeEmployeesForRole<T extends Record<string, unknown>>(
  employees: T[],
  role: Role
): Array<Omit<T, (typeof PRIVATE_EMPLOYEE_KEYS)[number]>> {
  return employees.map((row) => sanitizeEmployeeForRole(row, role));
}
