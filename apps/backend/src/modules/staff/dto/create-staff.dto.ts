import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '../../../../prisma/generated/client';

export class CreateStaffDto {
  @ApiProperty({
    description: 'Full name of the staff member',
    example: 'John Doe',
  })
  @IsString()
  @IsNotEmpty({ message: 'Staff name is required' })
  name: string;

  @ApiProperty({
    description: 'Role of the staff member in the restaurant',
    enum: UserRole,
    example: UserRole.CASHIER,
  })
  @IsEnum(UserRole, {
    message: `Role must be one of: ${Object.values(UserRole).join(', ')}`,
  })
  role: UserRole;

  @ApiPropertyOptional({
    description: 'Email address of the staff member',
    example: 'staff@example.com',
  })
  @IsEmail({}, { message: 'Invalid email address' })
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({
    description: 'Phone number of the staff member',
    example: '+1234567890',
  })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({
    description: 'Hourly wage rate',
    example: 15.5,
    default: 0,
  })
  @IsNumber({}, { message: 'Hourly rate must be a valid number' })
  @Min(0, { message: 'Hourly rate cannot be negative' })
  @IsOptional()
  hourlyRate?: number;

  @ApiPropertyOptional({
    description: 'Array of branch IDs the staff has access to, or ["all"]',
    example: ['all'],
    type: [String],
  })
  @IsArray({ message: 'branchIds must be an array' })
  @IsString({ each: true, message: 'Each branchId must be a string' })
  @IsOptional()
  branchIds?: string[];

  @ApiPropertyOptional({
    description: 'Whether the staff member is active',
    example: true,
    default: true,
  })
  @IsBoolean({ message: 'Active must be a boolean' })
  @IsOptional()
  active?: boolean;

  @ApiPropertyOptional({
    description: 'Staff status (DRAFT, INVITED, ACTIVE, INACTIVE)',
    example: 'INVITED',
    default: 'INVITED',
  })
  @IsString()
  @IsOptional()
  status?: string;

  @ApiPropertyOptional({
    description: 'Whether to send an invitation email immediately',
    example: true,
    default: true,
  })
  @IsBoolean()
  @IsOptional()
  sendInvite?: boolean;
}
