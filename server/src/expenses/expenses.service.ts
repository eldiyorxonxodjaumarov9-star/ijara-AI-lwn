import { Injectable, NotFoundException } from '@nestjs/common';
import { ExpenseCategory, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  buildPaginatedResult,
  PaginationDto,
} from '../common/dto/pagination.dto';
import { CreateExpenseDto, UpdateExpenseDto } from './dto/expense.dto';

@Injectable()
export class ExpensesService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateExpenseDto) {
    return this.prisma.expense.create({
      data: {
        title: dto.title,
        amount: dto.amount,
        category: dto.category ?? ExpenseCategory.OTHER,
        date: dto.date ? new Date(dto.date) : new Date(),
        notes: dto.notes,
        receiptUrl: dto.receiptUrl,
        employeeId: dto.employeeId || undefined,
        monthlyType: dto.monthlyType
          ? (dto.monthlyType as never)
          : undefined,
        monthlyTypeCustom: dto.monthlyTypeCustom || undefined,
      },
      include: { employee: true },
    });
  }

  async findAll(query: PaginationDto, category?: ExpenseCategory) {
    const where: Prisma.ExpenseWhereInput = {
      ...(category ? { category } : {}),
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: 'insensitive' } },
              { notes: { contains: query.search, mode: 'insensitive' } },
              {
                monthlyTypeCustom: {
                  contains: query.search,
                  mode: 'insensitive',
                },
              },
            ],
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.expense.findMany({
        where,
        skip: query.skip,
        take: query.limit,
        orderBy: { [query.sortBy]: query.order },
        include: { employee: true },
      }),
      this.prisma.expense.count({ where }),
    ]);

    return buildPaginatedResult(data, total, query.page, query.limit);
  }

  async findOne(id: string) {
    const expense = await this.prisma.expense.findUnique({
      where: { id },
      include: { employee: true },
    });
    if (!expense) {
      throw new NotFoundException('Xarajat topilmadi');
    }
    return expense;
  }

  async update(id: string, dto: UpdateExpenseDto) {
    await this.findOne(id);
    const data: Prisma.ExpenseUpdateInput = {};
    if (dto.title != null) data.title = dto.title;
    if (dto.amount != null) data.amount = dto.amount;
    if (dto.category != null) data.category = dto.category;
    if (dto.notes !== undefined) data.notes = dto.notes;
    if (dto.receiptUrl !== undefined) data.receiptUrl = dto.receiptUrl;
    if (dto.date) data.date = new Date(dto.date);
    if (dto.employeeId !== undefined) {
      data.employee = dto.employeeId
        ? { connect: { id: dto.employeeId } }
        : { disconnect: true };
    }
    if (dto.monthlyType !== undefined) {
      data.monthlyType = dto.monthlyType
        ? (dto.monthlyType as never)
        : null;
    }
    if (dto.monthlyTypeCustom !== undefined) {
      data.monthlyTypeCustom = dto.monthlyTypeCustom || null;
    }
    return this.prisma.expense.update({
      where: { id },
      data,
      include: { employee: true },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.expense.delete({ where: { id } });
    return { message: 'Xarajat o`chirildi' };
  }
}
