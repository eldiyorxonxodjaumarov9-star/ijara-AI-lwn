/**
 * In-memory stand-in for the Prisma models the agent tools read. Every query's
 * `where` is recorded so tests can prove the workspace filter is always present.
 */
type Row = Record<string, unknown>;
type Where = Record<string, unknown>;

function matchValue(actual: unknown, cond: unknown): boolean {
  if (cond === undefined) return true;
  if (cond === null) return actual === null || actual === undefined;
  if (cond instanceof Date) return actual instanceof Date && actual.getTime() === cond.getTime();
  if (typeof cond !== "object") return actual === cond;
  const c = cond as Record<string, unknown>;
  const cmp = (v: unknown) => (v instanceof Date ? v.getTime() : (v as number));
  const a = cmp(actual);
  if ("in" in c && !(c.in as unknown[]).includes(actual)) return false;
  if ("not" in c && (c.not === null ? actual == null : actual === c.not)) return false;
  if ("gt" in c && !(actual != null && a > cmp(c.gt))) return false;
  if ("gte" in c && !(actual != null && a >= cmp(c.gte))) return false;
  if ("lt" in c && !(actual != null && a < cmp(c.lt))) return false;
  if ("lte" in c && !(actual != null && a <= cmp(c.lte))) return false;
  return true;
}

export function matches(row: Row, where: Where = {}): boolean {
  return Object.entries(where).every(([k, v]) => matchValue(row[k], v));
}

export type FakeData = {
  workspaces: Row[];
  properties: Row[];
  tenants: Row[];
  contracts: Row[];
  payments: Row[];
  expenses: Row[];
  manualDebts: Row[];
  debtAdjustments: Row[];
  bookings: Row[];
  vehicles: Row[];
  vehicleRentals: Row[];
  workTasks: Row[];
  employees: Row[];
};

export function emptyData(): FakeData {
  return {
    workspaces: [],
    properties: [],
    tenants: [],
    contracts: [],
    payments: [],
    expenses: [],
    manualDebts: [],
    debtAdjustments: [],
    bookings: [],
    vehicles: [],
    vehicleRentals: [],
    workTasks: [],
    employees: [],
  };
}

