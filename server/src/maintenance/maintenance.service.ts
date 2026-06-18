import { Injectable, NotFoundException } from '@nestjs/common';
import { MaintenanceStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  buildPaginatedResult,
  PaginationDto,
} from '../common/dto/pagination.dto';
import {
  CreateMaintenanceDto,
  UpdateMaintenanceDto,
} from './dto/maintenance.dto';

const INCLUDE = {
  property: { select: { id: true, title: true } },
} satisfies Prisma.MaintenanceInclude;

@Injectable()
export class MaintenanceService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateMaintenanceDto) {
    return this.prisma.maintenance.create({
      data: {
        propertyId: dto.propertyId,
        title: dto.title,
        description: dto.description,
        cost: dto.cost ?? 0,
        status: dto.status ?? MaintenanceStatus.PENDING,
        images: dto.images ?? [],
      },
      include: INCLUDE,
    });
  }

  async findAll(query: PaginationDto, status?: MaintenanceStatus) {
    const where: Prisma.MaintenanceWhereInput = {
      ...(status ? { status } : {}),
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: 'insensitive' } },
              { description: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.maintenance.findMany({
        where,
        include: INCLUDE,
        skip: query.skip,
        take: query.limit,
        orderBy: { [query.sortBy]: query.order },
      }),
      this.prisma.maintenance.count({ where }),
    ]);

    return buildPaginatedResult(data, total, query.page, query.limit);
  }

  async findOne(id: string) {
    const record = await this.prisma.maintenance.findUnique({
      where: { id },
      include: INCLUDE,
    });
    if (!record) {
      throw new NotFoundException('Ta`mirlash yozuvi topilmadi');
    }
    return record;
  }

  async update(id: string, dto: UpdateMaintenanceDto) {
    await this.findOne(id);
    return this.prisma.maintenance.update({
      where: { id },
      data: dto,
      include: INCLUDE,
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.maintenance.delete({ where: { id } });
    return { message: 'Ta`mirlash yozuvi o`chirildi' };
  }
}
