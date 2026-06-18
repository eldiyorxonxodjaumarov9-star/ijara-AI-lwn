import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../decorators/roles.decorator';
import { AuditService } from './audit.service';

@ApiTags('Audit Logs')
@ApiBearerAuth()
@Roles(Role.SUPER_ADMIN, Role.ADMIN)
@Controller('audit-logs')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @ApiOperation({ summary: 'Audit loglar (so`nggi yozuvlar)' })
  @ApiQuery({ name: 'limit', required: false })
  findAll(@Query('limit') limit?: string) {
    return this.auditService.findAll(limit ? Number(limit) : 100);
  }
}
