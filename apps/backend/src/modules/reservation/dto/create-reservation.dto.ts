import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class CreateReservationDto {
  @ApiProperty({
    description: 'Branch ID where the reservation is being booked',
    example: 'b_se_gulshan',
  })
  @IsString()
  @IsNotEmpty()
  branchId: string;

  @ApiProperty({
    description: 'Name of the guest booking the reservation',
    example: 'Rahim Ahmed',
    maxLength: 60,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  customerName: string;

  @ApiPropertyOptional({
    description: 'Contact phone number of the guest',
    example: '+8801711223344',
    maxLength: 20,
  })
  @IsString()
  @IsOptional()
  @MaxLength(20)
  phone?: string;

  @ApiPropertyOptional({
    description: 'Number of guests in the party',
    example: 4,
    default: 2,
    minimum: 1,
    maximum: 40,
  })
  @IsInt()
  @Min(1)
  @Max(40)
  @IsOptional()
  @Type(() => Number)
  partySize?: number;

  @ApiProperty({
    description: 'Reservation start date and time (ISO-8601 string)',
    example: '2026-10-25T19:30:00.000Z',
  })
  @IsDateString()
  @IsNotEmpty()
  at: string;

  @ApiPropertyOptional({
    description: 'Estimated duration of reservation in minutes',
    example: 90,
    default: 90,
    minimum: 15,
    maximum: 480,
  })
  @IsInt()
  @Min(15)
  @Max(480)
  @IsOptional()
  @Type(() => Number)
  durationMin?: number;

  @ApiPropertyOptional({
    description: 'Dining table ID to assign (optional)',
    example: 't_se_g1',
  })
  @Transform(({ value }) => (value === null || value === '' || value === 'none' ? undefined : value))
  @IsString()
  @IsOptional()
  tableId?: string | null;

  @ApiPropertyOptional({
    description: 'Special requests or notes from guest',
    example: 'Window seat preferred, celebrating birthday',
    maxLength: 255,
  })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  notes?: string;
}
