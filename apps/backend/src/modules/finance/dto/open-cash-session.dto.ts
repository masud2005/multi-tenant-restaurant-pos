import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class OpenCashSessionDto {
  @ApiProperty({ description: 'Branch ID for which the cash drawer is opened', example: 'b_se_gulshan' })
  @IsString()
  @IsNotEmpty()
  branchId: string;

  @ApiProperty({ description: 'Opening float amount', example: 500, minimum: 0 })
  @IsNumber()
  @Min(0, { message: 'Opening float cannot be negative' })
  openingFloat: number;

  @ApiPropertyOptional({ description: 'Staff member opening the drawer', example: 'Nadia Rahman' })
  @IsString()
  @IsOptional()
  by?: string;
}
