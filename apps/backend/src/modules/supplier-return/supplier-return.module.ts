import { Module } from '@nestjs/common';
import { SupplierReturnController } from './supplier-return.controller';
import { SupplierReturnService } from './supplier-return.service';

@Module({
  controllers: [SupplierReturnController],
  providers: [SupplierReturnService],
  exports: [SupplierReturnService],
})
export class SupplierReturnModule {}
