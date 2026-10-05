import { isRentalIndustry, type RentalIndustry } from "@/lib/rental-industry";

/** UI wording only. IDs, API payloads and DB fields keep tenant/contract/property names. */
export type IndustryTerminology = {
  unitSingular: string;
  unitPlural: string;
  unitsPageTitle: string;
  unitsDescription: string;
  addUnitLabel: string;
  newUnitTitle: string;
  editUnitTitle: string;
  unitSearchPlaceholder: string;
  totalUnitsLabel: string;
  vacantUnitsLabel: string;
  occupiedUnitsLabel: string;
  emptyUnitsTitle: string;
  emptyUnitsText: string;
  unitDeletedToast: string;
  deleteUnitTitle: string;

  customerSingular: string;
  customerPlural: string;
  customersDescription: string;
  addCustomerLabel: string;
  newCustomerTitle: string;
  editCustomerTitle: string;
  customerDialogDescription: string;
  emptyCustomersTitle: string;
  emptyCustomersText: string;
  customerDeletedToast: string;
  deleteCustomerTitle: string;

  contractsLabel: string;
  contractSingular: string;
  contractsDescription: string;
  addContractLabel: string;
  newContractTitle: string;
  editContractTitle: string;
  contractDialogDescription: string;
  emptyContractsTitle: string;
  emptyContractsText: string;
  activeContractLabel: string;
  occupancyLabel: string;
};

const GENERIC: IndustryTerminology = {
  unitSingular: "Xona",
  unitPlural: "Xonalar",
  unitsPageTitle: "LWN xonalar",
  unitsDescription: "Live Work Network xonalarini boshqaring: narx, kv, holat va rasm.",
  addUnitLabel: "Xona qo'shish",
  newUnitTitle: "Yangi xona",
  editUnitTitle: "Xonani tahrirlash",
  unitSearchPlaceholder: "Xona raqami bo'yicha qidirish...",
  totalUnitsLabel: "Jami xonalar",
  vacantUnitsLabel: "Bo'sh xonalar",
  occupiedUnitsLabel: "Band xonalar",
  emptyUnitsTitle: "Xonalar yo'q",
  emptyUnitsText: "Birinchi LWN xonasini qo'shing.",
  unitDeletedToast: "Xona o'chirildi",
  deleteUnitTitle: "Xonani o'chirish",

  customerSingular: "Arendator",
  customerPlural: "Arendatorlar",
  customersDescription:
    "Faol ijarachilar. Chiqish — xona bo'shadi, ma'lumotlar Klient bazasida qoladi.",
  addCustomerLabel: "Arendator qo'shish",
  newCustomerTitle: "Yangi arendator",
  editCustomerTitle: "Arendatorni tahrirlash",
  customerDialogDescription: "Arendator ma'lumotlari, login/parol va LWN xonasini kiriting.",
  emptyCustomersTitle: "Arendatorlar yo'q",
  emptyCustomersText: "Birinchi arendatorni qo'shing.",
  customerDeletedToast: "Arendator o'chirildi",
  deleteCustomerTitle: "Arendatorni butunlay o'chirish",

  contractsLabel: "Shartnomalar",
  contractSingular: "Shartnoma",
  contractsDescription: "Ijara shartnomalarini boshqaring va PDF yarating.",
  addContractLabel: "Shartnoma",
  newContractTitle: "Yangi shartnoma",
  editContractTitle: "Shartnomani tahrirlash",
  contractDialogDescription: "Mulk va arendatorni tanlab shartnoma tuzing.",
  emptyContractsTitle: "Shartnomalar yo'q",
  emptyContractsText: "Birinchi shartnomangizni yarating.",
  activeContractLabel: "Faol shartnoma",
  occupancyLabel: "Bandlik",
};

type UnitWords = {
  one: string;
  many: string;
  /** Accusative, e.g. "xonani", "omborni". */
  acc: string;
};

function units(w: UnitWords): Partial<IndustryTerminology> {
  const lowerMany = w.many.toLowerCase();
  return {
    unitSingular: w.one,
    unitPlural: w.many,
    unitsPageTitle: w.many,
    unitsDescription: `${w.many}ni boshqaring: narx, maydon, holat va rasm.`,
    addUnitLabel: `${w.one} qo'shish`,
    newUnitTitle: `Yangi ${w.one.toLowerCase()}`,
    editUnitTitle: `${capitalize(w.acc)} tahrirlash`,
    unitSearchPlaceholder: "Nomi bo'yicha qidirish...",
    totalUnitsLabel: `Jami ${lowerMany}`,
    vacantUnitsLabel: `Bo'sh ${lowerMany}`,
    occupiedUnitsLabel: `Band ${lowerMany}`,
    emptyUnitsTitle: `${w.many} yo'q`,
    emptyUnitsText: `Birinchi ${w.one.toLowerCase()}ni qo'shing.`,
    unitDeletedToast: `${w.one} o'chirildi`,
    deleteUnitTitle: `${capitalize(w.acc)} o'chirish`,
  };
}

