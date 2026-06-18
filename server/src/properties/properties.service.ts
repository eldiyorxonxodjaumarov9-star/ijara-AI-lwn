import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, PropertyStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  buildPaginatedResult,
  PaginationDto,
} from '../common/dto/pagination.dto';
import { CreatePropertyDto, UpdatePropertyDto } from './dto/property.dto';

@Injectable()
export class PropertiesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreatePropertyDto) {
    return this.prisma.property.create({
      data: { ...dto, images: dto.images ?? [] },
    });
  }

  async findAll(query: PaginationDto, status?: PropertyStatus, region?: string) {
    const where: Prisma.PropertyWhereInput = {
      ...(status ? { status } : {}),
      ...(region ? { region } : {}),
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: 'insensitive' } },
              { address: { contains: query.search, mode: 'insensitive' } },
              { district: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.property.findMany({
        where,
        skip: query.skip,
        take: query.limit,
        orderBy: { [query.sortBy]: query.order },
      }),
      this.prisma.property.count({ where }),
    ]);

    return buildPaginatedResult(data, total, query.page, query.limit);
  }

  async findOne(id: string) {
    const property = await this.prisma.property.findUnique({
      where: { id },
      include: { contracts: true, maintenances: true },
    });
    if (!property) {
      throw new NotFoundException('Mulk topilmadi');
    }
    return property;
  }

  async update(id: string, dto: UpdatePropertyDto) {
    await this.ensureExists(id);
    return this.prisma.property.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.ensureExists(id);
    await this.prisma.property.delete({ where: { id } });
    return { message: 'Mulk o`chirildi' };
  }

  private async ensureExists(id: string) {
    const exists = await this.prisma.property.findUnique({ where: { id } });
    if (!exists) {
      throw new NotFoundException('Mulk topilmadi');
    }
  }
}
