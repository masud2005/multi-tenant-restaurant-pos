import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CheckPromotionQueryDto {
  @ApiProperty({
    description: 'Promo code to validate at checkout',
    example: 'WEEKEND20',
  })
  @IsString({ message: 'Promo code must be a string' })
  @IsNotEmpty({ message: 'Promo code is required' })
  code: string;

  @ApiPropertyOptional({
    description: 'Current cart / order subtotal (BDT) to check minimum spend and compute discount',
    example: 850.0,
    minimum: 0,
  })
  @Type(() => Number)
  @IsNumber({}, { message: 'Subtotal must be a valid number' })
  @Min(0, { message: 'Subtotal cannot be negative' })
  @IsOptional()
  subtotal?: number;
}
