import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { CreateSupplierReturnLineDto } from './create-supplier-return-line.dto';

export class CreateSupplierReturnDto {
  @ApiProperty({
    description: 'Branch ID where returned stock is located (UUID)',
    example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  })
  @IsUUID('4', { message: 'branchId must be a valid UUID' })
  @IsNotEmpty({ message: 'branchId is required' })
  branchId: string;

  @ApiProperty({
    description: 'Supplier ID to whom items are returned (UUID)',
    example: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
  })
  @IsUUID('4', { message: 'supplierId must be a valid UUID' })
  @IsNotEmpty({ message: 'supplierId is required' })
  supplierId: string;

  @ApiProperty({
    description: 'Reason for returning the items to supplier',
    example: 'Damaged in transit / expired',
    maxLength: 120,
  })
  @IsString({ message: 'reason must be a string' })
  @IsNotEmpty({ message: 'reason is required' })
  @MaxLength(120, { message: 'reason cannot exceed 120 characters' })
  reason: string;

  @ApiPropertyOptional({
    description: 'Optional name of staff creating the return',
    example: 'Rahim Uddin',
  })
  @IsString({ message: 'createdBy must be a string' })
  @IsOptional()
  createdBy?: string;

  @ApiProperty({
    description: 'List of ingredients and quantities to return',
    type: [CreateSupplierReturnLineDto],
  })
  @IsArray({ message: 'lines must be an array' })
  @ArrayMinSize(1, { message: 'At least one item must be returned' })
  @ValidateNested({ each: true })
  @Type(() => CreateSupplierReturnLineDto)
  lines: CreateSupplierReturnLineDto[];

  @ApiPropertyOptional({
    description: 'Alias for lines',
    type: [CreateSupplierReturnLineDto],
  })
  @IsArray({ message: 'items must be an array' })
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CreateSupplierReturnLineDto)
  items?: CreateSupplierReturnLineDto[];
}
