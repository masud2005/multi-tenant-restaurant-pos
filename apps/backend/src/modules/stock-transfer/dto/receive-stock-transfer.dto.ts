import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class ReceiveStockTransferDto {
  @ApiPropertyOptional({ description: 'Name of the staff member receiving the transfer', example: 'Store Manager' })
  @IsString()
  @IsOptional()
  receivedBy?: string;

  @ApiPropertyOptional({ description: 'Receiving notes or condition of goods', example: 'All bags received intact' })
  @IsString()
  @IsOptional()
  notes?: string;
}
