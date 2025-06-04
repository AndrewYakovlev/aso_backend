// src/modules/products/products.module.ts
import { Module } from '@nestjs/common'
import { ProductsController } from './products.controller'
import { ProductsService } from './products.service'
import { BrandsService } from './brands.service'
import { ProductFiltersService } from './services/product-filters.service'
import { CategoriesModule } from '../categories/categories.module'
import { CharacteristicsModule } from '../characteristics/characteristics.module'

@Module({
  imports: [CategoriesModule, CharacteristicsModule],
  controllers: [ProductsController],
  providers: [ProductsService, BrandsService, ProductFiltersService],
  exports: [ProductsService, BrandsService, ProductFiltersService],
})
export class ProductsModule {}
