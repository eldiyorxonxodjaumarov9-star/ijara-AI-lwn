import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';

@ApiTags('Dashboard')
@ApiBearerAuth()
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Asosiy statistik ko`rsatkichlar' })
  stats() {
    return this.dashboardService.getStats();
  }

  @Get('revenue-chart')
  @ApiOperation({ summary: 'Daromad/xarajat grafigi' })
  @ApiQuery({ name: 'months', required: false })
  revenueChart(@Query('months') months?: string) {
    return this.dashboardService.getRevenueChart(months ? Number(months) : 6);
  }

  @Get('property-status')
  @ApiOperation({ summary: 'Mulklar holati taqsimoti' })
  propertyStatus() {
    return this.dashboardService.getPropertyStatusChart();
  }
}
