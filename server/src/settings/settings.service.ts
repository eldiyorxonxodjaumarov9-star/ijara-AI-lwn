import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateCompanyDto } from './dto/company.dto';

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getCompany() {
    const company = await this.prisma.company.findFirst();
    if (company) {
      return company;
    }
    return this.prisma.company.create({ data: {} });
  }

  async updateCompany(dto: UpdateCompanyDto) {
    const existing = await this.getCompany();
    return this.prisma.company.update({
      where: { id: existing.id },
      data: dto,
    });
  }
}
