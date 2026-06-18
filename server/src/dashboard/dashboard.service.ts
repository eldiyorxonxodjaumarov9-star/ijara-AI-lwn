import { Injectable } from '@nestjs/common';
import { ContractStatus, PropertyStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getStats() {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const [
      totalProperties,
      rentedProperties,
      activeTenants,
      expiredContracts,
      monthlyPaymentsAgg,
      monthlyExpensesAgg,
      company,
    ] = await Promise.all([
      this.prisma.property.count(),
      this.prisma.property.count({ where: { status: PropertyStatus.RENTED } }),
      this.prisma.contract.count({ where: { status: ContractStatus.ACTIVE } }),
      this.prisma.contract.count({
        where: {
          OR: [
            { status: ContractStatus.EXPIRED },
            { status: ContractStatus.ACTIVE, endDate: { lt: now } },
          ],
        },
      }),
      this.prisma.payment.aggregate({
        _sum: { amount: true },
        where: { paymentDate: { gte: monthStart, lt: monthEnd } },
      }),
      this.prisma.expense.aggregate({
        _sum: { amount: true },
        where: { date: { gte: monthStart, lt: monthEnd } },
      }),
      this.prisma.company.findFirst(),
    ]);

    const monthlyRevenue = monthlyPaymentsAgg._sum.amount ?? 0;
    const monthlyExpenses = monthlyExpensesAgg._sum.amount ?? 0;
    const taxRate = company?.taxRate ?? 0.04;
    const tax = Math.round(monthlyRevenue * taxRate);
    const netProfit = monthlyRevenue - monthlyExpenses - tax;
    const occupancyRate =
      totalProperties > 0
        ? Math.round((rentedProperties / totalProperties) * 100)
        : 0;

    return {
      totalProperties,
      monthlyRevenue,
      monthlyExpenses,
      tax,
      netProfit,
      activeTenants,
      expiredContracts,
      occupancyRate,
    };
  }

  async getRevenueChart(months = 6) {
    const now = new Date();
    const result: { month: string; revenue: number; expense: number }[] = [];
    const labels = [
      'Yan', 'Fev', 'Mar', 'Apr', 'May', 'Iyun',
      'Iyul', 'Avg', 'Sen', 'Okt', 'Noy', 'Dek',
    ];

    for (let i = months - 1; i >= 0; i--) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      const [rev, exp] = await Promise.all([
        this.prisma.payment.aggregate({
          _sum: { amount: true },
          where: { paymentDate: { gte: start, lt: end } },
        }),
        this.prisma.expense.aggregate({
          _sum: { amount: true },
          where: { date: { gte: start, lt: end } },
        }),
      ]);
      result.push({
        month: labels[start.getMonth()],
        revenue: rev._sum.amount ?? 0,
        expense: exp._sum.amount ?? 0,
      });
    }
    return result;
  }

  async getPropertyStatusChart() {
    const grouped = await this.prisma.property.groupBy({
      by: ['status'],
      _count: { _all: true },
    });
    return grouped.map((g) => ({ status: g.status, count: g._count._all }));
  }
}
