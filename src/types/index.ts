export type Role = "admin" | "manager" | "employee" | "tenant";

export type Language = "uz" | "ru" | "en" | "kk";

export interface AppUser {
  id: string;
  uid: string;
  email: string;
  displayName: string;
  phone?: string;
  role: Role;
  company?: string;
  photoURL?: string;
  language?: Language;
  tenantId?: string;
  createdAt?: string;
}

export type PropertyStatus = "available" | "rented" | "maintenance" | "reserved";

export interface Property {
  id: string;
  name: string;
  address: string;
  region: string;
  district: string;
  building?: string;
  price: number;
  status: PropertyStatus;
  description?: string;
  images: string[];
  rooms: number;
  area: number;
  createdAt: string;
  updatedAt?: string;
}

export interface Tenant {
  id: string;
  clientNumber?: string;
  fullName: string;
  phone: string;
  passport: string;
  login?: string;
  telegram?: string;
  email?: string;
  contractDuration?: number;
  rentAmount: number;
  entryDate?: string;
  paymentDueDate?: string;
  depositPaid?: boolean;
  depositAmount?: number;
  leftAt?: string;
  createdAt: string;
}

export type ContractStatus = "active" | "expired" | "terminated" | "pending";

export interface Contract {
  id: string;
  propertyId: string;
  propertyName?: string;
  tenantId: string;
  tenantName?: string;
  startDate: string;
  endDate: string;
  monthlyPayment: number;
  deposit?: number;
  depositPaid?: boolean;
  status: ContractStatus;
  signaturePlaceholder?: boolean;
  notes?: string;
  createdAt: string;
}

export type PaymentMethod = "cash" | "card" | "bank";

export interface Payment {
  id: string;
  contractId?: string;
  tenantId?: string;
  tenantName?: string;
  propertyName?: string;
  amount: number;
  date: string;
  /** Qaysi kalendar oyi uchun (1–12) */
  periodYear?: number;
  periodMonth?: number;
  method: PaymentMethod;
  note?: string;
  createdAt: string;
}

export type ExpenseCategory =
  | "utilities"
  | "salary"
  | "tax"
  | "repair"
  | "marketing"
  | "advance"
  | "other";

/** Oylik xarajat turi (frontend lowercase) */
export type MonthlyExpenseType =
  | "water"
  | "electricity"
  | "office"
  | "custom";

export type RecurrenceInterval =
  | "monthly"
  | "quarterly"
  | "semiannual"
  | "yearly";

export type ExpenseSource = "manual" | "recurring_expense";

export type RecurringOccurrenceStatus =
  | "paid"
  | "pending"
  | "overdue"
  | "due_today";

export interface Expense {
  id: string;
  category: ExpenseCategory;
  amount: number;
  date: string;
  receiptUrl?: string;
  note?: string;
  employeeId?: string;
  employeeName?: string;
  /** Hamkor kompaniya nomi (ishchi orqali) */
  companyName?: string;
  monthlyExpenseType?: MonthlyExpenseType | null;
  monthlyExpenseCustomName?: string | null;
  /** Ko‘rsatish/qidiruv uchun (Suv, Elektr… yoki custom nom) */
  monthlyExpenseLabel?: string;
  source?: ExpenseSource;
  recurringExpenseId?: string | null;
  paymentPeriodKey?: string | null;
  plannedDueDate?: string | null;
  createdAt: string;
}

export interface RecurringExpense {
  id: string;
  name: string;
  amount: number;
  category: ExpenseCategory;
  monthlyExpenseType?: MonthlyExpenseType | null;
  monthlyExpenseCustomName?: string | null;
  monthlyExpenseLabel?: string;
  notes?: string;
  firstPaymentDate: string;
  interval: RecurrenceInterval;
  active: boolean;
  companyId?: string | null;
  companyName?: string;
  createdAt: string;
}

export interface RecurringOccurrence {
  recurringExpenseId: string;
  name: string;
  category: ExpenseCategory;
  monthlyExpenseType?: MonthlyExpenseType | null;
  monthlyExpenseCustomName?: string | null;
  monthlyExpenseLabel?: string;
  paymentPeriodKey: string;
  dueDate: string;
  amount: number;
  paid: boolean;
  status: RecurringOccurrenceStatus;
  expenseId?: string;
  notes?: string;
  /** Haqiqiy to'langan summa (Expense.amount), agar to'langan bo'lsa */
  paidAmount?: number;
}

