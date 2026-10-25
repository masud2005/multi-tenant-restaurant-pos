import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { TableStatus } from '../../../../prisma/generated/client';

export class GetTablesQueryDto {
  @ApiPropertyOptional({
    description: 'Filter tables for a specific branch ID',
    example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  })
  @IsString()
  @IsOptional()
  branchId?: string;

  @ApiPropertyOptional({
    description: 'Filter tables by status (AVAILABLE, OCCUPIED, RESERVED, CLEANING)',
    enum: TableStatus,
    example: TableStatus.AVAILABLE,
  })
  @IsEnum(TableStatus, {
    message: `Status must be one of: ${Object.values(TableStatus).join(', ')}`,
  })
  @IsOptional()
  status?: TableStatus;

  @ApiPropertyOptional({
    description: 'Filter tables by floor section / area (e.g. Main hall, Terrace, VIP)',
    example: 'Main hall',
  })
  @IsString()
  @IsOptional()
  area?: string;

  @ApiPropertyOptional({
    description: 'Search tables by name / number (e.g. T-1, VIP)',
    example: 'T-1',
  })
  @IsString()
  @IsOptional()
  search?: string;
}
