// src/modules/products/interfaces/filter.interface.ts
import { Prisma } from '@prisma/client'
import { CharacteristicType } from '../../characteristics/interfaces/characteristic.interface'

export interface FilterFacet {
  field: string
  label: string
  type: FilterType
  values: FilterValue[]
}

export interface FilterValue {
  value: string
  label: string
  count: number
  selected?: boolean
}

export interface PriceRange {
  min: number
  max: number
}

export interface CharacteristicFilter {
  characteristicId: string
  type: CharacteristicType
  values?: string[] // для select, checkbox
  range?: {
    min?: number
    max?: number
  } // для number с filterType range
  booleanValue?: boolean // для boolean
}

export interface ProductFilters {
  search?: string
  categoryIds?: string[]
  brandIds?: string[]
  priceRange?: PriceRange
  inStock?: boolean
  isOriginal?: boolean
  characteristics?: CharacteristicFilter[]
  includeInactive?: boolean
}

export enum FilterType {
  MULTI_SELECT = 'multi_select',
  SINGLE_SELECT = 'single_select',
  RANGE = 'range',
  BOOLEAN = 'boolean',
  TEXT = 'text',
}

export interface FilterContext {
  where: Prisma.ProductWhereInput
  categoryIds?: string[]
}

export interface AvailableFilters {
  categories: FilterFacet
  brands: FilterFacet
  priceRange: PriceRange
  characteristics: CharacteristicFilterFacet[]
  totalCount: number
}

export interface CharacteristicFilterFacet extends FilterFacet {
  characteristicId: string
  characteristicType: CharacteristicType
  unit?: string | null
}
