import { IsEnum, IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DeliveryStatus } from '../../../../prisma/generated/client';

export class UpdateOrderDeliveryDto {
  @ApiProperty({
    description: 'Target delivery status: pending, assigned, out, delivered (or PENDING, ASSIGNED, OUT, DELIVERED)',
    enum: DeliveryStatus,
    example: 'assigned',
  })
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      const upper = value.toUpperCase().trim();
      return upper as DeliveryStatus;
    }
    return value;
  })
  @IsEnum(DeliveryStatus, {
    message: 'Delivery status must be one of: pending, assigned, out, delivered',
  })
  status: DeliveryStatus;

  @ApiPropertyOptional({
    description: 'Rider ID to assign (required when status is ASSIGNED)',
    example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  })
  @Transform(({ value }) => (value === null || value === '' ? undefined : value))
  @IsString()
  @IsOptional()
  riderId?: string;
}

