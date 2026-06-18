import { Injectable, NotFoundException } from '@nestjs/common';
import { PaymentMethod, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  buildPaginatedResult,
  PaginationDto,
} from '../common/dto/pagination.dto';
import { CreatePaymentDto, UpdatePaymentDto } from './dto/payment.dto';

const INCLUDE = {
  contract: {
    select: {
      id: true,
      monthlyRent: true,
      property: { select: { title: true } },
      tenant: { select: { fullName: true } },
    },
  },
} satisfies Prisma.PaymentInclude;

@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreatePaymentDto) {
    return this.prisma.payment.create({
      data: {
        contractId: dto.contractId,
        amount: dto.amount,
        paymentDate: dto.paymentDate ? new Date(dto.paymentDate) : new Date(),
        paymentMethod: dto.paymentMethod ?? PaymentMethod.CASH,
        notes: dto.notes,
      },
      include: INCLUDE,
    });
  }

  async findAll(query: PaginationDto, contractId?: string) {
    const where: Prisma.PaymentWhereInput = {
      ...(contractId ? { contractId } : {}),
      ...(query.search
        ? {
            OR: [
              { notes: { contains: query.search, mode: 'insensitive' } },
              {
                contract: {
                  tenant: {
                    fullName: { contains: query.search, mode: 'insensitive' },
                  },
                },
              },
            ],
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        include: INCLUDE,
        skip: query.skip,
        take: query.limit,
        orderBy: { [query.sortBy]: query.order },
      }),
      this.prisma.payment.count({ where }),
    ]);

    return buildPaginatedResult(data, total, query.page, query.limit);
  }

  async findOne(id: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
      include: INCLUDE,
    });
    if (!payment) {
      throw new NotFoundException('To`lov topilmadi');
    }
    return payment;
  }

  async update(id: string, dto: UpdatePaymentDto) {
    await this.ensureExists(id);
    const data: Prisma.PaymentUpdateInput = { ...dto } as never;
    if (dto.paymentDate) data.paymentDate = new Date(dto.paymentDate);
    return this.prisma.payment.update({ where: { id }, data, include: INCLUDE });
  }

  async remove(id: string) {
    await this.ensureExists(id);
    await this.prisma.payment.delete({ where: { id } });
    return { message: 'To`lov o`chirildi' };
  }

  private async ensureExists(id: string) {
    const exists = await this.prisma.payment.findUnique({ where: { id } });
    if (!exists) {
      throw new NotFoundException('To`lov topilmadi');
    }
  }
}
