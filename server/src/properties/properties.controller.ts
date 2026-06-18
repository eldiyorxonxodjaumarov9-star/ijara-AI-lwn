import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { PropertyStatus, Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { PaginationDto } from '../common/dto/pagination.dto';
import { CreatePropertyDto, UpdatePropertyDto } from './dto/property.dto';
import { PropertiesService } from './properties.service';

@ApiTags('Properties')
@ApiBearerAuth()
@Controller('properties')
export class PropertiesController {
  constructor(private readonly propertiesService: PropertiesService) {}

  @Post()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER)
  @ApiOperation({ summary: 'Mulk qo`shish' })
  create(@Body() dto: CreatePropertyDto) {
    return this.propertiesService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Mulklar ro`yxati (filtr + qidiruv + pagination)' })
  @ApiQuery({ name: 'status', enum: PropertyStatus, required: false })
  @ApiQuery({ name: 'region', required: false })
  findAll(
    @Query() query: PaginationDto,
    @Query('status') status?: PropertyStatus,
    @Query('region') region?: string,
  ) {
    return this.propertiesService.findAll(query, status, region);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Bitta mulk' })
  findOne(@Param('id') id: string) {
    return this.propertiesService.findOne(id);
  }

  @Patch(':id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER)
  @ApiOperation({ summary: 'Mulkni yangilash' })
  update(@Param('id') id: string, @Body() dto: UpdatePropertyDto) {
    return this.propertiesService.update(id, dto);
  }

  @Delete(':id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @ApiOperation({ summary: 'Mulkni o`chirish' })
  remove(@Param('id') id: string) {
    return this.propertiesService.remove(id);
  }
}
