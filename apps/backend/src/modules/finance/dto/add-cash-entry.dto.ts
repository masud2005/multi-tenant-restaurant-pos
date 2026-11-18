import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class AddCashEntryDto {
  @ApiProperty({ description: 'Entry type: in (pay-in) or out (pay-out)', enum: ['in', 'out'], example: 'in' })
  @IsString()
  @IsIn(['in', 'out'], { message: 'kind must be either in or out' })
  kind: 'in' | 'out';

  @ApiProperty({ description: 'Amount for cash entry', example: 100, minimum: 0.01 })
  @IsNumber()
  @Min(0.01, { message: 'Amount must be greater than zero' })
  amount: number;

  @ApiProperty({ description: 'Reason for the pay-in or pay-out', example: 'Added change' })
  @IsString()
  @IsNotEmpty({ message: 'Reason is required' })
  reason: string;

  @ApiPropertyOptional({ description: 'Staff member recording the entry', example: 'Cashier' })
  @IsString()
  @IsOptional()
  by?: string;
}
