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
      },
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
      }),
      this.prisma.expense.count({ where }),
    ]);

    return buildPaginatedResult(data, total, query.page, query.limit);
  }

  async findOne(id: string) {
    const expense = await this.prisma.expense.findUnique({ where: { id } });
    if (!expense) {
      throw new NotFoundException('Xarajat topilmadi');
    }
    return expense;
  }

  async update(id: string, dto: UpdateExpenseDto) {
    await this.findOne(id);
    const data: Prisma.ExpenseUpdateInput = { ...dto } as never;
    if (dto.date) data.date = new Date(dto.date);
    return this.prisma.expense.update({ where: { id }, data });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.expense.delete({ where: { id } });
    return { message: 'Xarajat o`chirildi' };
  }
}
