import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsUUID,
  Min,
} from 'class-validator';

export class CreateSupplierReturnLineDto {
  @ApiProperty({
    description: 'Ingredient ID (UUID)',
    example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  })
  @IsUUID('4', { message: 'ingredientId must be a valid UUID' })
  @IsNotEmpty({ message: 'ingredientId is required' })
  ingredientId: string;

  @ApiProperty({
    description: 'Quantity of items to return to supplier (must be greater than 0)',
    example: 5,
    minimum: 0.001,
  })
  @Type(() => Number)
  @IsNumber({}, { message: 'qty must be a number' })
  @IsPositive({ message: 'qty must be greater than 0' })
  qty: number;

  @ApiPropertyOptional({
    description: 'Alias for qty',
    example: 5,
  })
  @Type(() => Number)
  @IsNumber({}, { message: 'quantity must be a number' })
  @IsPositive({ message: 'quantity must be greater than 0' })
  @IsOptional()
  quantity?: number;

  @ApiPropertyOptional({
    description:
      'Unit cost at which items are credited (if omitted, uses current branch stock cost)',
    example: 95.0,
    minimum: 0,
  })
  @Type(() => Number)
  @IsNumber({}, { message: 'unitCost must be a number' })
  @Min(0, { message: 'unitCost cannot be negative' })
  @IsOptional()
  unitCost?: number;
}
