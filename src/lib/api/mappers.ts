import type { CollectionName } from "@/lib/data/store";
import type {
  CollectionEntity,
  AppNotification,
  Client,
  ClientStatus,
  Contract,
  ContractStatus,
  Expense,
  ExpenseCategory,
  Maintenance,
  MaintenanceStatus,
  NotificationType,
  Payment,
  PaymentMethod,
  Property,
  PropertyStatus,
  Tenant,
} from "@/types";

type Api = Record<string, unknown>;
const s = (v: unknown) => (v == null ? undefined : String(v));
const n = (v: unknown) => (v == null ? 0 : Number(v));

// ===== Enum mappings =====
const PROPERTY_STATUS_TO_API: Record<PropertyStatus, string> = {
  available: "AVAILABLE",
  rented: "RENTED",
  maintenance: "MAINTENANCE",
  reserved: "RESERVED",
};
const propertyStatusFromApi = (v: unknown): PropertyStatus =>
  (String(v ?? "AVAILABLE").toLowerCase() as PropertyStatus) ?? "available";

const CONTRACT_STATUS_TO_API: Record<ContractStatus, string> = {
  pending: "PENDING",
  active: "ACTIVE",
  expired: "EXPIRED",
  terminated: "TERMINATED",
};
const contractStatusFromApi = (v: unknown): ContractStatus =>
  String(v ?? "ACTIVE").toLowerCase() as ContractStatus;

const PAYMENT_METHOD_TO_API: Record<PaymentMethod, string> = {
  cash: "CASH",
  card: "CARD",
  bank: "BANK",
};
const paymentMethodFromApi = (v: unknown): PaymentMethod =>
  String(v ?? "CASH").toLowerCase() as PaymentMethod;

const EXPENSE_CATEGORY_TO_API: Record<ExpenseCategory, string> = {
  utilities: "UTILITIES",
  salary: "SALARY",
  tax: "TAX",
  repair: "REPAIR",
  marketing: "MARKETING",
  other: "OTHER",
};
const expenseCategoryFromApi = (v: unknown): ExpenseCategory =>
  String(v ?? "OTHER").toLowerCase() as ExpenseCategory;

const MAINT_STATUS_TO_API: Record<MaintenanceStatus, string> = {
  pending: "PENDING",
  in_progress: "IN_PROGRESS",
  completed: "COMPLETED",
};
const maintStatusFromApi = (v: unknown): MaintenanceStatus =>
  String(v ?? "PENDING").toLowerCase() as MaintenanceStatus;

const notifTypeFromApi = (v: unknown): NotificationType => {
  switch (String(v)) {
    case "SUCCESS":
      return "success";
    case "WARNING":
    case "CONTRACT_EXPIRED":
    case "LATE_PAYMENT":
      return "warning";
    default:
      return "info";
  }
};

const CLIENT_STATUS_TO_API: Record<ClientStatus, string> = {
  new: "NEW",
  matched: "MATCHED",
};
const clientStatusFromApi = (v: unknown): ClientStatus =>
  String(v ?? "NEW").toLowerCase() as ClientStatus;

// ===== Per-entity mapper config =====
export interface MapperConfig {
  path: string;
  fromApi: (item: Api) => CollectionEntity;
  toCreate: (data: Record<string, unknown>) => Api;
  toUpdate: (data: Record<string, unknown>) => Api;
}

const property: MapperConfig = {
  path: "/properties",
  fromApi: (i): Property => ({
    id: String(i.id),
    name: String(i.title ?? ""),
    address: String(i.address ?? ""),
    region: String(i.region ?? ""),
    district: String(i.district ?? ""),
    building: s(i.building),
    price: n(i.rentPrice),
    status: propertyStatusFromApi(i.status),
    description: s(i.description),
    images: (i.images as string[]) ?? [],
    rooms: n(i.rooms),
    area: n(i.area),
    createdAt: String(i.createdAt ?? new Date().toISOString()),
  }),
  toCreate: (d) => ({
    title: d.name,
    address: d.address,
    region: d.region,
    district: d.district,
    building: d.building || undefined,
    rentPrice: n(d.price),
    rooms: n(d.rooms),
    area: n(d.area),
    description: d.description || undefined,
    status: PROPERTY_STATUS_TO_API[d.status as PropertyStatus] ?? "AVAILABLE",
    images: (d.images as string[]) ?? [],
  }),
  toUpdate(d) {
    return this.toCreate(d);
  },
};

