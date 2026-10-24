import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsUUID, Min } from 'class-validator';

export class ReceiveGoodsLineDto {
  @ApiProperty({
    description: 'Ingredient ID (UUID)',
    example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  })
  @IsUUID('4', { message: 'ingredientId must be a valid UUID' })
  @IsNotEmpty({ message: 'ingredientId is required' })
  ingredientId: string;

  @ApiProperty({
    description: 'Quantity of items received in this delivery',
    example: 10,
  })
  @IsNumber({}, { message: 'qty must be a number' })
  @Min(0, { message: 'qty cannot be negative' })
  qty: number;

  @ApiPropertyOptional({
    description: 'Alias for qty',
    example: 10,
  })
  @IsNumber({}, { message: 'quantity must be a number' })
  @Min(0, { message: 'quantity cannot be negative' })
  @IsOptional()
  quantity?: number;

  @ApiProperty({
    description: 'Unit cost of the ingredient from supplier invoice',
    example: 95.0,
  })
  @IsNumber({}, { message: 'unitCost must be a number' })
  @Min(0, { message: 'unitCost cannot be negative' })
  unitCost: number;
}
