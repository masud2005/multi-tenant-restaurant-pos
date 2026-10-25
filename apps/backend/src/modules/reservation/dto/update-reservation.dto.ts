import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString } from 'class-validator';
import { CreateReservationDto } from './create-reservation.dto';

export class UpdateReservationDto extends PartialType(CreateReservationDto) {
  @ApiPropertyOptional({
    description: 'Dining table ID to assign (or null/none to unassign)',
    example: 't_se_g1',
  })
  @Transform(({ value }) => (value === 'none' || value === '' ? null : value))
  @IsOptional()
  @IsString()
  tableId?: string | null;
}
