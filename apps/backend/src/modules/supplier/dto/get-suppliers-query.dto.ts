import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class GetSuppliersQueryDto {
  @ApiPropertyOptional({
    description: 'Search suppliers by name, contact person, phone, or supplies',
    example: 'Meats',
  })
  @IsString({ message: 'Search term must be a string' })
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({
    description:
      'Filter only active suppliers (true: active only, false: inactive only)',
    example: true,
  })
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return undefined;
  })
  @IsBoolean({ message: 'activeOnly must be a boolean' })
  @IsOptional()
  activeOnly?: boolean;
}
