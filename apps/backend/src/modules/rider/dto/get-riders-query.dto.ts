import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class GetRidersQueryDto {
  @ApiPropertyOptional({
    description: 'Filter riders by branch ID',
    example: 'b_se_gulshan',
  })
  @Transform(({ value }) => (value === null || value === '' ? undefined : value))
  @IsString()
  @IsOptional()
  branchId?: string;

  @ApiPropertyOptional({
    description: 'Filter only active riders',
    example: true,
  })
  @Transform(({ value }) => {
    if (value === 'true' || value === true || value === 1 || value === '1') return true;
    if (value === 'false' || value === false || value === 0 || value === '0') return false;
    return undefined;
  })
  @IsBoolean()
  @IsOptional()
  activeOnly?: boolean;

  @ApiPropertyOptional({
    description: 'Search riders by name or phone',
    example: 'Babul',
  })
  @IsString()
  @IsOptional()
  search?: string;
}

