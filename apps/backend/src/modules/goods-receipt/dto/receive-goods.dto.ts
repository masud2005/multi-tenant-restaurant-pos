import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { ReceiveGoodsLineDto } from './receive-goods-line.dto';

export class ReceiveGoodsDto {
  @ApiProperty({
    description: 'Purchase Order ID (UUID or cuid)',
    example: 'cuid-po-12345',
  })
  @IsString({ message: 'poId must be a string' })
  @IsNotEmpty({ message: 'poId is required' })
  poId: string;

  @ApiPropertyOptional({
    description: 'Name or ID of person receiving the goods',
    example: 'John Manager',
  })
  @IsString({ message: 'receivedBy must be a string' })
  @IsOptional()
  receivedBy?: string;

  @ApiPropertyOptional({
    description:
      'Optional notes on the delivery (e.g. invoice no, damages, temperature)',
    example: 'Invoice #INV-9821, all boxes checked',
  })
  @IsString({ message: 'notes must be a string' })
  @IsOptional()
  notes?: string;

  @ApiProperty({
    description: 'List of received items with quantity and unit cost',
    type: [ReceiveGoodsLineDto],
  })
  @IsArray({ message: 'lines must be an array' })
  @ArrayMinSize(1, { message: 'At least one line is required' })
  @ValidateNested({ each: true })
  @Type(() => ReceiveGoodsLineDto)
  lines: ReceiveGoodsLineDto[];

  @ApiPropertyOptional({
    description: 'Alias for lines',
    type: [ReceiveGoodsLineDto],
  })
  @IsArray({ message: 'items must be an array' })
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => ReceiveGoodsLineDto)
  items?: ReceiveGoodsLineDto[];
}
