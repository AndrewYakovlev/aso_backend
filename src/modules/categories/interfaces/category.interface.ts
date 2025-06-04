// src/modules/categories/interfaces/category.interface.ts
import { Category } from '@prisma/client'

export interface CategoryWithRelations extends Category {
  parent?: Category | null
  children?: CategoryWithRelations[]
  _count?: {
    products?: number
  }
  productCount?: number
  totalProductCount?: number
}

export interface CategoryWithProductCategory extends Category {
  products?: Array<{
    id: string
    isPrimary: boolean
    product: {
      deletedAt: Date | null
      isActive: boolean
    }
  }>
}
