import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateExpenseDto {
  @ApiProperty({ description: 'Branch ID where expense was incurred', example: 'b_se_gulshan' })
  @IsString()
  @IsNotEmpty()
  branchId: string;

  @ApiProperty({
    description: 'Expense category',
    enum: ['supplies', 'utilities', 'rent', 'maintenance', 'marketing', 'wages', 'other'],
    example: 'supplies',
  })
  @IsString()
  @IsIn(['supplies', 'utilities', 'rent', 'maintenance', 'marketing', 'wages', 'other'], {
    message: 'Invalid expense category',
  })
  category: string;

  @ApiProperty({ description: 'Description of the expense', example: 'Cleaning supplies & tissue boxes' })
  @IsString()
  @IsNotEmpty({ message: 'Description is required' })
  description: string;

  @ApiProperty({ description: 'Amount spent', example: 450, minimum: 0.01 })
  @IsNumber()
  @Min(0.01, { message: 'Amount must be greater than zero' })
  amount: number;

  @ApiProperty({
    description: 'Payment source: cash_drawer (paid from active drawer) or bank (bank/card)',
    enum: ['cash_drawer', 'bank'],
    example: 'cash_drawer',
  })
  @IsString()
  @IsIn(['cash_drawer', 'bank'], { message: 'paidFrom must be cash_drawer or bank' })
  paidFrom: 'cash_drawer' | 'bank';

  @ApiPropertyOptional({ description: 'Date of expense (YYYY-MM-DD)', example: '2026-11-18' })
  @IsString()
  @IsOptional()
  date?: string;

  @ApiPropertyOptional({ description: 'Name of the person who created the expense', example: 'Nadia Rahman' })
  @IsString()
  @IsOptional()
  createdBy?: string;
}
