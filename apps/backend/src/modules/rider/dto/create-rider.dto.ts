import { IsBoolean, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateRiderDto {
  @ApiPropertyOptional({
    description: 'Branch ID where this rider is stationed',
    example: 'b_se_gulshan',
  })
  @Transform(({ value }) => (value === null || value === '' ? undefined : value))
  @IsString()
  @IsOptional()
  branchId?: string;

  @ApiProperty({
    description: 'Rider full name',
    example: 'Babul Mia',
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty({ message: 'Rider name is required' })
  @MaxLength(100, { message: 'Rider name cannot exceed 100 characters' })
  name: string;

  @ApiProperty({
    description: 'Rider contact phone number',
    example: '+8801611000123',
    maxLength: 30,
  })
  @IsString()
  @IsNotEmpty({ message: 'Rider phone is required' })
  @MaxLength(30, { message: 'Rider phone cannot exceed 30 characters' })
  phone: string;

  @ApiPropertyOptional({
    description: 'Whether rider is actively available for dispatch',
    example: true,
    default: true,
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

