import type { CollectionName } from "@/lib/data/store";
import { resolveMonthlyExpenseLabel } from "@/lib/monthly-expense-type";
import type {
  CollectionEntity,
  AppNotification,
  Client,
  ClientStatus,
  Contract,
  ContractStatus,
  Employee,
  Expense,
  ExpenseCategory,
  Company,
  Maintenance,
  MaintenanceStatus,
  MonthlyExpenseType,
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
  other: "OTHER",
};
const paymentMethodFromApi = (v: unknown): PaymentMethod => {
  const key = String(v ?? "CASH").toLowerCase();
  if (key === "cash" || key === "card" || key === "bank" || key === "other") {
    return key;
  }
  return "cash";
};

const EXPENSE_CATEGORY_TO_API: Record<ExpenseCategory, string> = {
  utilities: "UTILITIES",
  salary: "SALARY",
  tax: "TAX",
  repair: "REPAIR",
  marketing: "MARKETING",
  advance: "ADVANCE",
  other: "OTHER",
};
const expenseCategoryFromApi = (v: unknown): ExpenseCategory =>
  String(v ?? "OTHER").toLowerCase() as ExpenseCategory;

const MONTHLY_EXPENSE_TYPE_TO_API: Record<MonthlyExpenseType, string> = {
  water: "WATER",
  electricity: "ELECTRICITY",
  office: "OFFICE",
  custom: "CUSTOM",
};
const monthlyExpenseTypeFromApi = (
  v: unknown
): MonthlyExpenseType | undefined => {
  if (v == null || v === "") return undefined;
  const key = String(v).toLowerCase() as MonthlyExpenseType;
  return key in MONTHLY_EXPENSE_TYPE_TO_API ? key : undefined;
};

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
  archived: "ARCHIVED",
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
    // Faqat yuborilgan maydonlar — status o'zgartirish narx/maydonni 0 qilmasin
    const body: Record<string, unknown> = {};
    if (d.name != null) body.title = d.name;
    if (d.address != null) body.address = d.address;
    if (d.region != null) body.region = d.region;
    if (d.district != null) body.district = d.district;
    if (d.building !== undefined) body.building = d.building || undefined;
    if (d.price != null) body.rentPrice = n(d.price);
    if (d.rooms != null) body.rooms = n(d.rooms);
    if (d.area != null) body.area = n(d.area);
    if (d.description !== undefined) body.description = d.description || undefined;
    if (d.status != null) {
      body.status =
        PROPERTY_STATUS_TO_API[d.status as PropertyStatus] ?? "AVAILABLE";
    }
    if (d.images != null) body.images = d.images;
    return body;
  },
};

const tenant: MapperConfig = {
  path: "/tenants",
  fromApi: (i): Tenant => ({
    id: String(i.id),
    clientNumber: s(i.clientNumber),
    fullName: String(i.fullName ?? ""),
    phone: String(i.phone ?? ""),
    passport: String(i.passport ?? ""),
    login: s(i.login),
    telegram: s(i.telegram),
    email: s(i.email),
    rentAmount: n(i.rentAmount),
    contractDuration:
      i.contractDuration != null ? n(i.contractDuration) : undefined,
    entryDate: String(i.entryDate ?? i.createdAt ?? ""),
    paymentDueDate: s(i.paymentDueDate),
    depositPaid: Boolean(i.depositPaid),
    depositAmount: n(i.depositAmount),
    leftAt: s(i.leftAt),
    createdAt: String(i.createdAt ?? new Date().toISOString()),
  }),
  toCreate: (d) => ({
    fullName: d.fullName,
    phone: d.phone,
    passport: d.passport,
    login: d.login,
    password: (d as { password?: string }).password,
    telegram: d.telegram || undefined,
    email: d.email || undefined,
    address: d.address || undefined,
    rentAmount: n(d.rentAmount),
    contractDuration:
      d.contractDuration != null ? n(d.contractDuration) : undefined,
    entryDate: d.entryDate,
    paymentDueDate: d.paymentDueDate,
    depositPaid: Boolean(d.depositPaid),
    depositAmount: n(d.depositAmount),
  }),
  toUpdate(d) {
    const payload = this.toCreate(d) as Record<string, unknown>;
    if (!payload.password) delete payload.password;
    return payload;
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
      propertyName: s(i.propertyName ?? prop.title ?? prop.name),
      tenantName: s(ten.fullName),
      startDate: String(i.startDate ?? ""),
      endDate: String(i.endDate ?? ""),
      monthlyPayment: n(i.monthlyRent),
      deposit: n(i.deposit),
      depositPaid: Boolean(i.depositPaid),
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
    depositPaid: Boolean(d.depositPaid),
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
      tenantId: s(ten.id ?? c.tenantId),
      tenantName: s(ten.fullName),
      propertyName: s(i.propertyName ?? prop.title ?? prop.name),
      amount: n(i.amount),
      date: String(i.paymentDate ?? i.createdAt ?? ""),
      periodYear: i.periodYear != null ? n(i.periodYear) : undefined,
      periodMonth: i.periodMonth != null ? n(i.periodMonth) : undefined,
      method: paymentMethodFromApi(i.paymentMethod),
      note: s(i.notes),
      createdAt: String(i.createdAt ?? new Date().toISOString()),
    };
  },
  toCreate: (d) => ({
    contractId: d.contractId,
    amount: n(d.amount),
    paymentDate: new Date((d.date as string) ?? Date.now()).toISOString(),
    periodYear:
      d.periodYear != null && d.periodYear !== ""
        ? n(d.periodYear)
        : undefined,
    periodMonth:
      d.periodMonth != null && d.periodMonth !== ""
        ? n(d.periodMonth)
        : undefined,
    paymentMethod: PAYMENT_METHOD_TO_API[d.method as PaymentMethod] ?? "CASH",
    notes: d.note || undefined,
  }),
  toUpdate(d) {
    return this.toCreate(d);
  },
};

