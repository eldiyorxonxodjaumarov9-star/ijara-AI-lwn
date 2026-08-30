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
  login: z.string().min(3, "Login kiriting"),
  password: z.string().min(6, "Parol kamida 6 ta belgi"),
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
  building: z.string().optional(),
});

export const lwnRoomSchema = z.object({
  name: z.string().min(1, "Xona raqamini kiriting"),
  price: z.coerce.number().min(0, "Narx kiriting"),
  area: z.coerce.number().min(1, "Kv metr kiriting"),
  status: z.enum(["available", "rented", "maintenance", "reserved"]),
  images: z.array(z.string()).default([]),
  description: z.string().optional(),
});

export const tenantSchema = z.object({
  fullName: z.string().min(2, "F.I.O kiriting"),
  phone: z.string().min(7, "Telefon raqam kiriting"),
  login: z.string().min(3, "Login kamida 3 belgi"),
  password: z.string().optional(),
  rentAmount: z.coerce.number().min(0, "Summani kiriting"),
  entryDate: z.string().min(1, "Arenda kirish sanasini kiriting"),
  paymentDueDate: z.string().min(1, "To'lov muddatini kiriting"),
  contractDuration: z.coerce.number().min(1, "Kamida 1 oy"),
  depositPaid: z.coerce.boolean().optional(),
  depositAmount: z.coerce.number().min(0).optional(),
});

export const contractSchema = z.object({
  propertyId: z.string().min(1, "Mulkni tanlang"),
  tenantId: z.string().min(1, "Arendatorni tanlang"),
  startDate: z.string().min(1, "Boshlanish sanasi"),
  endDate: z.string().min(1, "Tugash sanasi"),
  monthlyPayment: z.coerce.number().min(0, "Oylik to'lov"),
  deposit: z.coerce.number().min(0).optional(),
  depositPaid: z.coerce.boolean().optional(),
  status: z.enum(["active", "expired", "terminated", "pending"]),
  notes: z.string().optional(),
});

export const paymentSchema = z.object({
  contractId: z.string().min(1, "Shartnomani tanlang"),
  amount: z.coerce.number().min(1, "Summani kiriting"),
  date: z.string().min(1, "Sanani tanlang"),
  periodYear: z.coerce.number().int().min(2000).max(2100).optional(),
  periodMonth: z.coerce.number().int().min(1).max(12).optional(),
  method: z.enum(["cash", "card", "bank"]),
  note: z.string().optional(),
});

export const expenseSchema = z
  .object({
    category: z.enum([
      "utilities",
      "salary",
      "tax",
      "repair",
      "marketing",
      "advance",
      "other",
    ]),
    amount: z.coerce.number().min(1, "Summani kiriting"),
    date: z.string().min(1, "Sanani tanlang"),
    receiptUrl: z.string().optional(),
    note: z.string().optional(),
    employeeId: z.string().optional(),
    monthlyExpenseType: z
      .enum(["water", "electricity", "office", "custom"])
      .optional()
      .nullable(),
    monthlyExpenseCustomName: z.string().optional().nullable(),
  })
  .superRefine((data, ctx) => {
    // Faqat "Boshqa" (custom) tanlanganda nom majburiy
    if (data.monthlyExpenseType === "custom") {
      const name = data.monthlyExpenseCustomName?.trim() ?? "";
      if (!name) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Xarajat nomini kiriting",
          path: ["monthlyExpenseCustomName"],
        });
      }
    }
  });

export const employeeSchema = z.object({
  fullName: z.string().min(2, "Ismni kiriting"),
  phone: z.string().optional(),
  position: z.string().optional(),
  monthlySalary: z.coerce.number().min(0).optional().default(0),
  salaryPayDay: z.coerce.number().int().min(1).max(31).optional().nullable(),
  active: z.coerce.boolean().default(true),
  notes: z.string().optional(),
  companyId: z.string().optional().nullable(),
});

export const companySchema = z.object({
  name: z.string().min(2, "Kompaniya nomini kiriting"),
  phone: z.string().optional(),
  notes: z.string().optional(),
  active: z.coerce.boolean().default(true),
});

export const recurringExpenseSchema = z
  .object({
    name: z.string().min(2, "Xarajat nomini kiriting"),
    amount: z.coerce.number().min(1, "Summani kiriting"),
    category: z
      .enum([
        "utilities",
        "salary",
        "tax",
        "repair",
        "marketing",
        "advance",
        "other",
      ])
      .optional(),
    monthlyExpenseType: z
      .enum(["water", "electricity", "office", "custom"])
      .optional()
      .nullable(),
    monthlyExpenseCustomName: z.string().optional().nullable(),
    notes: z.string().optional(),
    firstPaymentDate: z.string().min(1, "Birinchi to'lov sanasini tanlang"),
    interval: z.enum(["monthly", "quarterly", "semiannual", "yearly"]),
    active: z.coerce.boolean().default(true),
    companyId: z.string().optional().nullable(),
  })
  .superRefine((data, ctx) => {
    if (!data.monthlyExpenseType) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Oylik xarajat turini tanlang",
        path: ["monthlyExpenseType"],
      });
    }
    if (data.monthlyExpenseType === "custom") {
      const name = data.monthlyExpenseCustomName?.trim() ?? "";
      if (!name) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Xarajat nomini kiriting",
          path: ["monthlyExpenseCustomName"],
        });
      }
    }
  });

export const recurringPaySchema = z.object({
  recurringExpenseId: z.string().min(1),
  paymentPeriodKey: z
    .string()
    .regex(/^\d{4}-\d{2}$/, "Oy kaliti noto'g'ri (YYYY-MM)"),
  amount: z.coerce.number().min(1).optional(),
  date: z.string().optional(),
  notes: z.string().optional(),
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
export type LwnRoomInput = z.infer<typeof lwnRoomSchema>;
export type TenantInput = z.infer<typeof tenantSchema>;
export type ContractInput = z.infer<typeof contractSchema>;
export type PaymentInput = z.infer<typeof paymentSchema>;
export type ExpenseInput = z.infer<typeof expenseSchema>;
export type EmployeeInput = z.infer<typeof employeeSchema>;
export type CompanyInput = z.infer<typeof companySchema>;
export type RecurringExpenseInput = z.infer<typeof recurringExpenseSchema>;
export type RecurringPayInput = z.infer<typeof recurringPaySchema>;
export type MaintenanceInput = z.infer<typeof maintenanceSchema>;
