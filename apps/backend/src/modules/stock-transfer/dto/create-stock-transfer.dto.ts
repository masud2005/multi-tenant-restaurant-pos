import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class CreateStockTransferLineDto {
  @ApiProperty({ description: 'Ingredient ID to transfer', example: 'ing-uuid' })
  @IsString()
  @IsNotEmpty()
  ingredientId: string;

  @ApiProperty({ description: 'Quantity to transfer', example: 5, minimum: 0.01 })
  @IsNumber()
  @Min(0.01)
  quantity: number;
}

export class CreateStockTransferDto {
  @ApiProperty({ description: 'Origin branch ID (source of stock)', example: 'b_se_gulshan' })
  @IsString()
  @IsNotEmpty()
  fromBranchId: string;

  @ApiProperty({ description: 'Destination branch ID (receiving branch)', example: 'b_se_dhanmondi' })
  @IsString()
  @IsNotEmpty()
  toBranchId: string;

  @ApiPropertyOptional({ description: 'Notes or reference for the transfer', example: 'Urgent weekend stock balancing' })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiPropertyOptional({ description: 'Staff member initiating the transfer', example: 'Manager' })
  @IsString()
  @IsOptional()
  initiatedBy?: string;

  @ApiProperty({ description: 'Transfer items and quantities', type: [CreateStockTransferLineDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateStockTransferLineDto)
  lines: CreateStockTransferLineDto[];
}
