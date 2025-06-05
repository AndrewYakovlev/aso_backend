// src/modules/cart/cart.module.ts
import { Module } from '@nestjs/common'
import { CartController } from './cart.controller'
import { CartService } from './cart.service'
import { ProductsModule } from '../products/products.module'
import { DiscountModule } from '../discount/discount.module'

@Module({
  imports: [ProductsModule, DiscountModule],
  controllers: [CartController],
  providers: [CartService],
  exports: [CartService],
})
export class CartModule {}
