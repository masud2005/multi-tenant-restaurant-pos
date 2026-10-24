import { Module } from '@nestjs/common';
import { GoodsReceiptController } from './goods-receipt.controller';
import { GoodsReceiptService } from './goods-receipt.service';

@Module({
  controllers: [GoodsReceiptController],
  providers: [GoodsReceiptService],
  exports: [GoodsReceiptService],
})
export class GoodsReceiptModule {}
