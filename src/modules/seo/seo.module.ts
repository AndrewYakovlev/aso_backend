// src/modules/seo/seo.module.ts
import { Module } from '@nestjs/common'
import { SeoController } from './seo.controller'
import { SeoService } from './seo.service'
import { ProductsModule } from '../products/products.module'
import { CategoriesModule } from '../categories/categories.module'

@Module({
  imports: [ProductsModule, CategoriesModule],
  controllers: [SeoController],
  providers: [SeoService],
  exports: [SeoService],
})
export class SeoModule {}
