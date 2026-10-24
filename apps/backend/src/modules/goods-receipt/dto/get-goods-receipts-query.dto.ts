import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';

export class GetGoodsReceiptsQueryDto {
  @ApiPropertyOptional({
    description: 'Filter goods receipts for a specific branch ID',
    example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  })
  @IsString()
  @IsOptional()
  branchId?: string;

  @ApiPropertyOptional({
    description: 'Filter goods receipts by supplier ID',
    example: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
  })
  @IsString()
  @IsOptional()
  supplierId?: string;

  @ApiPropertyOptional({
    description: 'Filter goods receipts by purchase order ID',
    example: 'c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a33',
  })
  @IsString()
  @IsOptional()
  poId?: string;

  @ApiPropertyOptional({
    description: 'Search goods receipts by GRN number, receiver, notes, or PO number',
    example: 'GRN-2026',
  })
  @IsString({ message: 'Search term must be a string' })
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter receipts received after or on this date (ISO string)',
    example: '2026-10-01',
  })
  @IsString()
  @IsOptional()
  startDate?: string;

  @ApiPropertyOptional({
    description: 'Filter receipts received before or on this date (ISO string)',
    example: '2026-10-31',
  })
  @IsString()
  @IsOptional()
  endDate?: string;
}
