import type {
  Contract,
  Expense,
  Maintenance,
  AppNotification,
  Payment,
  Property,
  Tenant,
} from "@/types";

const now = new Date();
const iso = (daysAgo: number) =>
  new Date(now.getTime() - daysAgo * 86400000).toISOString();
const future = (days: number) =>
  new Date(now.getTime() + days * 86400000).toISOString();

export const seedProperties: Property[] = [
  {
    id: "p1",
    name: "Yunusobod Lux kvartira",
    address: "Amir Temur ko'chasi 12",
    region: "Toshkent shahri",
    district: "Yunusobod",
    price: 6000000,
    status: "rented",
    description: "Markazda joylashgan, ta'mirlangan 3 xonali kvartira.",
    images: [],
    rooms: 3,
    area: 86,
    createdAt: iso(120),
  },
  {
    id: "p2",
    name: "Chilonzor ofis",
    address: "Bunyodkor shoh ko'chasi 4",
    region: "Toshkent shahri",
    district: "Chilonzor",
    price: 9000000,
    status: "rented",
    description: "Biznes markazda zamonaviy ofis maydoni.",
    images: [],
    rooms: 5,
    area: 140,
    createdAt: iso(95),
  },
  {
    id: "p3",
    name: "Mirzo Ulug'bek studiya",
    address: "Mustaqillik 55",
    region: "Toshkent shahri",
    district: "Mirzo Ulug'bek",
    price: 3500000,
    status: "available",
    description: "Yangi qurilgan studiya kvartira.",
    images: [],
    rooms: 1,
    area: 42,
    createdAt: iso(60),
  },
  {
    id: "p4",
    name: "Samarqand savdo do'koni",
    address: "Registon ko'chasi 7",
    region: "Samarqand",
    district: "Markaz",
    price: 5000000,
    status: "maintenance",
    description: "Markaziy ko'chada savdo maydoni.",
    images: [],
    rooms: 2,
    area: 70,
    createdAt: iso(40),
  },
];

export const seedTenants: Tenant[] = [
  {
    id: "t1",
    fullName: "Alisher Karimov",
    phone: "+998901234567",
    passport: "AA1234567",
    telegram: "@alisher",
    email: "alisher@example.com",
    contractDuration: 12,
    rentAmount: 6000000,
    createdAt: iso(120),
  },
  {
    id: "t2",
    fullName: "Dilnoza Yusupova",
    phone: "+998935557788",
    passport: "AB7654321",
    telegram: "@dilnoza",
    email: "dilnoza@example.com",
    contractDuration: 24,
    rentAmount: 9000000,
    createdAt: iso(95),
  },
];

export const seedContracts: Contract[] = [
  {
    id: "c1",
    propertyId: "p1",
    propertyName: "Yunusobod Lux kvartira",
    tenantId: "t1",
    tenantName: "Alisher Karimov",
    startDate: iso(120),
    endDate: future(245),
    monthlyPayment: 6000000,
    deposit: 6000000,
    status: "active",
    createdAt: iso(120),
  },
  {
    id: "c2",
    propertyId: "p2",
    propertyName: "Chilonzor ofis",
    tenantId: "t2",
    tenantName: "Dilnoza Yusupova",
    startDate: iso(400),
    endDate: iso(15),
    monthlyPayment: 9000000,
    deposit: 9000000,
    status: "expired",
    createdAt: iso(400),
  },
];

export const seedPayments: Payment[] = [
  {
    id: "pay1",
    contractId: "c1",
    tenantId: "t1",
    tenantName: "Alisher Karimov",
    propertyName: "Yunusobod Lux kvartira",
    amount: 6000000,
    date: iso(5),
    method: "card",
    note: "Iyun oyi uchun",
    createdAt: iso(5),
  },
  {
    id: "pay2",
    contractId: "c1",
    tenantId: "t1",
    tenantName: "Alisher Karimov",
    propertyName: "Yunusobod Lux kvartira",
    amount: 6000000,
    date: iso(35),
    method: "cash",
    note: "May oyi uchun",
    createdAt: iso(35),
  },
  {
    id: "pay3",
    contractId: "c2",
    tenantId: "t2",
    tenantName: "Dilnoza Yusupova",
    propertyName: "Chilonzor ofis",
    amount: 9000000,
    date: iso(50),
    method: "bank",
    note: "Aprel oyi uchun",
    createdAt: iso(50),
  },
];

export const seedExpenses: Expense[] = [
  {
    id: "e1",
    category: "utilities",
    amount: 800000,
    date: iso(10),
    note: "Kommunal to'lovlar",
    createdAt: iso(10),
  },
  {
    id: "e2",
    category: "repair",
    amount: 1500000,
    date: iso(20),
    note: "Santexnika ta'miri",
    createdAt: iso(20),
  },
  {
    id: "e3",
    category: "salary",
    amount: 3000000,
    date: iso(30),
    note: "Xodimlar maoshi",
    createdAt: iso(30),
  },
];

export const seedMaintenance: Maintenance[] = [
  {
    id: "m1",
    propertyId: "p4",
    propertyName: "Samarqand savdo do'koni",
    issue: "Tom oqishi va elektr nosozligi",
    status: "in_progress",
    cost: 2500000,
    images: [],
    createdAt: iso(8),
  },
  {
    id: "m2",
    propertyId: "p1",
    propertyName: "Yunusobod Lux kvartira",
    issue: "Konditsioner ta'miri",
    status: "completed",
    cost: 600000,
    images: [],
    createdAt: iso(25),
  },
];

export const seedNotifications: AppNotification[] = [
  {
    id: "n1",
    title: "Shartnoma muddati tugadi",
    message: "Chilonzor ofis shartnomasi muddati o'tgan. Yangilash kerak.",
    type: "warning",
    read: false,
    createdAt: iso(1),
  },
  {
    id: "n2",
    title: "Yangi to'lov qabul qilindi",
    message: "Alisher Karimovdan 6 000 000 UZS to'lov keldi.",
    type: "success",
    read: false,
    createdAt: iso(5),
  },
  {
    id: "n3",
    title: "Telegram integratsiyasi",
    message: "Telegram bot ulanishi uchun token kiriting.",
    type: "telegram",
    read: true,
    createdAt: iso(12),
  },
];

export const SEED_MAP: Record<string, unknown[]> = {
  properties: seedProperties,
  tenants: seedTenants,
  contracts: seedContracts,
  payments: seedPayments,
  expenses: seedExpenses,
  maintenance: seedMaintenance,
  notifications: seedNotifications,
};
