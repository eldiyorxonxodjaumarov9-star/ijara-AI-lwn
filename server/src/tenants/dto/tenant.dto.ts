import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';

export class CreateTenantDto {
  @ApiProperty({ example: 'Alisher Karimov' })
  @IsString()
  @MinLength(2)
  fullName!: string;

  @ApiProperty({ example: '+998901234567' })
  @IsString()
  phone!: string;

  @ApiProperty({ example: 'AA1234567' })
  @IsString()
  passport!: string;

  @ApiPropertyOptional({ example: '@alisher' })
  @IsOptional()
  @IsString()
  telegram?: string;

  @ApiPropertyOptional({ example: 'alisher@example.com' })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string;
}

export class UpdateTenantDto extends PartialType(CreateTenantDto) {}