export interface RecurringPlanSummary {
  year: number;
  month: number;
  paymentPeriodKey: string;
  occurrences: RecurringOccurrence[];
  count: number;
  plannedTotal: number;
  paidTotal: number;
  remainingTotal: number;
  overdueCount: number;
}

export interface Company {
  id: string;
  name: string;
  phone?: string;
  notes?: string;
  active: boolean;
  createdAt: string;
}

export interface Employee {
  id: string;
  fullName: string;
  phone?: string;
  position?: string;
  monthlySalary: number;
  /** Har oy oylik beriladigan kun (1–31) */
  salaryPayDay?: number | null;
  active: boolean;
  notes?: string;
  companyId?: string | null;
  companyName?: string;
  createdAt: string;
}

export type MaintenanceStatus = "pending" | "in_progress" | "completed";

export interface Maintenance {
  id: string;
  propertyId: string;
  propertyName?: string;
  issue: string;
  status: MaintenanceStatus;
  cost: number;
  images: string[];
  createdAt: string;
}

export type NotificationType = "info" | "warning" | "success" | "telegram";

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  read: boolean;
  createdAt: string;
}

export type ClientStatus = "new" | "matched" | "archived";

/** Portal orqali ism+telefon bilan kirganlar (CRM) */
export interface Client {
  id: string;
  fullName: string;
  phone: string;
  status: ClientStatus;
  tenantId?: string;
  depositPaid?: boolean;
  depositAmount?: number;
  loginCount: number;
  firstLoginAt: string;
  lastLoginAt: string;
  createdAt: string;
}

export type ContactInterest =
  | "interested"
  | "called"
  | "thinking"
  | "visited"
  | "follow_up"
  | "not_interested";

/** Telefon / qiziqish kontaktlari */
export interface ContactLead {
  id: string;
  fullName: string;
  phone: string;
  interest: ContactInterest;
  notes?: string;
  source?: string;
  createdAt: string;
  updatedAt?: string;
}

/** Chiqib ketgan klientlar to'liq tarixi — to'lovlar saqlanadi */
export interface TenantArchive {
  id: string;
  clientNumber: string;
  tenantId?: string;
  contractId?: string;
  fullName: string;
  phone: string;
  passport?: string;
  propertyId?: string;
  propertyName: string;
  entryDate?: string;
  leaveDate: string;
  contractStart: string;
  contractEnd: string;
  monthlyRent: number;
  deposit: number;
  depositPaid: boolean;
  contractDuration?: number;
  totalPaid: number;
  paymentCount: number;
  notes?: string;
  createdAt: string;
}

/** Klient bazasi birlashtirilgan qator */
export type ClientDatabaseKind = "active" | "left" | "contact";

export interface ClientDatabaseRow {
  id: string;
  kind: ClientDatabaseKind;
  clientNumber?: string;
  fullName: string;
  phone: string;
  propertyName?: string;
  entryDate?: string;
  leaveDate?: string;
  totalPaid?: number;
  interest?: ContactInterest;
  notes?: string;
  passport?: string;
  monthlyRent?: number;
  contractDuration?: number;
  depositPaid?: boolean;
  deposit?: number;
  paymentCount?: number;
  contractStart?: string;
  contractEnd?: string;
}

export type AnalysisLevel = "high" | "medium" | "low" | "unknown";

/** AI Instagram biznes tahlili natijasi */
export interface BusinessAnalysis {
  id: string;
  instagramUrl: string;
  username: string;
  businessName?: string;
  businessType: string;
  summary: string;
  rentalFit: AnalysisLevel;
  rentalFitReason: string;
  footTraffic: AnalysisLevel;
  footTrafficReason: string;
  recommendations: string[];
  confidence: number;
  source: "ai" | "heuristic" | "demo";
  rawBio?: string;
  createdAt: string;
}

export interface CollectionEntity {
  id: string;
  createdAt: string;
}