export function createFakeDb(data: FakeData) {
  const wheres: { model: string; where: Where }[] = [];
  const byId = (rows: Row[], id: unknown) => rows.find((r) => r.id === id) ?? null;

  function enrich(model: string, row: Row): Row {
    if (model === "contract") {
      return {
        ...row,
        property: byId(data.properties, row.propertyId),
        tenant: byId(data.tenants, row.tenantId),
        debtAdjustments: data.debtAdjustments
          .filter((d) => d.contractId === row.id && d.type === "WRITE_OFF")
          .map((d) => ({ amount: d.amount })),
      };
    }
    if (model === "payment") {
      const contract = byId(data.contracts, row.contractId);
      return {
        ...row,
        contract: contract
          ? { ...contract, property: byId(data.properties, contract.propertyId), tenant: byId(data.tenants, contract.tenantId) }
          : null,
      };
    }
    if (model === "manualDebt") return { ...row, property: byId(data.properties, row.propertyId) };
    return row;
  }

  function orderRows(rows: Row[], orderBy: unknown) {
    const list = Array.isArray(orderBy) ? orderBy : orderBy ? [orderBy] : [];
    return [...rows].sort((a, b) => {
      for (const o of list as Record<string, "asc" | "desc">[]) {
        const [k, dir] = Object.entries(o)[0];
        const av = a[k] instanceof Date ? (a[k] as Date).getTime() : (a[k] as number | string);
        const bv = b[k] instanceof Date ? (b[k] as Date).getTime() : (b[k] as number | string);
        if (av === bv) continue;
        const r = av > bv ? 1 : -1;
        return dir === "desc" ? -r : r;
      }
      return 0;
    });
  }

  function model(name: string, rows: () => Row[]) {
    const filter = (where?: Where) => {
      wheres.push({ model: name, where: where ?? {} });
      return rows().filter((r) => matches(r, where));
    };
    return {
      findMany: async (args: { where?: Where; orderBy?: unknown; take?: number } = {}) => {
        const out = orderRows(filter(args.where), args.orderBy).map((r) => enrich(name, r));
        return args.take ? out.slice(0, args.take) : out;
      },
      findUnique: async (args: { where: Where }) => {
        wheres.push({ model: name, where: args.where });
        const r = rows().find((x) => matches(x, args.where));
        return r ? enrich(name, r) : null;
      },
      count: async (args: { where?: Where } = {}) => filter(args.where).length,
      groupBy: async (args: { by: string[]; where?: Where }) => {
        const key = args.by[0];
        const counts = new Map<unknown, number>();
        for (const r of filter(args.where)) counts.set(r[key], (counts.get(r[key]) ?? 0) + 1);
        return [...counts.entries()].map(([v, n]) => ({ [key]: v, _count: { _all: n } }));
      },
      aggregate: async (args: { where?: Where; _sum?: Record<string, true> }) => {
        const found = filter(args.where);
        const _sum: Record<string, number | null> = {};
        for (const f of Object.keys(args._sum ?? {})) {
          _sum[f] = found.length ? found.reduce((s, r) => s + Number(r[f] ?? 0), 0) : null;
        }
        return { _sum, _count: { _all: found.length } };
      },
    };
  }

  const db = {
    workspace: model("workspace", () => data.workspaces),
    property: model("property", () => data.properties),
    tenant: model("tenant", () => data.tenants),
    contract: model("contract", () => data.contracts),
    payment: model("payment", () => data.payments),
    expense: model("expense", () => data.expenses),
    manualDebt: model("manualDebt", () => data.manualDebts),
    booking: model("booking", () => data.bookings),
    vehicle: model("vehicle", () => data.vehicles),
    vehicleRental: model("vehicleRental", () => data.vehicleRentals),
    workTask: model("workTask", () => data.workTasks),
    employee: model("employee", () => data.employees),
  };
  return { db, wheres };
}

const d = (iso: string) => new Date(iso);

/**
 * Workspace "ws-a" (real-looking data) and "ws-b" (must never leak).
 * Now = 2026-10-07 12:00 Asia/Tashkent.
 */
