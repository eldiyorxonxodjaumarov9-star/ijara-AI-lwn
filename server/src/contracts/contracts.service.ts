import { Injectable, NotFoundException } from '@nestjs/common';
import { ContractStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  buildPaginatedResult,
  PaginationDto,
} from '../common/dto/pagination.dto';
import { CreateContractDto, UpdateContractDto } from './dto/contract.dto';

const INCLUDE = {
  property: { select: { id: true, title: true, address: true } },
  tenant: { select: { id: true, fullName: true, phone: true } },
} satisfies Prisma.ContractInclude;

@Injectable()
export class ContractsService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateContractDto) {
    return this.prisma.contract.create({
      data: {
        propertyId: dto.propertyId,
        tenantId: dto.tenantId,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        monthlyRent: dto.monthlyRent,
        deposit: dto.deposit ?? 0,
        status: dto.status ?? ContractStatus.ACTIVE,
        notes: dto.notes,
      },
      include: INCLUDE,
    });
  }

  async findAll(query: PaginationDto, status?: ContractStatus) {
    const where: Prisma.ContractWhereInput = {
      ...(status ? { status } : {}),
      ...(query.search
        ? {
            OR: [
              {
                property: {
                  title: { contains: query.search, mode: 'insensitive' },
                },
              },
              {
                tenant: {
                  fullName: { contains: query.search, mode: 'insensitive' },
                },
              },
            ],
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.contract.findMany({
        where,
        include: INCLUDE,
        skip: query.skip,
        take: query.limit,
        orderBy: { [query.sortBy]: query.order },
      }),
      this.prisma.contract.count({ where }),
    ]);

    return buildPaginatedResult(data, total, query.page, query.limit);
  }

  async findOne(id: string) {
    const contract = await this.prisma.contract.findUnique({
      where: { id },
      include: { ...INCLUDE, payments: true },
    });
    if (!contract) {
      throw new NotFoundException('Shartnoma topilmadi');
    }
    return contract;
  }

  async update(id: string, dto: UpdateContractDto) {
    await this.ensureExists(id);
    const data: Prisma.ContractUpdateInput = { ...dto } as never;
    if (dto.startDate) data.startDate = new Date(dto.startDate);
    if (dto.endDate) data.endDate = new Date(dto.endDate);
    return this.prisma.contract.update({
      where: { id },
      data,
      include: INCLUDE,
    });
  }

  async remove(id: string) {
    await this.ensureExists(id);
    await this.prisma.contract.delete({ where: { id } });
    return { message: 'Shartnoma o`chirildi' };
  }

  private async ensureExists(id: string) {
    const exists = await this.prisma.contract.findUnique({ where: { id } });
    if (!exists) {
      throw new NotFoundException('Shartnoma topilmadi');
    }
  }
}
