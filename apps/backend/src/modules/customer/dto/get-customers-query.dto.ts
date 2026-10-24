import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class GetCustomersQueryDto {
  @ApiPropertyOptional({
    description: 'Search customers by name or phone (flexible search)',
    example: 'Tanvir',
  })
  @IsString({ message: 'Search term must be a string' })
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({
    description: 'Find customer by name',
    example: 'Tanvir',
  })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({
    description: 'Filter by exact or partial phone number (great for POS lookup)',
    example: '+8801712345678',
  })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({
    description: 'Filter customers by loyalty tier ID',
  })
  @IsString()
  @IsOptional()
  tierId?: string;

  @ApiPropertyOptional({
    description: 'Filter by active status (true/false)',
    example: true,
  })
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return undefined;
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Page number for pagination',
    default: 1,
    minimum: 1,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Number of items per page',
    default: 20,
    minimum: 1,
    maximum: 100,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number = 20;
}
