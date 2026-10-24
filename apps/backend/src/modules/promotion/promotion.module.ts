import { Module } from '@nestjs/common';
import { PromotionController } from './promotion.controller';
import { PromotionService } from './promotion.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [PromotionController],
  providers: [PromotionService],
  exports: [PromotionService],
})
export class PromotionModule {}
