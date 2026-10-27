import { IsNumberString, IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class GetAuditLogsQueryDto {
  @ApiPropertyOptional({
    description: 'Filter logs by entity type (order, inventory, staff, payment, table, menu, settings, branch)',
    example: 'order',
  })
  @IsString()
  @IsOptional()
  entity?: string;

  @ApiPropertyOptional({
    description: 'Filter logs by action type (create, update, delete, void, refund, stock_adjust, payment)',
    example: 'void',
  })
  @IsString()
  @IsOptional()
  action?: string;

  @ApiPropertyOptional({
    description: 'Filter logs by branch ID',
    example: 'branch-uuid',
  })
  @IsString()
  @IsOptional()
  branchId?: string;

  @ApiPropertyOptional({
    description: 'Search string matching summary, actorName, or details',
    example: 'void',
  })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({
    description: 'Start date filter (ISO string or YYYY-MM-DD)',
    example: '2026-10-01',
  })
  @IsString()
  @IsOptional()
  startDate?: string;

  @ApiPropertyOptional({
    description: 'End date filter (ISO string or YYYY-MM-DD)',
    example: '2026-10-31',
  })
  @IsString()
  @IsOptional()
  endDate?: string;

  @ApiPropertyOptional({
    description: 'Page number for pagination (default: 1)',
    example: '1',
  })
  @IsNumberString()
  @IsOptional()
  page?: string;

  @ApiPropertyOptional({
    description: 'Maximum audit records to return (default: 50)',
    example: '50',
  })
  @IsNumberString()
  @IsOptional()
  limit?: string;
}
