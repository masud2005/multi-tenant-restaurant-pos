import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class UpdateTenantSettingsDto {
  @ApiPropertyOptional({ description: 'Restaurant display name', example: 'Saffron & Ember' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ description: 'Short restaurant tagline', example: 'Charcoal grill & curry house' })
  @IsString()
  @IsOptional()
  tagline?: string;

  @ApiPropertyOptional({ description: 'Short monogram initials (up to 4 chars)', example: 'SE' })
  @IsString()
  @IsOptional()
  initials?: string;

  @ApiPropertyOptional({ description: 'CSS/OKLCH accent color string', example: 'oklch(0.62 0.17 42)' })
  @IsString()
  @IsOptional()
  accent?: string;

  @ApiPropertyOptional({ description: 'Currency code', example: 'BDT' })
  @IsString()
  @IsOptional()
  currency?: string;

  @ApiPropertyOptional({ description: 'Locale formatting code', example: 'en-BD' })
  @IsString()
  @IsOptional()
  locale?: string;

  @ApiPropertyOptional({ description: 'Tax / VAT rate as decimal (e.g. 0.075 for 7.5%)', example: 0.075, minimum: 0, maximum: 1 })
  @IsNumber()
  @Min(0)
  @Max(1)
  @IsOptional()
  taxRate?: number;

  @ApiPropertyOptional({ description: 'Service charge rate as decimal (e.g. 0.05 for 5%)', example: 0.05, minimum: 0, maximum: 1 })
  @IsNumber()
  @Min(0)
  @Max(1)
  @IsOptional()
  serviceChargeRate?: number;

  @ApiPropertyOptional({ description: 'Footer message on thermal receipts', example: 'Thank you for dining with us!' })
  @IsString()
  @IsOptional()
  receiptFooter?: string;
}
