import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateAuditLogDto {
  @ApiProperty({
    example: 'void',
    description: 'Action type (e.g. create, update, delete, void, refund, stock_adjust, payment)',
  })
  @IsString()
  @IsNotEmpty()
  action: string;

  @ApiProperty({
    example: 'order',
    description: 'Entity affected (e.g. order, inventory, staff, payment, table, menu, settings, branch)',
  })
  @IsString()
  @IsNotEmpty()
  entity: string;

  @ApiPropertyOptional({
    example: 'order-1042',
    description: 'ID of the affected entity',
  })
  @IsString()
  @IsOptional()
  entityId?: string;

  @ApiPropertyOptional({
    example: 'user-uuid',
    description: 'ID of the actor who performed the action',
  })
  @IsString()
  @IsOptional()
  actorId?: string;

  @ApiProperty({
    example: 'Admin User',
    description: 'Display name of the actor',
  })
  @IsString()
  @IsNotEmpty()
  actorName: string;

  @ApiPropertyOptional({
    example: 'OWNER',
    description: 'Role of the actor',
  })
  @IsString()
  @IsOptional()
  actorRole?: string;

  @ApiPropertyOptional({
    example: 'branch-uuid',
    description: 'Branch ID if event is branch-specific',
  })
  @IsString()
  @IsOptional()
  branchId?: string;

  @ApiProperty({
    example: 'Order #1042 voided by Manager',
    description: 'Readable summary of the audit event',
  })
  @IsString()
  @IsNotEmpty()
  summary: string;

  @ApiPropertyOptional({
    example: 'Reason: Customer canceled dine-in booking',
    description: 'Detailed explanation or event notes',
  })
  @IsString()
  @IsOptional()
  details?: string;

  @ApiPropertyOptional({
    example: { orderId: '1042', totalAmount: 1450, reason: 'Guest left' },
    description: 'Arbitrary contextual metadata or change diff',
  })
  @IsOptional()
  metadata?: any;

  @ApiPropertyOptional({
    example: '192.168.1.1',
    description: 'IP address of request',
  })
  @IsString()
  @IsOptional()
  ipAddress?: string;

  @ApiPropertyOptional({
    description: 'Client user-agent string',
  })
  @IsString()
  @IsOptional()
  userAgent?: string;
}
