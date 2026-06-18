import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { PropertyStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

export class CreatePropertyDto {
  @ApiProperty({ example: 'Yunusobod Lux kvartira' })
  @IsString()
  @MinLength(2)
  title!: string;

  @ApiProperty({ example: 'Amir Temur ko`chasi 12' })
  @IsString()
  address!: string;

  @ApiProperty({ example: 'Toshkent shahri' })
  @IsString()
  region!: string;

  @ApiProperty({ example: 'Yunusobod' })
  @IsString()
  district!: string;

  @ApiProperty({ example: 6000000 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  rentPrice!: number;

  @ApiProperty({ example: 3 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  rooms!: number;

  @ApiProperty({ example: 86 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  area!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: PropertyStatus, default: PropertyStatus.AVAILABLE })
  @IsOptional()
  @IsEnum(PropertyStatus)
  status?: PropertyStatus;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];
}

export class UpdatePropertyDto extends PartialType(CreatePropertyDto) {}
