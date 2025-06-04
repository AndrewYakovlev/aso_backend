// src/modules/products/interfaces/product.interface.ts
import { Product, Brand, ProductImage } from '@prisma/client'
import { CategoryWithRelations } from '../../categories/interfaces/category.interface'

export interface ProductCategoryWithCategory {
  id: string
  isPrimary: boolean
  category: CategoryWithRelations
}

export interface ProductCharacteristicWithDetails {
  id: string
  value: string | null
  characteristic: {
    id: string
    name: string
    code: string
    type: string
    unit: string | null
    isRequired: boolean
    values?: Array<{
      id: string
      value: string
      sortOrder: number
    }>
  }
  characteristicValue?: {
    id: string
    value: string
  } | null
}

export interface ProductWithRelations extends Product {
  brand: Brand
  categories: ProductCategoryWithCategory[]
  images: ProductImage[]
  characteristics?: ProductCharacteristicWithDetails[]
  _count?: {
    vehicleApplications?: number
    crossReferences?: number
  }
}
