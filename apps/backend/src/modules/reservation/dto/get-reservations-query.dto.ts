import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ReservationStatus } from '../../../../prisma/generated/client';

export class GetReservationsQueryDto {
  @ApiPropertyOptional({
    description: 'Filter reservations by branch ID',
    example: 'b_se_gulshan',
  })
  @IsString()
  @IsOptional()
  branchId?: string;

  @ApiPropertyOptional({
    description:
      'Filter reservations by status (BOOKED, SEATED, COMPLETED, CANCELLED, NO_SHOW) or active',
    enum: ReservationStatus,
    example: ReservationStatus.BOOKED,
  })
  @IsString()
  @IsOptional()
  status?: string;

  @ApiPropertyOptional({
    description: 'Filter reservations by table ID',
    example: 't_se_g1',
  })
  @IsString()
  @IsOptional()
  tableId?: string;

  @ApiPropertyOptional({
    description: 'Search by guest name or phone number',
    example: 'Rahim',
  })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter reservations on or after this date (ISO string)',
    example: '2026-10-25T00:00:00.000Z',
  })
  @IsString()
  @IsOptional()
  startDate?: string;

  @ApiPropertyOptional({
    description: 'Filter reservations on or before this date (ISO string)',
    example: '2026-10-25T23:59:59.999Z',
  })
  @IsString()
  @IsOptional()
  endDate?: string;
}
