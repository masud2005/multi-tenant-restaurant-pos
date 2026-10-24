import { PartialType } from '@nestjs/swagger';
import { CreateCustomerDto } from './create-customer.dto';
import { IsBoolean, IsInt, IsOptional, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateCustomerDto extends PartialType(CreateCustomerDto) {
  @ApiPropertyOptional({
    description: 'Whether the customer profile is active',
    example: true,
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Manually adjust customer loyalty points balance',
    example: 120,
  })
  @IsInt()
  @Min(0)
  @IsOptional()
  loyaltyPoints?: number;
}
