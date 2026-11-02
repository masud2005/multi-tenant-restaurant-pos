import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CancelOrderDto {
  @ApiProperty({
    description: 'Reason for voiding / cancelling the order',
    example: 'Customer changed mind before food preparation',
    maxLength: 255,
  })
  @IsString()
  @IsNotEmpty({ message: 'Cancellation reason is required' })
  @MaxLength(255, { message: 'Reason cannot exceed 255 characters' })
  reason: string;
}

