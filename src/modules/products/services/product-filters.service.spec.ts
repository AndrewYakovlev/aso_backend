// src/modules/products/services/product-filters.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing'
import { ProductFiltersService } from './product-filters.service'
import { PrismaService } from '../../../prisma/prisma.service'
import { CategoriesService } from '../../categories/categories.service'
import { CharacteristicsService } from '../../characteristics/characteristics.service'
import { ExtendedProductFiltersDto } from '../dto/product-filters.dto'
import { CharacteristicType } from '../../characteristics/interfaces/characteristic.interface'
import { FilterType } from '../interfaces/filter.interface'

describe('ProductFiltersService', () => {
  let service: ProductFiltersService
  let prismaService: PrismaService
  let categoriesService: CategoriesService
  let characteristicsService: CharacteristicsService

  const mockCategory = {
    id: 'cat-1',
    name: 'Масла',
    slug: 'masla',
  }

  const mockBrand = {
    id: 'brand-1',
    name: 'Castrol',
    slug: 'castrol',
  }

  const mockCharacteristic = {
    id: 'char-1',
    name: 'Вязкость',
    code: 'viscosity',
    type: CharacteristicType.SELECT,
    isFilterable: true,
    filterType: 'checkbox',
    values: [
      { id: 'val-1', value: '5W-30', sortOrder: 0 },
      { id: 'val-2', value: '5W-40', sortOrder: 1 },
    ],
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductFiltersService,
        {
          provide: PrismaService,
          useValue: {
            product: {
              aggregate: jest.fn(),
              count: jest.fn(),
              groupBy: jest.fn(),
            },
            productCategory: {
              groupBy: jest.fn(),
            },
            productCharacteristic: {
              groupBy: jest.fn(),
              count: jest.fn(),
            },
            category: {
              findMany: jest.fn(),
            },
            brand: {
              findMany: jest.fn(),
            },
            $queryRaw: jest.fn(),
          },
        },
        {
          provide: CategoriesService,
          useValue: {
            getAllSubcategoryIds: jest.fn(),
          },
        },
        {
          provide: CharacteristicsService,
          useValue: {
            findByCategoryId: jest.fn(),
            findAll: jest.fn(),
          },
        },
      ],
    }).compile()

    service = module.get<ProductFiltersService>(ProductFiltersService)
    prismaService = module.get<PrismaService>(PrismaService)
    categoriesService = module.get<CategoriesService>(CategoriesService)
    characteristicsService = module.get<CharacteristicsService>(CharacteristicsService)
  })

  describe('buildWhereClause', () => {
    it('should build basic where clause', async () => {
      const filters: ExtendedProductFiltersDto = {
        search: 'масло',
        inStock: true,
        isOriginal: true,
      }

      jest.spyOn(categoriesService, 'getAllSubcategoryIds').mockResolvedValue([])

      const where = await service.buildWhereClause(filters)

      expect(where).toMatchObject({
        deletedAt: null,
        isActive: true,
        stock: { gt: 0 },
        isOriginal: true,
        OR: [
          { name: { contains: 'масло', mode: 'insensitive' } },
          { sku: { contains: 'масло', mode: 'insensitive' } },
          { description: { contains: 'масло', mode: 'insensitive' } },
          { shortDescription: { contains: 'масло', mode: 'insensitive' } },
        ],
      })
    })

    it('should build where clause with category filter', async () => {
      const filters: ExtendedProductFiltersDto = {
        categoryIds: ['cat-1', 'cat-2'],
      }

      jest
        .spyOn(categoriesService, 'getAllSubcategoryIds')
        .mockResolvedValueOnce(['cat-1', 'cat-1-1', 'cat-1-2'])
        .mockResolvedValueOnce(['cat-2', 'cat-2-1'])

      const where = await service.buildWhereClause(filters)

      expect(where.categories).toEqual({
        some: {
          categoryId: {
            in: ['cat-1', 'cat-1-1', 'cat-1-2', 'cat-2', 'cat-2-1'],
          },
        },
      })
    })

    it('should build where clause with price range', async () => {
      const filters: ExtendedProductFiltersDto = {
        priceRange: { min: 1000, max: 5000 },
      }

      const where = await service.buildWhereClause(filters)

      expect(where.price).toEqual({
        gte: 1000,
        lte: 5000,
      })
    })

    it('should build where clause with characteristic filters', async () => {
      const filters: ExtendedProductFiltersDto = {
        characteristics: [
          {
            characteristicId: 'char-1',
            type: CharacteristicType.SELECT,
            values: ['val-1', 'val-2'],
          },
          {
            characteristicId: 'char-2',
            type: CharacteristicType.NUMBER,
            range: { min: 10, max: 50 },
          },
        ],
      }

      const where = await service.buildWhereClause(filters)

      expect(where.AND).toHaveLength(2)
      expect(where.AND?.[0]).toMatchObject({
        characteristics: {
          some: {
            characteristicId: 'char-1',
            characteristicValueId: { in: ['val-1', 'val-2'] },
          },
        },
      })
    })
  })

  describe('getAvailableFilters', () => {
    beforeEach(() => {
      // Мок для категорий
      jest.spyOn(prismaService.productCategory, 'groupBy').mockResolvedValue([
        { categoryId: 'cat-1', _count: { id: 10 } },
        { categoryId: 'cat-2', _count: { id: 5 } },
      ])
      jest.spyOn(prismaService.category, 'findMany').mockResolvedValue([
        { id: 'cat-1', name: 'Масла', isActive: true, deletedAt: null },
        { id: 'cat-2', name: 'Фильтры', isActive: true, deletedAt: null },
      ] as any)

      // Мок для брендов
      jest.spyOn(prismaService.product, 'groupBy').mockResolvedValue([
        { brandId: 'brand-1', _count: { id: 15 } },
        { brandId: 'brand-2', _count: { id: 8 } },
      ])
      jest.spyOn(prismaService.brand, 'findMany').mockResolvedValue([
        { id: 'brand-1', name: 'Castrol', isActive: true },
        { id: 'brand-2', name: 'Mobil', isActive: true },
      ] as any)

      // Мок для диапазона цен
      jest.spyOn(prismaService.product, 'aggregate').mockResolvedValue({
        _min: { price: 1000 },
        _max: { price: 5000 },
      } as any)

      // Мок для характеристик
      jest.spyOn(characteristicsService, 'findAll').mockResolvedValue([mockCharacteristic] as any)
      jest
        .spyOn(characteristicsService, 'findByCategoryId')
        .mockResolvedValue([mockCharacteristic] as any)

      jest.spyOn(prismaService.productCharacteristic, 'groupBy').mockResolvedValue([
        { characteristicValueId: 'val-1', _count: { id: 7 } },
        { characteristicValueId: 'val-2', _count: { id: 3 } },
      ])

      // Мок для общего количества
      jest.spyOn(prismaService.product, 'count').mockResolvedValue(20)

      // Мок для getAllSubcategoryIds
      jest.spyOn(categoriesService, 'getAllSubcategoryIds').mockResolvedValue(['cat-1'])
    })

    it('should return available filters', async () => {
      const result = await service.getAvailableFilters({})

      expect(result).toMatchObject({
        categories: {
          field: 'categoryIds',
          label: 'Категории',
          type: FilterType.MULTI_SELECT,
          values: expect.arrayContaining([
            { value: 'cat-1', label: 'Масла', count: 10 },
            { value: 'cat-2', label: 'Фильтры', count: 5 },
          ]),
        },
        brands: {
          field: 'brandIds',
          label: 'Бренды',
          type: FilterType.MULTI_SELECT,
          values: expect.arrayContaining([
            { value: 'brand-1', label: 'Castrol', count: 15 },
            { value: 'brand-2', label: 'Mobil', count: 8 },
          ]),
        },
        priceRange: {
          min: 1000,
          max: 5000,
        },
        totalCount: 20,
      })
    })

    it('should return filters for specific category', async () => {
      const result = await service.getAvailableFilters({
        categoryId: 'cat-1',
      })

      expect(categoriesService.getAllSubcategoryIds).toHaveBeenCalledWith('cat-1')
      expect(characteristicsService.findByCategoryId).toHaveBeenCalledWith('cat-1')
      expect(result.totalCount).toBe(20)
    })

    it('should apply smart filtering with applied filters', async () => {
      const result = await service.getAvailableFilters({
        appliedFilters: {
          brandIds: ['brand-1'],
          inStock: true,
        },
      })

      expect(result).toBeDefined()
      expect(result.brands.values).toHaveLength(2)
      expect(result.brands.values[0].selected).toBeUndefined()
    })
  })

  describe('characteristic facets', () => {
    it('should build select characteristic facet', async () => {
      jest.spyOn(prismaService.productCharacteristic, 'groupBy').mockResolvedValue([
        { characteristicValueId: 'val-1', _count: { id: 10 } },
        { characteristicValueId: 'val-2', _count: { id: 5 } },
      ])

      jest.spyOn(characteristicsService, 'findAll').mockResolvedValue([
        {
          ...mockCharacteristic,
          filterType: 'checkbox',
        },
      ] as any)

      const result = await service.getAvailableFilters({})

      const charFacet = result.characteristics.find((c) => c.characteristicId === 'char-1')
      expect(charFacet).toMatchObject({
        field: 'char_char-1',
        label: 'Вязкость',
        type: FilterType.MULTI_SELECT,
        characteristicType: CharacteristicType.SELECT,
        values: [
          { value: 'val-1', label: '5W-30', count: 10 },
          { value: 'val-2', label: '5W-40', count: 5 },
        ],
      })
    })

    it('should build number range characteristic facet', async () => {
      jest.spyOn(characteristicsService, 'findAll').mockResolvedValue([
        {
          id: 'char-2',
          name: 'Объем',
          type: CharacteristicType.NUMBER,
          isFilterable: true,
          filterType: 'range',
          unit: 'л',
        },
      ] as any)

      jest.spyOn(prismaService, '$queryRaw').mockResolvedValue([{ min: 1, max: 5 }])

      const result = await service.getAvailableFilters({})

      const charFacet = result.characteristics.find((c) => c.characteristicId === 'char-2')
      expect(charFacet).toMatchObject({
        field: 'char_char-2',
        label: 'Объем',
        type: FilterType.RANGE,
        characteristicType: CharacteristicType.NUMBER,
        unit: 'л',
      })
    })

    it('should build boolean characteristic facet', async () => {
      jest.spyOn(characteristicsService, 'findAll').mockResolvedValue([
        {
          id: 'char-3',
          name: 'Синтетическое',
          type: CharacteristicType.BOOLEAN,
          isFilterable: true,
        },
      ] as any)

      jest
        .spyOn(prismaService.productCharacteristic, 'count')
        .mockResolvedValueOnce(15) // true count
        .mockResolvedValueOnce(5) // false count

      const result = await service.getAvailableFilters({})

      const charFacet = result.characteristics.find((c) => c.characteristicId === 'char-3')
      expect(charFacet).toMatchObject({
        field: 'char_char-3',
        label: 'Синтетическое',
        type: FilterType.BOOLEAN,
        characteristicType: CharacteristicType.BOOLEAN,
        values: [
          { value: 'true', label: 'Да', count: 15 },
          { value: 'false', label: 'Нет', count: 5 },
        ],
      })
    })
  })
})
