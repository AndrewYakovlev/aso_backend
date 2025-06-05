// src/modules/orders/orders.module.ts
import { Module } from '@nestjs/common'
import { OrdersController } from './orders.controller'
import { OrdersService } from './orders.service'
import { CartModule } from '../cart/cart.module'
import { DiscountModule } from '../discount/discount.module'
import { ProductsModule } from '../products/products.module'

@Module({
  imports: [CartModule, DiscountModule, ProductsModule],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
