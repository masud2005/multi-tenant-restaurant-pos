import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateSupplierDto {
  @ApiProperty({
    description: 'Name of the supplier or vendor company',
    example: 'Karwan Bazar Meats',
    maxLength: 100,
  })
  @IsString({ message: 'Supplier name must be a string' })
  @IsNotEmpty({ message: 'Supplier name is required' })
  @MaxLength(100, { message: 'Supplier name cannot exceed 100 characters' })
  name: string;

  @ApiPropertyOptional({
    description: 'Name of the contact person / representative',
    example: 'Habib Mia',
    maxLength: 100,
  })
  @IsString({ message: 'Contact person must be a string' })
  @IsOptional()
  @MaxLength(100, { message: 'Contact name cannot exceed 100 characters' })
  contact?: string;

  @ApiPropertyOptional({
    description: 'Contact phone number',
    example: '+880 1811-200300',
    maxLength: 30,
  })
  @IsString({ message: 'Phone number must be a string' })
  @IsOptional()
  @MaxLength(30, { message: 'Phone number cannot exceed 30 characters' })
  phone?: string;

  @ApiPropertyOptional({
    description: 'Contact email address',
    example: 'orders@kbmeats.bd',
    maxLength: 100,
  })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @IsOptional()
  @MaxLength(100, { message: 'Email cannot exceed 100 characters' })
  email?: string;

  @ApiPropertyOptional({
    description: 'Physical or business address of the supplier',
    example: 'Plot 12, Karwan Bazar Wholesale Market, Dhaka',
    maxLength: 255,
  })
  @IsString({ message: 'Address must be a string' })
  @IsOptional()
  @MaxLength(255, { message: 'Address cannot exceed 255 characters' })
  address?: string;

  @ApiPropertyOptional({
    description: 'Comma-separated list of items or categories supplied',
    example: 'chicken, lamb, beef',
    maxLength: 255,
  })
  @IsString({ message: 'Supplies must be a string' })
  @IsOptional()
  @MaxLength(255, { message: 'Supplies cannot exceed 255 characters' })
  supplies?: string;

  @ApiPropertyOptional({
    description: 'Payment terms (e.g. Net 7, Net 14, Net 30, COD)',
    example: 'Net 14',
    maxLength: 50,
  })
  @IsString({ message: 'Payment terms must be a string' })
  @IsOptional()
  @MaxLength(50, { message: 'Payment terms cannot exceed 50 characters' })
  paymentTerms?: string;

  @ApiPropertyOptional({
    description: 'Whether the supplier is active and eligible for purchase orders',
    example: true,
    default: true,
  })
  @IsBoolean({ message: 'Active status must be a boolean' })
  @IsOptional()
  active?: boolean;
}
