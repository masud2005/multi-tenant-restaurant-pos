import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { PurchaseOrderStatus } from '../../../../prisma/generated/client';
import { CreatePurchaseOrderItemDto } from './create-purchase-order-item.dto';

export class CreatePurchaseOrderDto {
  @ApiProperty({
    description: 'Branch ID where items will be delivered',
    example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  })
  @IsUUID('4', { message: 'branchId must be a valid UUID' })
  @IsNotEmpty({ message: 'branchId is required' })
  branchId: string;

  @ApiProperty({
    description: 'Supplier / Vendor ID',
    example: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
  })
  @IsUUID('4', { message: 'supplierId must be a valid UUID' })
  @IsNotEmpty({ message: 'supplierId is required' })
  supplierId: string;

  @ApiPropertyOptional({
    description:
      'Custom purchase order number. If omitted, auto-generated (e.g. PO-YYYYMMDD-001)',
    example: 'PO-20261022-001',
  })
  @IsString({ message: 'poNumber must be a string' })
  @IsOptional()
  poNumber?: string;

  @ApiPropertyOptional({
    description: 'Expected delivery date and time (ISO string)',
    example: '2026-10-25T14:00:00.000Z',
  })
  @IsDateString({}, { message: 'expectedAt must be a valid ISO date string' })
  @IsOptional()
  expectedAt?: string;

  @ApiPropertyOptional({
    description: 'Alias for expectedAt date',
    example: '2026-10-25',
  })
  @IsString()
  @IsOptional()
  expectedDate?: string;

  @ApiPropertyOptional({
    description: 'Initial purchase order status (default: DRAFT)',
    enum: PurchaseOrderStatus,
    default: PurchaseOrderStatus.DRAFT,
  })
  @IsEnum(PurchaseOrderStatus, { message: 'Invalid purchase order status' })
  @IsOptional()
  status?: PurchaseOrderStatus;

  @ApiPropertyOptional({
    description: 'Optional notes or instructions for the supplier',
    example: 'Please deliver early morning before 10 AM',
  })
  @IsString({ message: 'notes must be a string' })
  @IsOptional()
  notes?: string;

  @ApiPropertyOptional({
    description: 'List of order items with ingredient, quantity, and unit cost',
    type: [CreatePurchaseOrderItemDto],
  })
  @IsArray({ message: 'items must be an array' })
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CreatePurchaseOrderItemDto)
  items?: CreatePurchaseOrderItemDto[];

  @ApiPropertyOptional({
    description: 'Alias for items (lines)',
    type: [CreatePurchaseOrderItemDto],
  })
  @IsArray({ message: 'lines must be an array' })
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CreatePurchaseOrderItemDto)
  lines?: CreatePurchaseOrderItemDto[];
}
