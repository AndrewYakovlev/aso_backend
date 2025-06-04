// src/modules/products/interfaces/brand.interface.ts
import { Brand } from '@prisma/client'

export interface BrandWithCount extends Brand {
  _count?: {
    products: number
  }
}
