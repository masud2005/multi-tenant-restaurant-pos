import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class GetExpensesQueryDto {
  @ApiPropertyOptional({ description: 'Filter expenses by branch ID', example: 'b_se_gulshan' })
  @IsString()
  @IsOptional()
  branchId?: string;

  @ApiPropertyOptional({ description: 'Filter expenses by category', example: 'supplies' })
  @IsString()
  @IsOptional()
  category?: string;

  @ApiPropertyOptional({ description: 'Filter expenses by date (YYYY-MM-DD)', example: '2026-11-18' })
  @IsString()
  @IsOptional()
  date?: string;
}
