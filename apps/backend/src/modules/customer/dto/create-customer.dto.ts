import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCustomerDto {
  @ApiProperty({
    description: 'Customer full name (Required)',
    example: 'Tanvir Hossain',
    maxLength: 100,
  })
  @IsString({ message: 'Customer name must be a string' })
  @IsNotEmpty({ message: 'Customer name is required' })
  @MaxLength(100, { message: 'Name cannot exceed 100 characters' })
  name: string;

  @ApiProperty({
    description: 'Customer phone number (Required)',
    example: '+8801712345678',
    maxLength: 20,
  })
  @IsString({ message: 'Phone number must be a string' })
  @IsNotEmpty({ message: 'Customer phone number is required' })
  @MaxLength(20, { message: 'Phone number cannot exceed 20 characters' })
  phone: string;

  @ApiPropertyOptional({
    description: 'Delivery or residential address (Optional)',
    example: 'House 12, Road 5, Dhanmondi, Dhaka',
  })
  @IsString({ message: 'Address must be a string' })
  @IsOptional()
  @MaxLength(255, { message: 'Address cannot exceed 255 characters' })
  address?: string;

  @ApiPropertyOptional({
    description: 'Customer preferences or internal notes (Optional)',
    example: 'Regular guest, prefers outdoor seating',
  })
  @IsString({ message: 'Notes must be a string' })
  @IsOptional()
  notes?: string;

  @ApiPropertyOptional({
    description: 'Loyalty tier ID (Optional)',
    example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  })
  @IsUUID('4', { message: 'Tier ID must be a valid UUID' })
  @IsOptional()
  tierId?: string;

  @ApiPropertyOptional({
    description: 'Initial loyalty points to award (bonus/signup reward)',
    example: 50,
    default: 0,
  })
  @IsInt({ message: 'Initial points must be an integer' })
  @Min(0, { message: 'Initial points cannot be negative' })
  @IsOptional()
  initialPoints?: number;
}
