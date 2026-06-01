import type {
  ContractStatus,
  ExpenseCategory,
  MaintenanceStatus,
  PaymentMethod,
  PropertyStatus,
  Role,
} from "@/types";

export const APP_NAME = "ArendaHub";

export const UZ_REGIONS = [
  "Toshkent shahri",
  "Toshkent viloyati",
  "Samarqand",
  "Buxoro",
  "Andijon",
  "Farg'ona",
  "Namangan",
  "Qashqadaryo",
  "Surxondaryo",
  "Jizzax",
  "Sirdaryo",
  "Navoiy",
  "Xorazm",
  "Qoraqalpog'iston",
];

export const PROPERTY_STATUS_MAP: Record<
  PropertyStatus,
  { label: string; variant: "success" | "warning" | "secondary" | "destructive" }
> = {
  available: { label: "Bo'sh", variant: "success" },
  rented: { label: "Ijarada", variant: "secondary" },
  maintenance: { label: "Ta'mirda", variant: "warning" },
  reserved: { label: "Band qilingan", variant: "warning" },
};

export const CONTRACT_STATUS_MAP: Record<
  ContractStatus,
  { label: string; variant: "success" | "warning" | "secondary" | "destructive" }
> = {
  active: { label: "Faol", variant: "success" },
  expired: { label: "Muddati o'tgan", variant: "destructive" },
  terminated: { label: "Bekor qilingan", variant: "secondary" },
  pending: { label: "Kutilmoqda", variant: "warning" },
};

export const PAYMENT_METHOD_MAP: Record<PaymentMethod, string> = {
  cash: "Naqd",
  card: "Karta",
  bank: "Bank",
};

export const EXPENSE_CATEGORY_MAP: Record<ExpenseCategory, string> = {
  utilities: "Kommunal",
  salary: "Maosh",
  tax: "Soliq",
  repair: "Ta'mirlash",
  marketing: "Marketing",
  other: "Boshqa",
};

export const MAINTENANCE_STATUS_MAP: Record<
  MaintenanceStatus,
  { label: string; variant: "success" | "warning" | "secondary" }
> = {
  pending: { label: "Kutilmoqda", variant: "warning" },
  in_progress: { label: "Jarayonda", variant: "secondary" },
  completed: { label: "Tugatilgan", variant: "success" },
};

export const ROLE_MAP: Record<Role, string> = {
  admin: "Administrator",
  manager: "Menejer",
  employee: "Xodim",
};

export const TAX_RATE = 0.04; // 4% — soliqning shartli stavkasi
