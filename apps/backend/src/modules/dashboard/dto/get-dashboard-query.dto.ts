import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class GetDashboardQueryDto {
  @ApiPropertyOptional({
    description: 'Filter dashboard metrics by specific branch ID or name',
    example: 'b_se_gulshan',
  })
  @IsOptional()
  @IsString()
  branchId?: string;
}