const tenant: MapperConfig = {
  path: "/tenants",
  fromApi: (i): Tenant => ({
    id: String(i.id),
    fullName: String(i.fullName ?? ""),
    phone: String(i.phone ?? ""),
    passport: String(i.passport ?? ""),
    telegram: s(i.telegram),
    email: s(i.email),
    rentAmount: n(i.rentAmount),
    contractDuration:
      i.contractDuration != null ? n(i.contractDuration) : undefined,
    entryDate: String(i.entryDate ?? i.createdAt ?? ""),
    paymentDueDate: s(i.paymentDueDate),
    createdAt: String(i.createdAt ?? new Date().toISOString()),
  }),
  toCreate: (d) => ({
    fullName: d.fullName,
    phone: d.phone,
    passport: d.passport,
    telegram: d.telegram || undefined,
    email: d.email || undefined,
    address: d.address || undefined,
    rentAmount: n(d.rentAmount),
    contractDuration:
      d.contractDuration != null ? n(d.contractDuration) : undefined,
    entryDate: d.entryDate,
    paymentDueDate: d.paymentDueDate,
  }),
  toUpdate(d) {
    return this.toCreate(d);
  },
};

const contract: MapperConfig = {
  path: "/contracts",
  fromApi: (i): Contract => {
    const prop = (i.property as Api) ?? {};
    const ten = (i.tenant as Api) ?? {};
    return {
      id: String(i.id),
      propertyId: String(i.propertyId ?? prop.id ?? ""),
      tenantId: String(i.tenantId ?? ten.id ?? ""),
      propertyName: s(prop.title),
      tenantName: s(ten.fullName),
      startDate: String(i.startDate ?? ""),
      endDate: String(i.endDate ?? ""),
      monthlyPayment: n(i.monthlyRent),
      deposit: n(i.deposit),
      status: contractStatusFromApi(i.status),
      notes: s(i.notes),
      createdAt: String(i.createdAt ?? new Date().toISOString()),
    };
  },
  toCreate: (d) => ({
    propertyId: d.propertyId,
    tenantId: d.tenantId,
    startDate: new Date(d.startDate as string).toISOString(),
    endDate: new Date(d.endDate as string).toISOString(),
    monthlyRent: n(d.monthlyPayment),
    deposit: n(d.deposit),
    status: CONTRACT_STATUS_TO_API[d.status as ContractStatus] ?? "ACTIVE",
    notes: d.notes || undefined,
  }),
  toUpdate(d) {
    return this.toCreate(d);
  },
};

const payment: MapperConfig = {
  path: "/payments",
  fromApi: (i): Payment => {
    const c = (i.contract as Api) ?? {};
    const prop = (c.property as Api) ?? {};
    const ten = (c.tenant as Api) ?? {};
    return {
      id: String(i.id),
      contractId: s(i.contractId),
      tenantName: s(ten.fullName),
      propertyName: s(prop.title),
      amount: n(i.amount),
      date: String(i.paymentDate ?? i.createdAt ?? ""),
      method: paymentMethodFromApi(i.paymentMethod),
      note: s(i.notes),
      createdAt: String(i.createdAt ?? new Date().toISOString()),
    };
  },
  toCreate: (d) => ({
    contractId: d.contractId,
    amount: n(d.amount),
    paymentDate: new Date((d.date as string) ?? Date.now()).toISOString(),
    paymentMethod: PAYMENT_METHOD_TO_API[d.method as PaymentMethod] ?? "CASH",
    notes: d.note || undefined,
  }),
  toUpdate(d) {
    return this.toCreate(d);
  },
};