function customers(one: string, many: string, acc: string): Partial<IndustryTerminology> {
  return {
    customerSingular: one,
    customerPlural: many,
    customersDescription: `Faol ${many.toLowerCase()}. Chiqish — joy bo'shaydi, ma'lumotlar Klient bazasida qoladi.`,
    addCustomerLabel: `${one} qo'shish`,
    newCustomerTitle: `Yangi ${one.toLowerCase()}`,
    editCustomerTitle: `${capitalize(acc)} tahrirlash`,
    customerDialogDescription: `${one} ma'lumotlari va login/parolni kiriting.`,
    emptyCustomersTitle: `${many} yo'q`,
    emptyCustomersText: `Birinchi ${one.toLowerCase()}ni qo'shing.`,
    customerDeletedToast: `${one} o'chirildi`,
    deleteCustomerTitle: `${capitalize(acc)} butunlay o'chirish`,
  };
}

/** Neutral wording where the existing contract CRUD must not pose as bookings. */
const NEUTRAL_RECORDS: Partial<IndustryTerminology> = {
  contractsLabel: "Ijara yozuvlari",
  contractSingular: "Ijara yozuvi",
  contractsDescription: "Ijara yozuvlarini boshqaring va PDF yarating.",
  addContractLabel: "Yozuv",
  newContractTitle: "Yangi ijara yozuvi",
  editContractTitle: "Ijara yozuvini tahrirlash",
  contractDialogDescription: "Joy va mijozni tanlab ijara yozuvini yarating.",
  emptyContractsTitle: "Ijara yozuvlari yo'q",
  emptyContractsText: "Birinchi ijara yozuvini yarating.",
  activeContractLabel: "Faol ijara",
};

const OVERRIDES: Record<Exclude<RentalIndustry, "OTHER">, Partial<IndustryTerminology>> = {
  OFFICE_RENTAL: {
    ...units({ one: "Xona", many: "Xonalar", acc: "xonani" }),
    ...customers("Ijarachi", "Ijarachilar", "ijarachini"),
  },
  APARTMENT_RENTAL: {
    ...units({ one: "Obyekt", many: "Obyektlar", acc: "obyektni" }),
    ...customers("Ijarachi", "Ijarachilar", "ijarachini"),
  },
  HOTEL_HOSTEL: {
    ...units({ one: "Xona", many: "Xonalar", acc: "xonani" }),
    ...customers("Mehmon", "Mehmonlar", "mehmonni"),
    ...NEUTRAL_RECORDS,
  },
  CAR_RENTAL: {
    // No vehicle model yet: unit pages keep generic wording, never "Avtomobil".
    ...customers("Mijoz", "Mijozlar", "mijozni"),
    contractsLabel: "Ijaralar",
    contractSingular: "Ijara",
    contractsDescription: "Ijaralarni boshqaring va PDF yarating.",
    addContractLabel: "Ijara",
    newContractTitle: "Yangi ijara",
    editContractTitle: "Ijarani tahrirlash",
    contractDialogDescription: "Mijozni tanlab ijara yozuvini yarating.",
    emptyContractsTitle: "Ijaralar yo'q",
    emptyContractsText: "Birinchi ijarani yarating.",
    activeContractLabel: "Faol ijara",
  },
  RETAIL_RENTAL: {
    ...units({ one: "Savdo joyi", many: "Savdo joylari", acc: "savdo joyini" }),
    ...customers("Ijarachi", "Ijarachilar", "ijarachini"),
  },
  WAREHOUSE_RENTAL: {
    ...units({ one: "Ombor", many: "Omborlar", acc: "omborni" }),
    ...customers("Ijarachi", "Ijarachilar", "ijarachini"),
  },
  VILLA_RENTAL: {
    ...units({ one: "Dacha / Villa", many: "Dacha / Villalar", acc: "dacha / villani" }),
    ...customers("Mijoz", "Mijozlar", "mijozni"),
    ...NEUTRAL_RECORDS,
  },
  COMMERCIAL_RENTAL: {
    ...units({ one: "Obyekt", many: "Obyektlar", acc: "obyektni" }),
    ...customers("Ijarachi", "Ijarachilar", "ijarachini"),
  },
};

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function getIndustryTerminology(industry: unknown): IndustryTerminology {
  if (!isRentalIndustry(industry) || industry === "OTHER") return GENERIC;
  return { ...GENERIC, ...OVERRIDES[industry] };
}
