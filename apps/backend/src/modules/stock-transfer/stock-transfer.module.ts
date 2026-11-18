import { Module } from '@nestjs/common';
import { StockTransferController } from './stock-transfer.controller';
import { StockTransferService } from './stock-transfer.service';

@Module({
  controllers: [StockTransferController],
  providers: [StockTransferService],
  exports: [StockTransferService],
})
export class StockTransferModule {}
