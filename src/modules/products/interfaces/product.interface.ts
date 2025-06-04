// src/modules/products/interfaces/product.interface.ts
import { Product, Brand, ProductImage } from '@prisma/client'
import { CategoryWithRelations } from '../../categories/interfaces/category.interface'

export interface ProductCategoryWithCategory {
  id: string
  isPrimary: boolean
  category: CategoryWithRelations
}

export interface ProductWithRelations extends Product {
  brand: Brand
  categories: ProductCategoryWithCategory[]
  images: ProductImage[]
  _count?: {
    vehicleApplications?: number
    crossReferences?: number
  }
}
