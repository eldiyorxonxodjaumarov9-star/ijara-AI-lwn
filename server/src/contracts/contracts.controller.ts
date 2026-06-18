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
import { ContractStatus, Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { PaginationDto } from '../common/dto/pagination.dto';
import { CreateContractDto, UpdateContractDto } from './dto/contract.dto';
import { ContractsService } from './contracts.service';

@ApiTags('Contracts')
@ApiBearerAuth()
@Controller('contracts')
export class ContractsController {
  constructor(private readonly contractsService: ContractsService) {}

  @Post()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER)
  @ApiOperation({ summary: 'Shartnoma yaratish' })
  create(@Body() dto: CreateContractDto) {
    return this.contractsService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Shartnomalar ro`yxati' })
  @ApiQuery({ name: 'status', enum: ContractStatus, required: false })
  findAll(
    @Query() query: PaginationDto,
    @Query('status') status?: ContractStatus,
  ) {
    return this.contractsService.findAll(query, status);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Bitta shartnoma' })
  findOne(@Param('id') id: string) {
    return this.contractsService.findOne(id);
  }

  @Patch(':id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER)
  @ApiOperation({ summary: 'Shartnomani yangilash' })
  update(@Param('id') id: string, @Body() dto: UpdateContractDto) {
    return this.contractsService.update(id, dto);
  }

  @Delete(':id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @ApiOperation({ summary: 'Shartnomani o`chirish' })
  remove(@Param('id') id: string) {
    return this.contractsService.remove(id);
  }
}
