import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OrderType } from '../../../../prisma/generated/client';
import { CreateOrderLineDto } from './create-order-line.dto';
import { CreateOrderDiscountDto } from './create-order-discount.dto';
import { CreateOrderPaymentDto } from './create-order-payment.dto';

export class CreateOrderDto {
  @ApiPropertyOptional({
    description: 'Branch ID where this order is being placed (defaults to first active branch)',
    example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  })
  @Transform(({ value }) => (value === null || value === '' ? undefined : value))
  @IsString({ message: 'Branch ID must be a string' })
  @IsOptional()
  branchId?: string;

  @ApiProperty({
    description: 'Type of order (DINE_IN, TAKEAWAY, PICKUP, COUNTER, DELIVERY)',
    enum: OrderType,
    example: OrderType.DINE_IN,
    default: OrderType.DINE_IN,
  })
  @Transform(({ value }) =>
    typeof value === 'string'
      ? value.toUpperCase().replace('-', '_')
      : value,
  )
  @IsEnum(OrderType, {
    message: `Order type must be one of: ${Object.values(OrderType).join(', ')}`,
  })
  @IsNotEmpty({ message: 'Order type is required' })
  type: OrderType = OrderType.DINE_IN;

  @ApiPropertyOptional({
    description: 'Dining table ID (required for DINE_IN orders)',
    example: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
  })
  @Transform(({ value }) => (value === null || value === '' ? undefined : value))
  @IsString({ message: 'Table ID must be a string' })
  @IsOptional()
  tableId?: string;

  @ApiPropertyOptional({
    description: 'Dining table display name/number (e.g. T-1, VIP-2)',
    example: 'T-1',
    maxLength: 30,
  })
  @Transform(({ value }) => (value === null || value === '' ? undefined : value))
  @IsString()
  @IsOptional()
  @MaxLength(30, { message: 'Table name cannot exceed 30 characters' })
  tableName?: string;

  @ApiPropertyOptional({
    description: 'Registered customer ID (for loyalty & purchase history)',
    example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  })
  @Transform(({ value }) => (value === null || value === '' ? undefined : value))
  @IsString({ message: 'Customer ID must be a string' })
  @IsOptional()
  customerId?: string;

  @ApiPropertyOptional({
    description: 'Customer or guest name',
    example: 'Rahim Ahmed',
    maxLength: 60,
  })
  @IsString()
  @IsOptional()
  @MaxLength(60, { message: 'Customer name cannot exceed 60 characters' })
  customerName?: string;

  @ApiPropertyOptional({
    description: 'Customer contact phone number',
    example: '+8801712345678',
    maxLength: 20,
  })
  @IsString()
  @IsOptional()
  @MaxLength(20, { message: 'Customer phone cannot exceed 20 characters' })
  customerPhone?: string;

  @ApiPropertyOptional({
    description: 'Delivery address (required for DELIVERY orders)',
    example: 'House 12, Road 5, Dhanmondi, Dhaka',
    maxLength: 255,
  })
  @Transform(({ value }) => (value === null || value === '' ? undefined : value))
  @IsString()
  @IsOptional()
  @MaxLength(255, { message: 'Delivery address cannot exceed 255 characters' })
  deliveryAddress?: string;

  @ApiPropertyOptional({
    description: 'General notes or special instructions for the entire order',
    example: 'VIP customer, serve drinks first',
    maxLength: 255,
  })
  @Transform(({ value }) => (value === null || value === '' ? undefined : value))
  @IsString()
  @IsOptional()
  @MaxLength(255, { message: 'Order notes cannot exceed 255 characters' })
  notes?: string;

  @ApiPropertyOptional({
    description: 'Name or email of the staff member who took/created the order',
    example: 'Cashier Alice',
    maxLength: 60,
  })
  @Transform(({ value }) => (value === null || value === '' ? undefined : value))
  @IsString()
  @IsOptional()
  @MaxLength(60, { message: 'Created by cannot exceed 60 characters' })
  createdBy?: string;

  @ApiProperty({
    description: 'List of order line items (at least one item required)',
    type: [CreateOrderLineDto],
  })
  @IsArray({ message: 'Order lines must be an array' })
  @ArrayMinSize(1, { message: 'Order must contain at least one item' })
  @ValidateNested({ each: true })
  @Type(() => CreateOrderLineDto)
  lines: CreateOrderLineDto[];

  @ApiPropertyOptional({
    description: 'Optional discount applied to the order',
    type: CreateOrderDiscountDto,
  })
  @ValidateNested()
  @Type(() => CreateOrderDiscountDto)
  @IsOptional()
  discount?: CreateOrderDiscountDto;

  @ApiPropertyOptional({
    description: 'Optional immediate payment details (for "Send & Pay" action)',
    type: CreateOrderPaymentDto,
  })
  @ValidateNested()
  @Type(() => CreateOrderPaymentDto)
  @IsOptional()
  payment?: CreateOrderPaymentDto;
}
