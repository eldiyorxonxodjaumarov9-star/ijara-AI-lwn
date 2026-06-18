import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { UpdateCompanyDto } from './dto/company.dto';
import { SettingsService } from './settings.service';

@ApiTags('Settings')
@ApiBearerAuth()
@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get('company')
  @ApiOperation({ summary: 'Kompaniya ma`lumotlari' })
  getCompany() {
    return this.settingsService.getCompany();
  }

  @Patch('company')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @ApiOperation({ summary: 'Kompaniya ma`lumotlarini yangilash' })
  updateCompany(@Body() dto: UpdateCompanyDto) {
    return this.settingsService.updateCompany(dto);
  }
}
