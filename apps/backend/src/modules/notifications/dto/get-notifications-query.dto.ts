import { IsBooleanString, IsEnum, IsNumberString, IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { NotificationType } from '../../../../prisma/generated/client';

export class GetNotificationsQueryDto {
  @ApiPropertyOptional({
    description: 'Filter only unread notifications ("true" or "false")',
    example: 'true',
  })
  @IsBooleanString()
  @IsOptional()
  unreadOnly?: string;

  @ApiPropertyOptional({
    enum: NotificationType,
    description: 'Filter by notification type',
    example: NotificationType.INVENTORY,
  })
  @IsEnum(NotificationType)
  @IsOptional()
  type?: NotificationType;

  @ApiPropertyOptional({
    description: 'Filter notifications by branch ID',
    example: 'branch-uuid',
  })
  @IsString()
  @IsOptional()
  branchId?: string;

  @ApiPropertyOptional({
    description: 'Maximum notifications to return (default: 50)',
    example: '20',
  })
  @IsNumberString()
  @IsOptional()
  limit?: string;
}
