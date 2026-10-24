import { IsEnum, IsNotEmpty } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { TableStatus } from '../../../../prisma/generated/client';

export class UpdateTableStatusDto {
  @ApiProperty({
    description: 'New operational status for the dining table',
    enum: TableStatus,
    example: TableStatus.OCCUPIED,
  })
  @Transform(({ value }) => (typeof value === 'string' ? (value.toUpperCase() as TableStatus) : value))
  @IsEnum(TableStatus, {
    message: `Status must be one of: ${Object.values(TableStatus).join(', ')}`,
  })
  @IsNotEmpty({ message: 'Table status is required' })
  status: TableStatus;
}
