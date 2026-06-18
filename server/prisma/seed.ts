import {
  ContractStatus,
  ExpenseCategory,
  PaymentMethod,
  PrismaClient,
  PropertyStatus,
  Role,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  console.log('🌱 Seeding ArendaHub database...');

  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'superadmin@arendahub.uz';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'Admin@12345';
  const adminName = process.env.SEED_ADMIN_NAME ?? 'Super Admin';

  const password = await bcrypt.hash(adminPassword, 10);

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      password,
      fullName: adminName,
      role: Role.SUPER_ADMIN,
    },
  });
  console.log(`✅ Super Admin: ${admin.email} / ${adminPassword}`);

  await prisma.user.upsert({
    where: { email: 'manager@arendahub.uz' },
    update: {},
    create: {
      email: 'manager@arendahub.uz',
      password: await bcrypt.hash('Manager@123', 10),
      fullName: 'Dilnoza Yusupova',
      role: Role.MANAGER,
    },
  });

  await prisma.company.deleteMany();
  await prisma.company.create({
    data: {
      name: 'ArendaHub MChJ',
      email: 'info@arendahub.uz',
      phone: '+998712000000',
      address: 'Toshkent, Amir Temur 1',
      currency: 'UZS',
      taxRate: 0.04,
    },
  });

  // Demo properties
  const p1 = await prisma.property.create({
    data: {
      title: 'Yunusobod Lux kvartira',
      address: 'Amir Temur 12',
      region: 'Toshkent shahri',
      district: 'Yunusobod',
      rentPrice: 6000000,
      rooms: 3,
      area: 86,
      status: PropertyStatus.RENTED,
      description: 'Markazda joylashgan 3 xonali kvartira',
    },
  });

  const p2 = await prisma.property.create({
    data: {
      title: 'Chilonzor ofis',
      address: 'Bunyodkor 4',
      region: 'Toshkent shahri',
      district: 'Chilonzor',
      rentPrice: 9000000,
      rooms: 5,
      area: 140,
      status: PropertyStatus.RENTED,
    },
  });

  await prisma.property.create({
    data: {
      title: 'Mirzo Ulug`bek studiya',
      address: 'Mustaqillik 55',
      region: 'Toshkent shahri',
      district: 'Mirzo Ulug`bek',
      rentPrice: 3500000,
      rooms: 1,
      area: 42,
      status: PropertyStatus.AVAILABLE,
    },
  });

  // Demo tenants
  const t1 = await prisma.tenant.create({
    data: {
      fullName: 'Alisher Karimov',
      phone: '+998901234567',
      passport: 'AA1234567',
      telegram: '@alisher',
      email: 'alisher@example.com',
    },
  });

  const t2 = await prisma.tenant.create({
    data: {
      fullName: 'Sardor Tursunov',
      phone: '+998935557788',
      passport: 'AB7654321',
      telegram: '@sardor',
    },
  });

  // Contracts
  const now = new Date();
  const c1 = await prisma.contract.create({
    data: {
      propertyId: p1.id,
      tenantId: t1.id,
      startDate: new Date(now.getFullYear(), now.getMonth() - 4, 1),
      endDate: new Date(now.getFullYear(), now.getMonth() + 8, 1),
      monthlyRent: 6000000,
      deposit: 6000000,
      status: ContractStatus.ACTIVE,
    },
  });

  await prisma.contract.create({
    data: {
      propertyId: p2.id,
      tenantId: t2.id,
      startDate: new Date(now.getFullYear() - 1, now.getMonth(), 1),
      endDate: new Date(now.getFullYear(), now.getMonth() - 1, 1),
      monthlyRent: 9000000,
      deposit: 9000000,
      status: ContractStatus.EXPIRED,
    },
  });

  // Payments
  for (let i = 0; i < 4; i++) {
    await prisma.payment.create({
      data: {
        contractId: c1.id,
        amount: 6000000,
        paymentDate: new Date(now.getFullYear(), now.getMonth() - i, 5),
        paymentMethod: i % 2 === 0 ? PaymentMethod.CARD : PaymentMethod.CASH,
        notes: `${i + 1}-oy uchun to'lov`,
      },
    });
  }

  // Expenses
  await prisma.expense.createMany({
    data: [
      {
        title: 'Kommunal to`lovlar',
        amount: 800000,
        category: ExpenseCategory.UTILITIES,
        date: new Date(now.getFullYear(), now.getMonth(), 10),
      },
      {
        title: 'Xodimlar maoshi',
        amount: 3000000,
        category: ExpenseCategory.SALARY,
        date: new Date(now.getFullYear(), now.getMonth(), 1),
      },
      {
        title: 'Santexnika ta`miri',
        amount: 1500000,
        category: ExpenseCategory.REPAIR,
        date: new Date(now.getFullYear(), now.getMonth() - 1, 15),
      },
    ],
  });

  // Maintenance
  await prisma.maintenance.create({
    data: {
      propertyId: p1.id,
      title: 'Konditsioner ta`miri',
      description: 'Konditsioner sovutmayapti',
      cost: 600000,
      status: 'IN_PROGRESS',
    },
  });

  console.log('✅ Seed yakunlandi');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
