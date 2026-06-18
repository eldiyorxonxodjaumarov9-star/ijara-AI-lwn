import { Controller, Get, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Response } from 'express';
import { Roles } from '../common/decorators/roles.decorator';
import { ExportService } from './export.service';
import { ReportsService } from './reports.service';

@ApiTags('Reports')
@ApiBearerAuth()
@Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER)
@Controller('reports')
export class ReportsController {
  constructor(
    private readonly reportsService: ReportsService,
    private readonly exportService: ExportService,
  ) {}

  @Get('monthly')
  @ApiOperation({ summary: 'Oylik daromad/xarajat/foyda hisoboti' })
  @ApiQuery({ name: 'year', required: false })
  monthly(@Query('year') year?: string) {
    return this.reportsService.getMonthlyReport(
      year ? Number(year) : new Date().getFullYear(),
    );
  }

  @Get('annual')
  @ApiOperation({ summary: 'Yillik hisobot' })
  annual() {
    return this.reportsService.getAnnualReport();
  }

  @Get('export/pdf')
  @ApiOperation({ summary: 'PDF eksport' })
  @ApiQuery({ name: 'year', required: false })
  async exportPdf(@Res() res: Response, @Query('year') year?: string) {
    const y = year ? Number(year) : new Date().getFullYear();
    const report = await this.reportsService.getMonthlyReport(y);
    this.exportService.exportPdf(res, y, report.rows, report.totals);
  }

  @Get('export/excel')
  @ApiOperation({ summary: 'Excel eksport' })
  @ApiQuery({ name: 'year', required: false })
  async exportExcel(@Res() res: Response, @Query('year') year?: string) {
    const y = year ? Number(year) : new Date().getFullYear();
    const report = await this.reportsService.getMonthlyReport(y);
    await this.exportService.exportExcel(res, y, report.rows, report.totals);
  }
}
