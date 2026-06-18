import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("To'g'ri email kiriting"),
  password: z.string().min(6, "Parol kamida 6 ta belgidan iborat bo'lsin"),
});

export const registerSchema = z
  .object({
    displayName: z.string().min(2, "Ism kiriting"),
    company: z.string().optional(),
    email: z.string().email("To'g'ri email kiriting"),
    password: z.string().min(6, "Parol kamida 6 ta belgi"),
    confirmPassword: z.string(),
    role: z.enum(["admin", "manager", "employee"]).default("manager"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Parollar mos kelmadi",
    path: ["confirmPassword"],
  });

export const forgotPasswordSchema = z.object({
  email: z.string().email("To'g'ri email kiriting"),
});

export const tenantLoginSchema = z.object({
  fullName: z.string().min(2, "Ism familiyangizni kiriting"),
  phone: z.string().min(7, "Telefon raqamingizni kiriting"),
});

export type TenantLoginInput = z.infer<typeof tenantLoginSchema>;

export const propertySchema = z.object({
  name: z.string().min(2, "Nomini kiriting"),
  address: z.string().min(3, "Manzilni kiriting"),
  region: z.string().min(1, "Viloyatni tanlang"),
  district: z.string().min(1, "Tumanni kiriting"),
  price: z.coerce.number().min(0, "Narx noto'g'ri"),
  status: z.enum(["available", "rented", "maintenance", "reserved"]),
  rooms: z.coerce.number().min(0),
  area: z.coerce.number().min(0),
  description: z.string().optional(),
  images: z.array(z.string()).default([]),
});

export const tenantSchema = z.object({
  fullName: z.string().min(2, "F.I.O kiriting"),
  phone: z.string().min(7, "Telefon raqam kiriting"),
  passport: z.string().min(4, "Passport kiriting"),
  telegram: z.string().optional(),
  email: z.string().email("To'g'ri email").or(z.literal("")).optional(),
  contractDuration: z.coerce.number().min(0).optional(),
  rentAmount: z.coerce.number().min(0, "Summani kiriting"),
});

export const contractSchema = z.object({
  propertyId: z.string().min(1, "Mulkni tanlang"),
  tenantId: z.string().min(1, "Arendatorni tanlang"),
  startDate: z.string().min(1, "Boshlanish sanasi"),
  endDate: z.string().min(1, "Tugash sanasi"),
  monthlyPayment: z.coerce.number().min(0, "Oylik to'lov"),
  deposit: z.coerce.number().min(0).optional(),
  status: z.enum(["active", "expired", "terminated", "pending"]),
  notes: z.string().optional(),
});

export const paymentSchema = z.object({
  contractId: z.string().optional(),
  amount: z.coerce.number().min(1, "Summani kiriting"),
  date: z.string().min(1, "Sanani tanlang"),
  method: z.enum(["cash", "card", "bank"]),
  note: z.string().optional(),
});

export const expenseSchema = z.object({
  category: z.enum([
    "utilities",
    "salary",
    "tax",
    "repair",
    "marketing",
    "other",
  ]),
  amount: z.coerce.number().min(1, "Summani kiriting"),
  date: z.string().min(1, "Sanani tanlang"),
  receiptUrl: z.string().optional(),
  note: z.string().optional(),
});

export const maintenanceSchema = z.object({
  propertyId: z.string().min(1, "Mulkni tanlang"),
  issue: z.string().min(3, "Muammoni yozing"),
  status: z.enum(["pending", "in_progress", "completed"]),
  cost: z.coerce.number().min(0),
  images: z.array(z.string()).default([]),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type PropertyInput = z.infer<typeof propertySchema>;
export type TenantInput = z.infer<typeof tenantSchema>;
export type ContractInput = z.infer<typeof contractSchema>;
export type PaymentInput = z.infer<typeof paymentSchema>;
export type ExpenseInput = z.infer<typeof expenseSchema>;
export type MaintenanceInput = z.infer<typeof maintenanceSchema>;
