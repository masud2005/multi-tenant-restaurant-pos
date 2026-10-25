import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NotificationType } from '../../../../prisma/generated/client';

export class CreateNotificationDto {
  @ApiProperty({
    enum: NotificationType,
    example: NotificationType.SYSTEM,
    description: 'Category of the notification',
  })
  @IsEnum(NotificationType)
  type: NotificationType;

  @ApiProperty({
    example: 'Low Stock Alert',
    description: 'Short alert header',
  })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({
    example: 'Item "Cheese" is below threshold (remaining: 2 kg).',
    description: 'Detailed description of the notification',
  })
  @IsString()
  @IsNotEmpty()
  body: string;

  @ApiPropertyOptional({
    example: 'b12345',
    description: 'Optional branch ID the notification applies to',
  })
  @IsString()
  @IsOptional()
  branchId?: string;

  @ApiPropertyOptional({
    example: '/inventory',
    description: 'Target frontend route or URL',
  })
  @IsString()
  @IsOptional()
  link?: string;

  @ApiPropertyOptional({
    example: { ingredientId: 'ing-1', currentStock: 2 },
    description: 'Contextual JSON metadata',
  })
  @IsOptional()
  metadata?: any;
}
