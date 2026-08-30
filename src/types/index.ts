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
  createdAt: string;
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
  /** Ish boshlagan sana (ISO) */
  startedAt?: string | null;
  telegramChatId?: string | null;
  createdAt: string;
}

export type WorkTaskStatus =
  | "NEW"
  | "IN_PROGRESS"
  | "SUBMITTED"
  | "COMPLETED"
  | "NOT_COMPLETED"
  | "CANCELLED";

export type WorkTaskUnit = "SUNNUR" | "LWN";
export type WorkTaskPriority = "LOW" | "NORMAL" | "HIGH" | "URGENT";
export type WorkTaskSource = "WEB" | "TELEGRAM";

export interface WorkTaskAttachment {
  id: string;
  type: "IMAGE" | "VIDEO" | "DOCUMENT";
  /** Authenticated app proxy path — never a raw private Blob URL */
  downloadPath: string;
  originalName?: string | null;
  mimeType?: string | null;
  size?: number | null;
}

export interface WorkTaskReport {
  id: string;
  reportText?: string | null;
  submittedAt: string;
  reviewStatus: "SUBMITTED" | "APPROVED" | "RETURNED";
  reviewComment?: string | null;
  attachments?: WorkTaskAttachment[];
}

export interface WorkTask {
  id: string;
  title: string;
  description?: string | null;
  unit: WorkTaskUnit;
  unitLabel?: string;
  assignedEmployeeId: string;
  employeeName?: string;
  employeePhone?: string | null;
  employeePosition?: string | null;
  companyName?: string | null;
  createdByUserId: string;
  createdByName?: string;
  source: WorkTaskSource;
  priority: WorkTaskPriority;
  priorityLabel?: string;
  dueAt?: string | null;
  dueAtFormatted?: string;
  status: WorkTaskStatus;
  statusLabel?: string;
  overdue?: boolean;
  failureReason?: string | null;
  telegramDelivery?: "PENDING" | "SENT" | "FAILED";
  telegramLastError?: string | null;
  reports?: WorkTaskReport[];
  statusEvents?: Array<{
    id: string;
    fromStatus?: WorkTaskStatus | null;
    toStatus: WorkTaskStatus;
    comment?: string | null;
    createdAt: string;
    source: WorkTaskSource;
  }>;
  createdAt: string;
  updatedAt?: string;
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
