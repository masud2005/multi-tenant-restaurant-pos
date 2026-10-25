import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DiscountKind } from '../../../../prisma/generated/client';

export class CreatePromotionDto {
  @ApiProperty({
    description: 'Promotion name (Required)',
    example: 'Weekend Special 20%',
    maxLength: 60,
  })
  @IsString({ message: 'Name must be a string' })
  @IsNotEmpty({ message: 'Name is required' })
  @MaxLength(60, { message: 'Name cannot exceed 60 characters' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  name: string;

  @ApiProperty({
    description: 'Promo code (3-16 uppercase alphanumeric characters)',
    example: 'WEEKEND20',
  })
  @IsString({ message: 'Code must be a string' })
  @IsNotEmpty({ message: 'Code is required' })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @Matches(/^[A-Z0-9]{3,16}$/, {
    message: 'Code must be 3–16 letters or digits (alphanumeric)',
  })
  code: string;

  @ApiProperty({
    description: 'Discount type (PERCENT or AMOUNT)',
    enum: DiscountKind,
    example: DiscountKind.PERCENT,
    default: DiscountKind.PERCENT,
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.toUpperCase() : value,
  )
  @IsEnum(DiscountKind, {
    message: `Discount kind must be one of: ${Object.values(DiscountKind).join(', ')}`,
  })
  @IsNotEmpty({ message: 'Discount kind is required' })
  kind: DiscountKind;

  @ApiProperty({
    description: 'Discount value (Percentage or flat amount in BDT)',
    example: 20,
    minimum: 0.01,
  })
  @Type(() => Number)
  @IsNumber({}, { message: 'Value must be a valid number' })
  @Min(0.01, { message: 'Discount value must be greater than 0' })
  value: number;

  @ApiPropertyOptional({
    description: 'Minimum spend required to apply this promotion (BDT)',
    example: 500,
    default: 0,
  })
  @Type(() => Number)
  @IsNumber({}, { message: 'Minimum spend must be a valid number' })
  @Min(0, { message: 'Minimum spend cannot be negative' })
  @IsOptional()
  minSpend?: number;

  @ApiPropertyOptional({
    description: 'Start date/time (ISO 8601 string or YYYY-MM-DD)',
    example: '2026-10-24T00:00:00.000Z',
  })
  @IsString({ message: 'Start date must be a valid date string' })
  @IsOptional()
  startsAt?: string;

  @ApiProperty({
    description: 'End date/time (ISO 8601 string or YYYY-MM-DD)',
    example: '2026-11-24T23:59:59.000Z',
  })
  @IsString({ message: 'End date must be a valid date string' })
  @IsNotEmpty({ message: 'End date is required' })
  endsAt: string;

  @ApiPropertyOptional({
    description: 'Maximum number of times this promo can be used across all orders (null for unlimited)',
    example: 100,
  })
  @Type(() => Number)
  @IsInt({ message: 'Max uses must be an integer' })
  @Min(1, { message: 'Max uses must be at least 1' })
  @IsOptional()
  maxUses?: number | null;

  @ApiPropertyOptional({
    description: 'Whether the promotion is active and usable at checkout',
    example: true,
    default: true,
  })
  @IsBoolean({ message: 'Active must be a boolean' })
  @IsOptional()
  active?: boolean;
}
