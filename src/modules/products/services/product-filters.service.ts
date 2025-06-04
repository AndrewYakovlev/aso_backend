// src/modules/products/services/product-filters.service.ts
import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../../prisma/prisma.service'
import { Prisma } from '@prisma/client'
import { CategoriesService } from '../../categories/categories.service'
import { CharacteristicsService } from '../../characteristics/characteristics.service'
import { ExtendedProductFiltersDto, GetFiltersDto } from '../dto/product-filters.dto'
import {
  ProductFilters,
  FilterFacet,
  FilterValue,
  AvailableFilters,
  CharacteristicFilterFacet,
  FilterType,
  PriceRange,
  FilterContext,
  CharacteristicFilter,
} from '../interfaces/filter.interface'
import { CharacteristicType } from '../../characteristics/interfaces/characteristic.interface'
import { Cacheable } from '@common/decorators/cacheable.decorator'
import { CacheKeys, CacheTTL } from '../../../redis/redis.constants'

@Injectable()
export class ProductFiltersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly categoriesService: CategoriesService,
    private readonly characteristicsService: CharacteristicsService,
  ) {}

  /**
   * Построение WHERE условий для Prisma запроса
   */
  async buildWhereClause(filters: ExtendedProductFiltersDto): Promise<Prisma.ProductWhereInput> {
    const where: Prisma.ProductWhereInput = {
      deletedAt: null,
    }

    // Базовые фильтры
    if (!filters.includeInactive) {
      where.isActive = true
    }

    // Полнотекстовый поиск
    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { sku: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
        { shortDescription: { contains: filters.search, mode: 'insensitive' } },
      ]
    }

    // Фильтр по категориям с учетом подкатегорий
    if (filters.categoryIds && filters.categoryIds.length > 0) {
      const allCategoryIds: string[] = []

      for (const categoryId of filters.categoryIds) {
        const subcategoryIds = await this.categoriesService.getAllSubcategoryIds(categoryId)
        allCategoryIds.push(...subcategoryIds)
      }

      where.categories = {
        some: {
          categoryId: {
            in: [...new Set(allCategoryIds)], // Убираем дубликаты
          },
        },
      }
    }

    // Фильтр по брендам
    if (filters.brandIds && filters.brandIds.length > 0) {
      where.brandId = {
        in: filters.brandIds,
      }
    }

    // Фильтр по цене
    if (filters.priceRange) {
      const priceConditions: any = {}
      if (filters.priceRange.min !== undefined) {
        priceConditions.gte = filters.priceRange.min
      }
      if (filters.priceRange.max !== undefined) {
        priceConditions.lte = filters.priceRange.max
      }
      if (Object.keys(priceConditions).length > 0) {
        where.price = priceConditions
      }
    }

    // Фильтр по наличию
    if (filters.inStock) {
      where.stock = {
        gt: 0,
      }
    }

    // Фильтр по оригинальности
    if (filters.isOriginal !== undefined) {
      where.isOriginal = filters.isOriginal
    }

    // Фильтр по характеристикам
    if (filters.characteristics && filters.characteristics.length > 0) {
      const characteristicConditions = this.buildCharacteristicConditions(filters.characteristics)
      if (characteristicConditions.length > 0) {
        where.AND = characteristicConditions
      }
    }

    return where
  }

  /**
   * Построение условий для фильтрации по характеристикам
   */
  private buildCharacteristicConditions(
    characteristics: CharacteristicFilter[],
  ): Prisma.ProductWhereInput[] {
    const conditions: Prisma.ProductWhereInput[] = []

    for (const char of characteristics) {
      const condition: Prisma.ProductWhereInput = {
        characteristics: {
          some: {
            characteristicId: char.characteristicId,
          },
        },
      }

      // Добавляем условия в зависимости от типа характеристики
      const charCondition = condition.characteristics!.some as any

      switch (char.type) {
        case CharacteristicType.SELECT:
          if (char.values && char.values.length > 0) {
            charCondition.characteristicValueId = {
              in: char.values,
            }
          }
          break

        case CharacteristicType.NUMBER:
          if (char.range) {
            const valueConditions: any = {}
            if (char.range.min !== undefined) {
              valueConditions.gte = char.range.min.toString()
            }
            if (char.range.max !== undefined) {
              valueConditions.lte = char.range.max.toString()
            }
            if (Object.keys(valueConditions).length > 0) {
              charCondition.value = valueConditions
            }
          }
          break

        case CharacteristicType.BOOLEAN:
          if (char.booleanValue !== undefined) {
            charCondition.value = char.booleanValue.toString()
          }
          break

        case CharacteristicType.TEXT:
          if (char.values && char.values.length > 0) {
            charCondition.value = {
              in: char.values,
            }
          }
          break
      }

      conditions.push(condition)
    }

    return conditions
  }

  /**
   * Получение доступных фильтров с количеством товаров (фасетный поиск)
   */
  @Cacheable({
    key: (filters: GetFiltersDto) => `${CacheKeys.PRODUCTS}filters:${JSON.stringify(filters)}`,
    ttl: CacheTTL.PRODUCTS,
  })
  async getAvailableFilters(filters: GetFiltersDto): Promise<AvailableFilters> {
    const baseWhere: Prisma.ProductWhereInput = {
      deletedAt: null,
      isActive: true,
    }

    // Если указана категория, получаем все подкатегории
    let categoryContext: string[] = []
    if (filters.categoryId) {
      categoryContext = await this.categoriesService.getAllSubcategoryIds(filters.categoryId)
      baseWhere.categories = {
        some: {
          categoryId: {
            in: categoryContext,
          },
        },
      }
    }

    // Применяем текущие фильтры для умной фильтрации
    let appliedWhere: Prisma.ProductWhereInput = { ...baseWhere }
    if (filters.appliedFilters) {
      appliedWhere = await this.buildWhereClause({
        ...filters.appliedFilters,
        categoryIds: filters.categoryId ? [filters.categoryId] : filters.appliedFilters.categoryIds,
      })
    }

    const [categories, brands, priceRange, characteristics, totalCount] = await Promise.all([
      this.getCategoryFacet(appliedWhere, filters.appliedFilters?.categoryIds),
      this.getBrandFacet(appliedWhere, filters.appliedFilters?.brandIds),
      this.getPriceRange(appliedWhere),
      this.getCharacteristicFacets(appliedWhere, categoryContext),
      this.prisma.product.count({ where: appliedWhere }),
    ])

    return {
      categories,
      brands,
      priceRange,
      characteristics,
      totalCount,
    }
  }

  /**
   * Получение фасета категорий
   */
  private async getCategoryFacet(
    baseWhere: Prisma.ProductWhereInput,
    selectedCategoryIds?: string[],
  ): Promise<FilterFacet> {
    // Получаем категории с количеством товаров
    const categoriesWithCount = await this.prisma.productCategory.groupBy({
      by: ['categoryId'],
      where: {
        product: baseWhere,
      },
      _count: {
        id: true,
      },
    })

    // Получаем информацию о категориях
    const categoryIds = categoriesWithCount.map((c) => c.categoryId)
    const categories = await this.prisma.category.findMany({
      where: {
        id: { in: categoryIds },
        isActive: true,
        deletedAt: null,
      },
    })

    const categoryMap = new Map(categories.map((c) => [c.id, c]))

    const values: FilterValue[] = categoriesWithCount
      .reduce<FilterValue[]>((acc, item) => {
        const category = categoryMap.get(item.categoryId)
        if (category) {
          acc.push({
            value: item.categoryId,
            label: category.name,
            count: item._count.id,
            selected: selectedCategoryIds?.includes(item.categoryId),
          })
        }
        return acc
      }, [])
      .sort((a, b) => b.count - a.count)

    return {
      field: 'categoryIds',
      label: 'Категории',
      type: FilterType.MULTI_SELECT,
      values,
    }
  }

  /**
   * Получение фасета брендов
   */
  private async getBrandFacet(
    baseWhere: Prisma.ProductWhereInput,
    selectedBrandIds?: string[],
  ): Promise<FilterFacet> {
    const brandsWithCount = await this.prisma.product.groupBy({
      by: ['brandId'],
      where: baseWhere,
      _count: {
        id: true,
      },
    })

    const brandIds = brandsWithCount.map((b) => b.brandId)
    const brands = await this.prisma.brand.findMany({
      where: {
        id: { in: brandIds },
        isActive: true,
      },
    })

    const brandMap = new Map(brands.map((b) => [b.id, b]))

    const values: FilterValue[] = brandsWithCount
      .reduce<FilterValue[]>((acc, item) => {
        const brand = brandMap.get(item.brandId)
        if (brand) {
          acc.push({
            value: item.brandId,
            label: brand.name,
            count: item._count.id,
            selected: selectedBrandIds?.includes(item.brandId),
          })
        }
        return acc
      }, [])
      .sort((a, b) => b.count - a.count)

    return {
      field: 'brandIds',
      label: 'Бренды',
      type: FilterType.MULTI_SELECT,
      values,
    }
  }

  /**
   * Получение диапазона цен
   */
  private async getPriceRange(baseWhere: Prisma.ProductWhereInput): Promise<PriceRange> {
    const result = await this.prisma.product.aggregate({
      where: baseWhere,
      _min: { price: true },
      _max: { price: true },
    })

    return {
      min: Number(result._min.price) || 0,
      max: Number(result._max.price) || 0,
    }
  }

  /**
   * Получение фасетов характеристик
   */
  private async getCharacteristicFacets(
    baseWhere: Prisma.ProductWhereInput,
    categoryIds: string[],
  ): Promise<CharacteristicFilterFacet[]> {
    // Получаем характеристики для категорий
    const characteristics =
      categoryIds.length > 0
        ? await this.characteristicsService.findByCategoryId(categoryIds[0])
        : await this.characteristicsService.findAll({ isFilterable: true })

    const filterableCharacteristics = characteristics.filter((c) => c.isFilterable)

    const facets: CharacteristicFilterFacet[] = []

    for (const characteristic of filterableCharacteristics) {
      let facet: CharacteristicFilterFacet | null = null

      switch (characteristic.type as CharacteristicType) {
        case CharacteristicType.SELECT:
          facet = await this.getSelectCharacteristicFacet(characteristic, baseWhere)
          break

        case CharacteristicType.NUMBER:
          if (characteristic.filterType === 'range') {
            facet = await this.getNumberRangeCharacteristicFacet(characteristic, baseWhere)
          } else {
            facet = await this.getNumberCheckboxCharacteristicFacet(characteristic, baseWhere)
          }
          break

        case CharacteristicType.BOOLEAN:
          facet = await this.getBooleanCharacteristicFacet(characteristic, baseWhere)
          break

        case CharacteristicType.TEXT:
          if (characteristic.filterType === 'checkbox') {
            facet = await this.getTextCharacteristicFacet(characteristic, baseWhere)
          }
          break
      }

      if (facet && (facet.values.length > 0 || facet.type === FilterType.RANGE)) {
        facets.push(facet)
      }
    }

    return facets.sort((a, b) => a.label.localeCompare(b.label))
  }

  /**
   * Фасет для характеристик типа SELECT
   */
  private async getSelectCharacteristicFacet(
    characteristic: any,
    baseWhere: Prisma.ProductWhereInput,
  ): Promise<CharacteristicFilterFacet> {
    const valuesWithCount = await this.prisma.productCharacteristic.groupBy({
      by: ['characteristicValueId'],
      where: {
        characteristicId: characteristic.id,
        characteristicValueId: { not: null },
        product: baseWhere,
      },
      _count: {
        id: true,
      },
    })

    const values: FilterValue[] = valuesWithCount
      .reduce<FilterValue[]>((acc, item) => {
        if (item.characteristicValueId) {
          const charValue = characteristic.values?.find(
            (v: any) => v.id === item.characteristicValueId,
          )
          if (charValue) {
            acc.push({
              value: item.characteristicValueId,
              label: charValue.value,
              count: item._count.id,
            })
          }
        }
        return acc
      }, [])
      .sort((a, b) => a.label.localeCompare(b.label))

    return {
      field: `char_${characteristic.id}`,
      label: characteristic.name,
      type:
        characteristic.filterType === 'select' ? FilterType.SINGLE_SELECT : FilterType.MULTI_SELECT,
      values,
      characteristicId: characteristic.id,
      characteristicType: CharacteristicType.SELECT,
      unit: characteristic.unit,
    }
  }

  /**
   * Фасет для числовых характеристик с диапазоном
   */
  private async getNumberRangeCharacteristicFacet(
    characteristic: any,
    baseWhere: Prisma.ProductWhereInput,
  ): Promise<CharacteristicFilterFacet> {
    const result = await this.prisma.$queryRaw<Array<{ min: number; max: number }>>`
      SELECT 
        MIN(CAST(value AS DECIMAL)) as min,
        MAX(CAST(value AS DECIMAL)) as max
      FROM product_characteristic pc
      INNER JOIN product p ON pc.product_id = p.id
      WHERE pc.characteristic_id = ${characteristic.id}
        AND pc.value IS NOT NULL
        AND pc.value ~ '^[0-9]+\.?[0-9]*$'
        AND p.deleted_at IS NULL
        AND p.is_active = true
    `

    const range = result[0] || { min: 0, max: 0 }

    return {
      field: `char_${characteristic.id}`,
      label: characteristic.name,
      type: FilterType.RANGE,
      values: [
        {
          value: 'range',
          label: `${range.min} - ${range.max}`,
          count: 0,
        },
      ],
      characteristicId: characteristic.id,
      characteristicType: CharacteristicType.NUMBER,
      unit: characteristic.unit,
    }
  }

  /**
   * Фасет для числовых характеристик с чекбоксами
   */
  private async getNumberCheckboxCharacteristicFacet(
    characteristic: any,
    baseWhere: Prisma.ProductWhereInput,
  ): Promise<CharacteristicFilterFacet> {
    const valuesWithCount = await this.prisma.productCharacteristic.groupBy({
      by: ['value'],
      where: {
        characteristicId: characteristic.id,
        value: { not: null },
        product: baseWhere,
      },
      _count: {
        id: true,
      },
    })

    const values: FilterValue[] = valuesWithCount
      .reduce<FilterValue[]>((acc, item) => {
        if (item.value) {
          acc.push({
            value: item.value,
            label: characteristic.unit ? `${item.value} ${characteristic.unit}` : item.value,
            count: item._count.id,
          })
        }
        return acc
      }, [])
      .sort((a, b) => {
        const numA = parseFloat(a.value)
        const numB = parseFloat(b.value)
        return numA - numB
      })

    return {
      field: `char_${characteristic.id}`,
      label: characteristic.name,
      type: FilterType.MULTI_SELECT,
      values,
      characteristicId: characteristic.id,
      characteristicType: CharacteristicType.NUMBER,
      unit: characteristic.unit,
    }
  }

  /**
   * Фасет для булевых характеристик
   */
  private async getBooleanCharacteristicFacet(
    characteristic: any,
    baseWhere: Prisma.ProductWhereInput,
  ): Promise<CharacteristicFilterFacet> {
    const [trueCount, falseCount] = await Promise.all([
      this.prisma.productCharacteristic.count({
        where: {
          characteristicId: characteristic.id,
          value: 'true',
          product: baseWhere,
        },
      }),
      this.prisma.productCharacteristic.count({
        where: {
          characteristicId: characteristic.id,
          value: 'false',
          product: baseWhere,
        },
      }),
    ])

    const values: FilterValue[] = []

    if (trueCount > 0) {
      values.push({
        value: 'true',
        label: 'Да',
        count: trueCount,
      })
    }

    if (falseCount > 0) {
      values.push({
        value: 'false',
        label: 'Нет',
        count: falseCount,
      })
    }

    return {
      field: `char_${characteristic.id}`,
      label: characteristic.name,
      type: FilterType.BOOLEAN,
      values,
      characteristicId: characteristic.id,
      characteristicType: CharacteristicType.BOOLEAN,
      unit: characteristic.unit,
    }
  }

  /**
   * Фасет для текстовых характеристик
   */
  private async getTextCharacteristicFacet(
    characteristic: any,
    baseWhere: Prisma.ProductWhereInput,
  ): Promise<CharacteristicFilterFacet> {
    const valuesWithCount = await this.prisma.productCharacteristic.groupBy({
      by: ['value'],
      where: {
        characteristicId: characteristic.id,
        value: { not: null },
        product: baseWhere,
      },
      _count: {
        id: true,
      },
      orderBy: {
        _count: {
          id: 'desc',
        },
      },
      take: 20, // Ограничиваем количество значений для текстовых характеристик
    })

    const values: FilterValue[] = valuesWithCount.reduce<FilterValue[]>((acc, item) => {
      if (item.value) {
        acc.push({
          value: item.value,
          label: item.value,
          count: item._count.id,
        })
      }
      return acc
    }, [])

    return {
      field: `char_${characteristic.id}`,
      label: characteristic.name,
      type: FilterType.MULTI_SELECT,
      values,
      characteristicId: characteristic.id,
      characteristicType: CharacteristicType.TEXT,
      unit: characteristic.unit,
    }
  }
}
