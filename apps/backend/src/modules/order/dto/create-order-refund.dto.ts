import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentMethod } from '../../../../prisma/generated/client';

export class CreateOrderRefundDto {
  @ApiProperty({
    description: 'Refund amount (must be positive, cannot exceed refundable paid total)',
    example: 250.0,
    minimum: 0.01,
  })
  @Type(() => Number)
  @IsNumber({}, { message: 'Refund amount must be a valid number' })
  @Min(0.01, { message: 'Refund amount must be greater than zero' })
  amount: number;

  @ApiProperty({
    description: 'Payment method being refunded back to (must match a method used on the order)',
    enum: PaymentMethod,
    example: PaymentMethod.CASH,
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.toUpperCase() : value,
  )
  @IsEnum(PaymentMethod, {
    message: `Payment method must be one of: ${Object.values(PaymentMethod).join(', ')}`,
  })
  @IsNotEmpty({ message: 'Payment method is required' })
  method: PaymentMethod;

  @ApiProperty({
    description: 'Reason for the refund',
    example: 'Dish returned due to wrong ingredient',
    maxLength: 255,
  })
  @IsString()
  @IsNotEmpty({ message: 'Refund reason is required' })
  @MaxLength(255, { message: 'Refund reason cannot exceed 255 characters' })
  reason: string;

  @ApiPropertyOptional({
    description: 'Name or identifier of the staff member processing the refund',
    example: 'Manager John',
  })
  @IsString()
  @IsOptional()
  by?: string;
}