export function seedTwoWorkspaces(): FakeData {
  const data = emptyData();
  const created = d("2026-01-01T00:00:00Z");
  data.workspaces.push(
    { id: "ws-a", name: "Alpha Ofis", industry: "OFFICE_RENTAL", isInternal: false, createdAt: d("2026-05-01T00:00:00Z") },
    { id: "ws-b", name: "Beta Hotel", industry: "HOTEL_HOSTEL", isInternal: false, createdAt: created }
  );
  const prop = (id: string, ws: string, title: string, status: string) => ({
    id, workspaceId: ws, title, status, createdAt: created, updatedAt: created,
  });
  data.properties.push(
    prop("p1", "ws-a", "A-101", "RENTED"),
    prop("p2", "ws-a", "A-102", "RENTED"),
    prop("p3", "ws-a", "A-103", "AVAILABLE"),
    prop("pb1", "ws-b", "B-SECRET-ROOM", "RENTED")
  );
  const tenant = (id: string, ws: string, fullName: string, leftAt: Date | null = null) => ({
    id, workspaceId: ws, fullName, phone: "+998900000000", passport: "AA0000000", rentAmount: 0,
    paymentDueDate: null, leftAt, createdAt: created, updatedAt: created, depositPaid: false, depositAmount: 0,
  });
  data.tenants.push(
    tenant("t1", "ws-a", "Ali Valiyev"),
    tenant("t2", "ws-a", "Vali Karimov", d("2026-09-01T00:00:00Z")),
    tenant("t3", "ws-a", "Guli Sobirova"),
    tenant("tb1", "ws-b", "Beta Secret Guest")
  );
  const contract = (id: string, ws: string, propertyId: string, tenantId: string, status: string, start: string, end: string, rent: number) => ({
    id, workspaceId: ws, propertyId, tenantId, status, startDate: d(start), endDate: d(end), monthlyRent: rent,
    deposit: 0, depositPaid: false, notes: null, createdAt: d(start), updatedAt: d(start),
  });
  data.contracts.push(
    contract("c1", "ws-a", "p1", "t1", "ACTIVE", "2026-07-01T00:00:00+05:00", "2027-06-30T00:00:00+05:00", 1_000_000),
    contract("c2", "ws-a", "p2", "t2", "TERMINATED", "2026-06-01T00:00:00+05:00", "2026-08-31T00:00:00+05:00", 500_000),
    contract("c3", "ws-a", "p2", "t3", "ACTIVE", "2026-09-01T00:00:00+05:00", "2027-08-31T00:00:00+05:00", 800_000),
    contract("cb1", "ws-b", "pb1", "tb1", "ACTIVE", "2026-01-01T00:00:00+05:00", "2026-12-31T00:00:00+05:00", 9_999_999)
  );
  const pay = (id: string, ws: string, contractId: string, amount: number, date: string, y: number, m: number) => ({
    id, workspaceId: ws, contractId, amount, paymentDate: d(date), periodYear: y, periodMonth: m,
    paymentMethod: "CASH", notes: null, createdAt: d(date), updatedAt: d(date),
  });
  data.payments.push(
    pay("pay1", "ws-a", "c1", 1_000_000, "2026-07-01T10:00:00+05:00", 2026, 7),
    pay("pay2", "ws-a", "c1", 1_000_000, "2026-08-01T10:00:00+05:00", 2026, 8),
    pay("pay3", "ws-a", "c1", 400_000, "2026-09-01T10:00:00+05:00", 2026, 9),
    pay("payb1", "ws-b", "cb1", 9_999_999, "2026-10-07T09:00:00+05:00", 2026, 10)
  );
  data.debtAdjustments.push({ id: "wo1", workspaceId: "ws-a", contractId: "c3", tenantId: "t3", amount: 50_000_000, type: "WRITE_OFF" });
  data.manualDebts.push(
    {
      id: "md1", workspaceId: "ws-a", propertyId: "p3", debtorName: "Qo‘lda Qarzdor", originalAmount: 300_000, paidAmount: 100_000,
      remainingAmount: 200_000, debtDate: d("2026-08-15T00:00:00+05:00"), status: "PARTIAL", createdAt: created,
    },
    {
      id: "md2", workspaceId: "ws-a", propertyId: null, debtorName: "Yopilgan", originalAmount: 100_000, paidAmount: 100_000,
      remainingAmount: 0, debtDate: d("2026-08-15T00:00:00+05:00"), status: "PAID", createdAt: created,
    },
    {
      id: "mdb", workspaceId: "ws-b", propertyId: null, debtorName: "Beta Manual", originalAmount: 7_777_777, paidAmount: 0,
      remainingAmount: 7_777_777, debtDate: d("2026-08-15T00:00:00+05:00"), status: "OPEN", createdAt: created,
    }
  );
  data.expenses.push(
    { id: "e1", workspaceId: "ws-a", title: "Gaz", amount: 150_000, category: "UTILITIES", monthlyType: "GAS", date: d("2026-10-03T10:00:00+05:00") },
    { id: "e2", workspaceId: "ws-a", title: "Soliq", amount: 250_000, category: "TAX", monthlyType: "TAX", date: d("2026-09-10T10:00:00+05:00") },
    { id: "eb", workspaceId: "ws-b", title: "Beta", amount: 5_555_555, category: "OTHER", monthlyType: null, date: d("2026-10-03T10:00:00+05:00") }
  );
  data.workTasks.push(
    { id: "w1", workspaceId: "ws-a", title: "Konditsioner", status: "NEW", priority: "HIGH", dueAt: d("2026-10-01T00:00:00Z") },
    { id: "wb", workspaceId: "ws-b", title: "Beta task", status: "NEW", priority: "URGENT", dueAt: null }
  );
  return data;
}

export const NOW = new Date("2026-10-07T12:00:00+05:00");
