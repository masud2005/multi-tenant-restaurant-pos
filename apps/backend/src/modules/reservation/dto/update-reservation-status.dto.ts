import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';
import { ReservationStatus } from '../../../../prisma/generated/client';

export class UpdateReservationStatusDto {
  @ApiProperty({
    description: 'New reservation status',
    enum: ReservationStatus,
    example: ReservationStatus.SEATED,
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.toUpperCase() : value))
  @IsEnum(ReservationStatus)
  @IsNotEmpty()
  status: ReservationStatus;

  @ApiPropertyOptional({
    description: 'Optional: Assign or change table ID when seating the guest',
    example: 't_se_g1',
  })
  @Transform(({ value }) => (value === null || value === '' || value === 'none' ? undefined : value))
  @IsString()
  @IsOptional()
  tableId?: string;
}
