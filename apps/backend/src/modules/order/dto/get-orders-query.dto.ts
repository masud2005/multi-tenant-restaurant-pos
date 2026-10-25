import { IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class GetOrdersQueryDto {
  @ApiPropertyOptional({
    description: 'Filter orders by branch ID',
    example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  })
  @Transform(({ value }) => (value === null || value === '' ? undefined : value))
  @IsString({ message: 'Branch ID must be a string' })
  @IsOptional()
  branchId?: string;

  @ApiPropertyOptional({
    description:
      'Filter orders by status: "active" (in_kitchen, ready, served), "all", or specific status (IN_KITCHEN, READY, SERVED, COMPLETED, CANCELLED)',
    example: 'active',
  })
  @Transform(({ value }) => (value === null || value === '' ? undefined : value))
  @IsString()
  @IsOptional()
  status?: string;

  @ApiPropertyOptional({
    description:
      'Filter orders by kitchen status: NEW, PREPARING, READY, BUMPED',
    example: 'NEW',
  })
  @Transform(({ value }) => (value === null || value === '' ? undefined : value))
  @IsString()
  @IsOptional()
  kitchenStatus?: string;

  @ApiPropertyOptional({
    description:
      'Filter orders by order type: DINE_IN, TAKEAWAY, PICKUP, COUNTER, DELIVERY',
    example: 'DINE_IN',
  })
  @Transform(({ value }) => (value === null || value === '' ? undefined : value))
  @IsString()
  @IsOptional()
  type?: string;

  @ApiPropertyOptional({
    description: 'Filter orders by dining table ID',
    example: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
  })
  @Transform(({ value }) => (value === null || value === '' ? undefined : value))
  @IsString({ message: 'Table ID must be a string' })
  @IsOptional()
  tableId?: string;

  @ApiPropertyOptional({
    description:
      'Search across order number, customer name, customer phone, or table name',
    example: '#1001',
  })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter orders created on or after this date (ISO string)',
    example: '2026-10-20T00:00:00.000Z',
  })
  @IsString()
  @IsOptional()
  startDate?: string;

  @ApiPropertyOptional({
    description: 'Filter orders created on or before this date (ISO string)',
    example: '2026-10-20T23:59:59.999Z',
  })
  @IsString()
  @IsOptional()
  endDate?: string;

  @ApiPropertyOptional({
    description: 'Maximum number of orders to return',
    example: 50,
  })
  @IsOptional()
  limit?: number;
}
