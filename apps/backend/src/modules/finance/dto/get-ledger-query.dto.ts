import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class GetLedgerQueryDto {
  @ApiPropertyOptional({
    description: 'Filter ledger by specific branch ID',
    example: 'uuid',
  })
  @IsString()
  @IsOptional()
  branchId?: string;

  @ApiPropertyOptional({
    description: 'Filter by ledger entry kind (all, payment, refund)',
    example: 'payment',
    enum: ['all', 'payment', 'refund'],
  })
  @IsString()
  @IsOptional()
  kind?: 'all' | 'payment' | 'refund';

  @ApiPropertyOptional({
    description: 'Filter by payment method (cash, card, mobile)',
    example: 'cash',
  })
  @IsString()
  @IsOptional()
  method?: string;

  @ApiPropertyOptional({
    description: 'Filter by start date (ISO string or YYYY-MM-DD)',
    example: '2026-10-01',
  })
  @IsString()
  @IsOptional()
  startDate?: string;

  @ApiPropertyOptional({
    description: 'Filter by end date (ISO string or YYYY-MM-DD)',
    example: '2026-10-24',
  })
  @IsString()
  @IsOptional()
  endDate?: string;

  @ApiPropertyOptional({
    description: 'Search term across order number or customer name',
    example: '#1001',
  })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({
    description: 'Maximum number of records to return',
    example: 100,
    default: 200,
  })
  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  limit?: number;

  @ApiPropertyOptional({
    description: 'Offset for pagination',
    example: 0,
    default: 0,
  })
  @IsInt()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  offset?: number;
}
