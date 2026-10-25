import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';

export class GetSupplierReturnsQueryDto {
  @ApiPropertyOptional({
    description: 'Filter returns for a specific branch ID',
    example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  })
  @IsString()
  @IsOptional()
  branchId?: string;

  @ApiPropertyOptional({
    description: 'Filter returns by supplier ID',
    example: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
  })
  @IsString()
  @IsOptional()
  supplierId?: string;

  @ApiPropertyOptional({
    description: 'Search returns by RTN number, supplier, or reason',
    example: 'RTN-2026',
  })
  @IsString({ message: 'Search term must be a string' })
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter returns created after or on this date (ISO string)',
    example: '2026-10-01',
  })
  @IsString()
  @IsOptional()
  startDate?: string;

  @ApiPropertyOptional({
    description: 'Filter returns created before or on this date (ISO string)',
    example: '2026-10-31',
  })
  @IsString()
  @IsOptional()
  endDate?: string;
}
