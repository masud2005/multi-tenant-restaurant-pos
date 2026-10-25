import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { DiscountKind } from '../../../../prisma/generated/client';

export enum PromotionStatusFilter {
  ALL = 'ALL',
  LIVE = 'LIVE',
  SCHEDULED = 'SCHEDULED',
  ENDED = 'ENDED',
  PAUSED = 'PAUSED',
  USED_UP = 'USED_UP',
}

export class GetPromotionsQueryDto {
  @ApiPropertyOptional({
    description: 'Search promotions by code or name (case-insensitive)',
    example: 'WEEKEND',
  })
  @IsString({ message: 'Search term must be a string' })
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter promotions by exact promo code',
    example: 'FESTIVE20',
  })
  @IsString()
  @IsOptional()
  code?: string;

  @ApiPropertyOptional({
    description: 'Filter by promotion lifecycle status',
    enum: PromotionStatusFilter,
    example: PromotionStatusFilter.LIVE,
    default: PromotionStatusFilter.ALL,
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.toUpperCase() : value,
  )
  @IsEnum(PromotionStatusFilter, {
    message: `Status must be one of: ${Object.values(PromotionStatusFilter).join(', ')}`,
  })
  @IsOptional()
  status?: PromotionStatusFilter = PromotionStatusFilter.ALL;

  @ApiPropertyOptional({
    description: 'Filter by discount kind (PERCENT or AMOUNT)',
    enum: DiscountKind,
    example: DiscountKind.PERCENT,
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.toUpperCase() : value,
  )
  @IsEnum(DiscountKind, {
    message: `Kind must be one of: ${Object.values(DiscountKind).join(', ')}`,
  })
  @IsOptional()
  kind?: DiscountKind;

  @ApiPropertyOptional({
    description: 'Page number for pagination',
    default: 1,
    minimum: 1,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Number of items per page (set limit=0 or omit for all)',
    default: 20,
    minimum: 0,
    maximum: 100,
  })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  @IsOptional()
  limit?: number = 20;
}
