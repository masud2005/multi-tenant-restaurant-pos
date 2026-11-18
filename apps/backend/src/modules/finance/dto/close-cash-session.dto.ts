import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CloseCashSessionDto {
  @ApiProperty({ description: 'Actual counted cash in drawer at shift end', example: 1250, minimum: 0 })
  @IsNumber()
  @Min(0, { message: 'Counted cash cannot be negative' })
  countedCash: number;

  @ApiPropertyOptional({ description: 'Notes regarding variance or shift handover', example: 'Drawer balanced' })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiPropertyOptional({ description: 'Staff member closing the drawer', example: 'Manager' })
  @IsString()
  @IsOptional()
  by?: string;
}
