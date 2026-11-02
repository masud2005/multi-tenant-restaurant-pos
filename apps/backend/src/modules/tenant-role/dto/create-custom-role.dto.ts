import { IsArray, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { UserRole } from '../../../../prisma/generated/client';

export class CreateCustomRoleDto {
  @ApiProperty({
    description: 'Name of the custom role',
    example: 'Head Sommelier',
  })
  @IsString()
  @IsNotEmpty({ message: 'Role name is required' })
  name: string;

  @ApiPropertyOptional({
    description: 'Description of role responsibilities',
    example: 'Specialized in beverage inventory, customer table service, and cellar management',
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    description: 'Badge accent color preset (purple, indigo, sky, teal, amber, rose)',
    example: 'purple',
    default: 'purple',
  })
  @IsString()
  @IsOptional()
  color?: string;

  @ApiPropertyOptional({
    description: 'Base role template (OWNER, MANAGER, CASHIER, KITCHEN, WAITER)',
    example: 'WAITER',
    default: 'CASHIER',
  })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.toUpperCase() : value))
  @IsEnum(UserRole, {
    message: `Base role must be one of: ${Object.values(UserRole).join(', ')}`,
  })
  baseRole?: UserRole;

  @ApiPropertyOptional({
    description: 'List of specific permissions assigned to this custom role',
    example: ['pos.use', 'orders.view', 'tables.view'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissions?: string[];
}

