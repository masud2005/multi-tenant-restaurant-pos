import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class GetCashSessionsQueryDto {
  @ApiPropertyOptional({ description: 'Filter cash sessions by branch ID', example: 'b_se_gulshan' })
  @IsString()
  @IsOptional()
  branchId?: string;
}