const expense: MapperConfig = {
  path: "/expenses",
  fromApi: (i): Expense => {
    const emp = (i.employee as Api) ?? {};
    const company = (emp.company as Api) ?? {};
    const monthlyExpenseType = monthlyExpenseTypeFromApi(
      i.monthlyType ?? i.monthlyExpenseType
    );
    const monthlyExpenseCustomName = s(
      i.monthlyTypeCustom ?? i.monthlyExpenseCustomName
    );
    return {
      id: String(i.id),
      category: expenseCategoryFromApi(i.category),
      amount: n(i.amount),
      date: String(i.date ?? i.createdAt ?? ""),
      receiptUrl: s(i.receiptUrl),
      note: s(i.notes ?? i.title),
      employeeId: s(i.employeeId ?? emp.id),
      employeeName: s(emp.fullName),
      companyName: s(company.name),
      monthlyExpenseType,
      monthlyExpenseCustomName,
      monthlyExpenseLabel: resolveMonthlyExpenseLabel(
        monthlyExpenseType,
        monthlyExpenseCustomName
      ),
      createdAt: String(i.createdAt ?? new Date().toISOString()),
    };
  },
  toCreate: (d) => {
    const monthlyExpenseType = monthlyExpenseTypeFromApi(d.monthlyExpenseType);
    const custom =
      monthlyExpenseType === "custom"
        ? String(d.monthlyExpenseCustomName ?? "").trim() || undefined
        : undefined;
    return {
      title: (d.note as string) || (d.category as string) || "Xarajat",
      amount: n(d.amount),
      category: EXPENSE_CATEGORY_TO_API[d.category as ExpenseCategory] ?? "OTHER",
      date: new Date((d.date as string) ?? Date.now()).toISOString(),
      notes: d.note || undefined,
      receiptUrl: d.receiptUrl || undefined,
      employeeId: d.employeeId || undefined,
      monthlyType: monthlyExpenseType
        ? MONTHLY_EXPENSE_TYPE_TO_API[monthlyExpenseType]
        : null,
      monthlyTypeCustom: custom ?? null,
      monthlyExpenseType,
      monthlyExpenseCustomName: custom,
    };
  },
  toUpdate(d) {
    return this.toCreate(d);
  },
};

const employee: MapperConfig = {
  path: "/employees",
  fromApi: (i): Employee => {
    const company = (i.company as Api) ?? {};
    return {
      id: String(i.id),
      fullName: String(i.fullName ?? ""),
      phone: s(i.phone),
      position: s(i.position),
      monthlySalary: n(i.monthlySalary),
      salaryPayDay:
        i.salaryPayDay != null && i.salaryPayDay !== ""
          ? n(i.salaryPayDay)
          : undefined,
      active: i.active == null ? true : Boolean(i.active),
      notes: s(i.notes),
      companyId: s(i.companyId ?? company.id),
      companyName: s(company.name),
      startedAt: s(i.startedAt) ?? null,
      createdAt: String(i.createdAt ?? new Date().toISOString()),
    };
  },
  toCreate: (d) => ({
    fullName: d.fullName,
    phone: d.phone || undefined,
    position: d.position || undefined,
    monthlySalary: n(d.monthlySalary),
    salaryPayDay:
      d.salaryPayDay != null && d.salaryPayDay !== ""
        ? n(d.salaryPayDay)
        : undefined,
    active: d.active == null ? true : Boolean(d.active),
    notes: d.notes || undefined,
    companyId:
      d.companyId === null || d.companyId === ""
        ? null
        : d.companyId || undefined,
    startedAt: d.startedAt || undefined,
  }),
  toUpdate(d) {
    return this.toCreate(d);
  },
};

const company: MapperConfig = {
  path: "/companies",
  fromApi: (i): Company => ({
    id: String(i.id),
    name: String(i.name ?? ""),
    phone: s(i.phone),
    notes: s(i.notes),
    active: i.active == null ? true : Boolean(i.active),
    createdAt: String(i.createdAt ?? new Date().toISOString()),
  }),
  toCreate: (d) => ({
    name: d.name,
    phone: d.phone || undefined,
    notes: d.notes || undefined,
    active: d.active == null ? true : Boolean(d.active),
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
      propertyName: s(i.propertyName ?? prop.title ?? prop.name),
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
    depositPaid: Boolean(i.depositPaid),
    depositAmount: n(i.depositAmount),
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
    depositPaid: d.depositPaid != null ? Boolean(d.depositPaid) : undefined,
    depositAmount: d.depositAmount != null ? n(d.depositAmount) : undefined,
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
      depositPaid:
        d.depositPaid != null ? Boolean(d.depositPaid) : undefined,
      depositAmount:
        d.depositAmount != null ? n(d.depositAmount) : undefined,
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
  employees: employee,
  companies: company,
  maintenance,
  notifications: notification,
  clients: client,
};
