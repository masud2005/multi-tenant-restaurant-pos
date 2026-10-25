import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateLoyaltyTierDto {
  @ApiProperty({
    description: 'Tier name (e.g. Bronze, Silver, Gold, Platinum, VIP)',
    example: 'Silver',
    maxLength: 50,
  })
  @IsString({ message: 'Tier name must be a string' })
  @IsNotEmpty({ message: 'Tier name is required' })
  @MaxLength(50, { message: 'Tier name cannot exceed 50 characters' })
  name: string;

  @ApiPropertyOptional({
    description: 'Minimum lifetime spend required to achieve this tier (Threshold)',
    example: 5000,
    default: 0,
  })
  @IsNumber({}, { message: 'Minimum spend must be a number' })
  @Min(0, { message: 'Minimum spend cannot be negative' })
  @IsOptional()
  minSpend?: number = 0;

  @ApiPropertyOptional({
    description: 'Minimum points earned required to achieve this tier (Threshold)',
    example: 100,
    default: 0,
  })
  @IsInt({ message: 'Minimum points must be an integer' })
  @Min(0, { message: 'Minimum points cannot be negative' })
  @IsOptional()
  minPoints?: number = 0;

  @ApiPropertyOptional({
    description:
      'Multiplier for earning loyalty points (e.g. 1.0 for normal, 1.25 for 25% bonus points)',
    example: 1.25,
    default: 1.0,
  })
  @IsNumber({}, { message: 'Point multiplier must be a number' })
  @Min(1.0, { message: 'Point multiplier must be at least 1.0' })
  @IsOptional()
  pointMultiplier?: number = 1.0;

  @ApiPropertyOptional({
    description: 'Permanent discount percentage for customers in this tier (%)',
    example: 5,
    default: 0,
  })
  @IsNumber({}, { message: 'Discount percent must be a number' })
  @Min(0, { message: 'Discount percent cannot be negative' })
  @IsOptional()
  discountPercent?: number = 0;

  @ApiPropertyOptional({
    description: 'Description of tier benefits and perks',
    example: 'Silver members earn 1.25x points on every dine-in & delivery order',
  })
  @IsString({ message: 'Description must be a string' })
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    description: 'HEX color code for UI badge display',
    example: '#94A3B8',
    default: '#3B82F6',
  })
  @IsString({ message: 'Color must be a string' })
  @IsOptional()
  color?: string = '#3B82F6';

  @ApiPropertyOptional({
    description: 'Sort hierarchy order (0 for lowest tier, higher for elite tiers)',
    example: 1,
    default: 0,
  })
  @IsInt({ message: 'Sort order must be an integer' })
  @IsOptional()
  sortOrder?: number = 0;

  @ApiPropertyOptional({
    description: 'Whether this tier rule is active',
    example: true,
    default: true,
  })
  @IsBoolean({ message: 'isActive must be a boolean' })
  @IsOptional()
  isActive?: boolean = true;
}
