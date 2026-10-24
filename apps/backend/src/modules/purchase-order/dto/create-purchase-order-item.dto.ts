import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsPositive, IsUUID, Min } from 'class-validator';

export class CreatePurchaseOrderItemDto {
  @ApiProperty({
    description: 'Ingredient ID (UUID)',
    example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  })
  @IsUUID('4', { message: 'ingredientId must be a valid UUID' })
  @IsNotEmpty({ message: 'ingredientId is required' })
  ingredientId: string;

  @ApiProperty({
    description: 'Quantity to purchase',
    example: 25.5,
  })
  @IsNumber({}, { message: 'quantity must be a number' })
  @IsPositive({ message: 'quantity must be greater than 0' })
  quantity: number;

  @ApiPropertyOptional({
    description: 'Alias for quantity (qty)',
    example: 25.5,
  })
  @IsNumber({}, { message: 'qty must be a number' })
  @IsPositive({ message: 'qty must be greater than 0' })
  @IsOptional()
  qty?: number;

  @ApiProperty({
    description: 'Unit cost of the ingredient',
    example: 120.0,
  })
  @IsNumber({}, { message: 'unitCost must be a number' })
  @Min(0, { message: 'unitCost cannot be negative' })
  unitCost: number;
}
