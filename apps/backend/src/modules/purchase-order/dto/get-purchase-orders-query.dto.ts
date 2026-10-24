import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { PurchaseOrderStatus } from '../../../../prisma/generated/client';

export class GetPurchaseOrdersQueryDto {
  @ApiPropertyOptional({
    description: 'Filter purchase orders for a specific branch ID',
    example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  })
  @IsString()
  @IsOptional()
  branchId?: string;

  @ApiPropertyOptional({
    description: 'Filter purchase orders by supplier ID',
    example: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
  })
  @IsString()
  @IsOptional()
  supplierId?: string;

  @ApiPropertyOptional({
    description: 'Filter purchase orders by status',
    enum: PurchaseOrderStatus,
    example: PurchaseOrderStatus.DRAFT,
  })
  @IsEnum(PurchaseOrderStatus, { message: 'Invalid purchase order status' })
  @IsOptional()
  status?: PurchaseOrderStatus;

  @ApiPropertyOptional({
    description: 'Search purchase orders by PO number or notes',
    example: 'PO-2026',
  })
  @IsString({ message: 'Search term must be a string' })
  @IsOptional()
  search?: string;
}
