// src/modules/discount/discount.module.ts
import { Module } from '@nestjs/common'
import { DiscountService } from './discount.service'
import { CartModule } from '../cart/cart.module'

@Module({
  imports: [CartModule],
  providers: [DiscountService],
  exports: [DiscountService],
})
export class DiscountModule {}
