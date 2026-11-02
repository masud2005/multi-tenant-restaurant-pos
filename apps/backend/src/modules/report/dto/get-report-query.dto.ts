import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class GetReportQueryDto {
  @ApiPropertyOptional({
    description: 'Filter report metrics by branch ID or name',
    example: 'b_se_gulshan',
  })
  @IsOptional()
  @IsString()
  branchId?: string;

  @ApiPropertyOptional({
    description: 'Time range filter (today, 7d, 30d)',
    example: '7d',
    default: '7d',
  })
  @IsOptional()
  @IsString()
  range?: string;
}