const expense: MapperConfig = {
  path: "/expenses",
  fromApi: (i): Expense => ({
    id: String(i.id),
    category: expenseCategoryFromApi(i.category),
    amount: n(i.amount),
    date: String(i.date ?? i.createdAt ?? ""),
    receiptUrl: s(i.receiptUrl),
    note: s(i.notes ?? i.title),
    createdAt: String(i.createdAt ?? new Date().toISOString()),
  }),
  toCreate: (d) => ({
    title: (d.note as string) || (d.category as string) || "Xarajat",
    amount: n(d.amount),
    category: EXPENSE_CATEGORY_TO_API[d.category as ExpenseCategory] ?? "OTHER",
    date: new Date((d.date as string) ?? Date.now()).toISOString(),
    notes: d.note || undefined,
    receiptUrl: d.receiptUrl || undefined,
  }),
  toUpdate(d) {
    return this.toCreate(d);
  },
};

const maintenance: MapperConfig = {
  path: "/maintenance",
  fromApi: (i): Maintenance => {
    const prop = (i.property as Api) ?? {};
    return {
      id: String(i.id),
      propertyId: String(i.propertyId ?? prop.id ?? ""),
      propertyName: s(prop.title),
      issue: String(i.title ?? ""),
      status: maintStatusFromApi(i.status),
      cost: n(i.cost),
      images: (i.images as string[]) ?? [],
      createdAt: String(i.createdAt ?? new Date().toISOString()),
    };
  },
  toCreate: (d) => ({
    propertyId: d.propertyId,
    title: d.issue,
    description: d.issue,
    status: MAINT_STATUS_TO_API[d.status as MaintenanceStatus] ?? "PENDING",
    cost: n(d.cost),
    images: (d.images as string[]) ?? [],
  }),
  toUpdate(d) {
    return this.toCreate(d);
  },
};

const notification: MapperConfig = {
  path: "/notifications",
  fromApi: (i): AppNotification => ({
    id: String(i.id),
    title: String(i.title ?? ""),
    message: String(i.message ?? ""),
    type: notifTypeFromApi(i.type),
    read: Boolean(i.isRead),
    createdAt: String(i.createdAt ?? new Date().toISOString()),
  }),
  toCreate: (d) => ({
    title: d.title,
    message: d.message,
    type: "INFO",
  }),
  toUpdate: (d) => ({ ...d }),
};

const client: MapperConfig = {
  path: "/clients",
  fromApi: (i): Client => ({
    id: String(i.id),
    fullName: String(i.fullName ?? ""),
    phone: String(i.phone ?? ""),
    status: clientStatusFromApi(i.status),
    tenantId: s(i.tenantId),
    loginCount: n(i.loginCount) || 1,
    firstLoginAt: String(i.firstLoginAt ?? i.createdAt ?? new Date().toISOString()),
    lastLoginAt: String(i.lastLoginAt ?? i.createdAt ?? new Date().toISOString()),
    createdAt: String(i.createdAt ?? new Date().toISOString()),
  }),
  toCreate: (d) => ({
    fullName: d.fullName,
    phone: d.phone,
    status: CLIENT_STATUS_TO_API[d.status as ClientStatus] ?? "NEW",
    tenantId: d.tenantId || undefined,
    loginCount: n(d.loginCount) || 1,
    firstLoginAt: d.firstLoginAt,
    lastLoginAt: d.lastLoginAt,
  }),
  toUpdate(d) {
    return {
      fullName: d.fullName,
      phone: d.phone,
      status: d.status
        ? CLIENT_STATUS_TO_API[d.status as ClientStatus]
        : undefined,
      tenantId: d.tenantId,
      loginCount: d.loginCount != null ? n(d.loginCount) : undefined,
      lastLoginAt: d.lastLoginAt,
    };
  },
};

export const MAPPERS: Partial<Record<CollectionName, MapperConfig>> = {
  properties: property,
  tenants: tenant,
  contracts: contract,
  payments: payment,
  expenses: expense,
  maintenance,
  notifications: notification,
  clients: client,
};
