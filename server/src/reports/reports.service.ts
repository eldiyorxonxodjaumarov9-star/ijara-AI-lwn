import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const MONTHS = [
  'Yanvar',
  'Fevral',
  'Mart',
  'Aprel',
  'May',
  'Iyun',
  'Iyul',
  'Avgust',
  'Sentyabr',
  'Oktyabr',
  'Noyabr',
  'Dekabr',
];

export interface MonthlyRow {
  month: string;
  revenue: number;
  expense: number;
  profit: number;
}

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getMonthlyReport(year: number): Promise<{
    year: number;
    rows: MonthlyRow[];
    totals: { revenue: number; expense: number; tax: number; profit: number };
  }> {
    const start = new Date(year, 0, 1);
    const end = new Date(year + 1, 0, 1);

    const [payments, expenses, company] = await Promise.all([
      this.prisma.payment.findMany({
        where: { paymentDate: { gte: start, lt: end } },
        select: { amount: true, paymentDate: true },
      }),
      this.prisma.expense.findMany({
        where: { date: { gte: start, lt: end } },
        select: { amount: true, date: true },
      }),
      this.prisma.company.findFirst(),
    ]);

    const taxRate = company?.taxRate ?? 0.04;

    const rows: MonthlyRow[] = MONTHS.map((month, index) => {
      const revenue = payments
        .filter((p) => p.paymentDate.getMonth() === index)
        .reduce((sum, p) => sum + p.amount, 0);
      const expense = expenses
        .filter((e) => e.date.getMonth() === index)
        .reduce((sum, e) => sum + e.amount, 0);
      return { month, revenue, expense, profit: revenue - expense };
    });

    const revenue = rows.reduce((s, r) => s + r.revenue, 0);
    const expense = rows.reduce((s, r) => s + r.expense, 0);
    const tax = Math.round(revenue * taxRate);
    const profit = revenue - expense - tax;

    return { year, rows, totals: { revenue, expense, tax, profit } };
  }

  async getAnnualReport() {
    const payments = await this.prisma.payment.findMany({
      select: { amount: true, paymentDate: true },
    });
    const expenses = await this.prisma.expense.findMany({
      select: { amount: true, date: true },
    });

    const byYear: Record<number, { revenue: number; expense: number }> = {};
    for (const p of payments) {
      const y = p.paymentDate.getFullYear();
      byYear[y] ??= { revenue: 0, expense: 0 };
      byYear[y].revenue += p.amount;
    }
    for (const e of expenses) {
      const y = e.date.getFullYear();
      byYear[y] ??= { revenue: 0, expense: 0 };
      byYear[y].expense += e.amount;
    }

    return Object.entries(byYear)
      .map(([year, v]) => ({
        year: Number(year),
        revenue: v.revenue,
        expense: v.expense,
        profit: v.revenue - v.expense,
      }))
      .sort((a, b) => a.year - b.year);
  }
}
