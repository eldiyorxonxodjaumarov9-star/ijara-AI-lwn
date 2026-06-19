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
  fullName: string;
  phone: string;
  passport: string;
  telegram?: string;
  email?: string;
  contractDuration?: number;
  rentAmount: number;
  entryDate?: string;
  paymentDueDate?: string;
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
  | "other";

export interface Expense {
  id: string;
  category: ExpenseCategory;
  amount: number;
  date: string;
  receiptUrl?: string;
  note?: string;
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

export type ClientStatus = "new" | "matched";

/** Portal orqali ism+telefon bilan kirganlar (CRM) */
export interface Client {
  id: string;
  fullName: string;
  phone: string;
  status: ClientStatus;
  tenantId?: string;
  loginCount: number;
  firstLoginAt: string;
  lastLoginAt: string;
  createdAt: string;
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
