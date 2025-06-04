// src/modules/products/products.service.ts
import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { Prisma } from '@prisma/client'
import { CreateProductDto } from './dto/create-product.dto'
import { UpdateProductDto } from './dto/update-product.dto'
import { ProductsFilterDto } from './dto/products-filter.dto'
import { PaginationDto } from '@common/dto/pagination.dto'
import { PaginatedResult } from '@common/interfaces/paginated-result.interface'
import { PaginationUtil } from '@common/utils/pagination.util'
import { PrismaErrorHelper } from '@common/helpers/prisma-error.helper'
import { Cacheable, CacheEvict } from '@common/decorators/cacheable.decorator'
import { CacheKeys, CacheTTL } from '../../redis/redis.constants'
import { RedisService } from '../../redis/redis.service'
import { CategoriesService } from '../categories/categories.service'
import { ProductWithRelations } from './interfaces/product.interface'
import { SetProductCharacteristicDto } from '../characteristics/dto/characteristic-value.dto'
import { CharacteristicsService } from '../characteristics/characteristics.service'

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly categoriesService: CategoriesService,
    private readonly characteristicsService: CharacteristicsService,
  ) {}

  async create(createProductDto: CreateProductDto): Promise<ProductWithRelations> {
    try {
      const { categoryIds, images, ...productData } = createProductDto

      // Проверяем уникальность slug и sku
      const existingProduct = await this.prisma.product.findFirst({
        where: {
          OR: [{ slug: productData.slug }, { sku: productData.sku }],
        },
      })

      if (existingProduct) {
        if (existingProduct.slug === productData.slug) {
          throw new ConflictException('Товар с таким slug уже существует')
        }
        if (existingProduct.sku === productData.sku) {
          throw new ConflictException('Товар с таким артикулом уже существует')
        }
      }

      // Проверяем существование бренда
      const brand = await this.prisma.brand.findUnique({
        where: { id: productData.brandId },
      })

      if (!brand) {
        throw new NotFoundException('Бренд не найден')
      }

      // Проверяем существование категорий
      for (const categoryId of categoryIds) {
        const category = await this.categoriesService.findById(categoryId)
        if (!category) {
          throw new NotFoundException(`Категория ${categoryId} не найдена`)
        }
      }

      // Создаем товар с связями
      const product = await this.prisma.product.create({
        data: {
          ...productData,
          categories: {
            create: categoryIds.map((categoryId, index) => ({
              categoryId,
              isPrimary: index === 0, // Первая категория - основная
            })),
          },
          images: images
            ? {
                create: images.map((image, index) => ({
                  ...image,
                  sortOrder: image.sortOrder ?? index,
                })),
              }
            : undefined,
        },
        include: this.getProductInclude(),
      })

      // Инвалидируем кеш списка товаров
      await this.invalidateProductListCache()

      return product
    } catch (error) {
      PrismaErrorHelper.handleError(error)
    }
  }

  @Cacheable({
    key: (id: string) => `${CacheKeys.PRODUCT}${id}`,
    ttl: CacheTTL.PRODUCT,
  })
  async findById(id: string): Promise<ProductWithRelations | null> {
    return this.prisma.product.findUnique({
      where: { id },
      include: this.getProductInclude(),
    })
  }

  async findBySlug(slug: string): Promise<ProductWithRelations | null> {
    return this.prisma.product.findFirst({
      where: {
        slug,
        deletedAt: null,
      },
      include: this.getProductInclude(),
    })
  }

  async findBySku(sku: string): Promise<ProductWithRelations | null> {
    return this.prisma.product.findFirst({
      where: {
        sku,
        deletedAt: null,
      },
      include: this.getProductInclude(),
    })
  }

  async findAll(
    paginationDto: PaginationDto,
    filterDto: ProductsFilterDto,
  ): Promise<PaginatedResult<ProductWithRelations>> {
    const { page, limit } = PaginationUtil.validatePagination(
      paginationDto.page,
      paginationDto.limit,
    )

    const where = this.buildWhereClause(filterDto)
    const orderBy = this.buildOrderByClause(filterDto)

    const [products, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        include: this.getProductListInclude(),
        skip: PaginationUtil.getSkip(page, limit),
        take: limit,
        orderBy,
      }),
      this.prisma.product.count({ where }),
    ])

    return PaginationUtil.createPaginatedResult(
      products as ProductWithRelations[],
      total,
      page,
      limit,
    )
  }

  async findByCategory(
    categoryId: string,
    paginationDto: PaginationDto,
    filterDto: ProductsFilterDto,
  ): Promise<PaginatedResult<ProductWithRelations>> {
    // Получаем все подкатегории
    const categoryIds = await this.categoriesService.getAllSubcategoryIds(categoryId)

    // Добавляем фильтр по категориям
    const extendedFilter = {
      ...filterDto,
      categoryIds: categoryIds,
    }

    return this.findAll(paginationDto, extendedFilter)
  }

  @CacheEvict({
    key: (id: string) => `${CacheKeys.PRODUCT}${id}`,
  })
  async update(id: string, updateProductDto: UpdateProductDto): Promise<ProductWithRelations> {
    try {
      const product = await this.findById(id)
      if (!product) {
        throw new NotFoundException('Товар не найден')
      }

      const { categoryIds, images, ...productData } = updateProductDto

      // Если меняется бренд, проверяем его существование
      if (productData.brandId) {
        const brand = await this.prisma.brand.findUnique({
          where: { id: productData.brandId },
        })
        if (!brand) {
          throw new NotFoundException('Бренд не найден')
        }
      }

      // Обновляем товар
      const updatedProduct = await this.prisma.product.update({
        where: { id },
        data: {
          ...productData,
          updatedAt: new Date(),
        },
        include: this.getProductInclude(),
      })

      // Обновляем категории, если они переданы
      if (categoryIds !== undefined) {
        // Проверяем существование категорий
        for (const categoryId of categoryIds) {
          const category = await this.categoriesService.findById(categoryId)
          if (!category) {
            throw new NotFoundException(`Категория ${categoryId} не найдена`)
          }
        }

        // Удаляем старые связи
        await this.prisma.productCategory.deleteMany({
          where: { productId: id },
        })

        // Создаем новые связи
        if (categoryIds.length > 0) {
          await this.prisma.productCategory.createMany({
            data: categoryIds.map((categoryId, index) => ({
              productId: id,
              categoryId,
              isPrimary: index === 0,
            })),
          })
        }
      }

      // Обновляем изображения, если они переданы
      if (images !== undefined) {
        // Удаляем старые изображения
        await this.prisma.productImage.deleteMany({
          where: { productId: id },
        })

        // Создаем новые изображения
        if (images.length > 0) {
          await this.prisma.productImage.createMany({
            data: images.map((image, index) => ({
              productId: id,
              ...image,
              sortOrder: image.sortOrder ?? index,
            })),
          })
        }
      }

      // Получаем обновленный товар со всеми связями
      const finalProduct = await this.findById(id)
      if (!finalProduct) {
        throw new Error('Failed to retrieve updated product')
      }

      // Инвалидируем кеш
      await this.invalidateProductListCache()

      return finalProduct
    } catch (error) {
      PrismaErrorHelper.handleError(error)
    }
  }

  @CacheEvict({
    key: (id: string) => `${CacheKeys.PRODUCT}${id}`,
  })
  async softDelete(id: string): Promise<void> {
    const product = await this.findById(id)
    if (!product) {
      throw new NotFoundException('Товар не найден')
    }

    // Проверяем, нет ли активных заказов с этим товаром
    const activeOrdersCount = await this.prisma.orderItem.count({
      where: {
        productId: id,
        order: {
          status: {
            isFinalSuccess: false,
            isFinalFailure: false,
          },
        },
      },
    })

    if (activeOrdersCount > 0) {
      throw new ConflictException(
        `Невозможно удалить товар. Существует ${activeOrdersCount} активных заказов с этим товаром`,
      )
    }

    await this.prisma.product.update({
      where: { id },
      data: { deletedAt: new Date() },
    })

    // Инвалидируем кеш
    await this.invalidateProductListCache()
  }

  private buildWhereClause(filterDto: ProductsFilterDto): Prisma.ProductWhereInput {
    const where: Prisma.ProductWhereInput = {
      deletedAt: null,
    }

    if (!filterDto.includeInactive) {
      where.isActive = true
    }

    if (filterDto.search) {
      where.OR = [
        { name: { contains: filterDto.search, mode: 'insensitive' } },
        { sku: { contains: filterDto.search, mode: 'insensitive' } },
        { description: { contains: filterDto.search, mode: 'insensitive' } },
      ]
    }

    if (filterDto.categoryId) {
      where.categories = {
        some: {
          categoryId: filterDto.categoryId,
        },
      }
    }

    if (filterDto.categoryIds && filterDto.categoryIds.length > 0) {
      where.categories = {
        some: {
          categoryId: {
            in: filterDto.categoryIds,
          },
        },
      }
    }

    if (filterDto.brandId) {
      where.brandId = filterDto.brandId
    }

    if (filterDto.brandIds && filterDto.brandIds.length > 0) {
      where.brandId = {
        in: filterDto.brandIds,
      }
    }

    if (filterDto.minPrice !== undefined) {
      where.price = {
        gte: filterDto.minPrice,
      }
    }

    if (filterDto.maxPrice !== undefined) {
      where.price = {
        ...((where.price as any) || {}),
        lte: filterDto.maxPrice,
      }
    }

    if (filterDto.inStock) {
      where.stock = {
        gt: 0,
      }
    }

    if (filterDto.isOriginal !== undefined) {
      where.isOriginal = filterDto.isOriginal
    }

    return where
  }

  private buildOrderByClause(filterDto: ProductsFilterDto): Prisma.ProductOrderByWithRelationInput {
    const { sortBy = 'name', sortOrder = 'asc' } = filterDto

    const orderByMap: Record<string, Prisma.ProductOrderByWithRelationInput> = {
      name: { name: sortOrder },
      price: { price: sortOrder },
      createdAt: { createdAt: sortOrder },
      stock: { stock: sortOrder },
      sku: { sku: sortOrder },
    }

    return orderByMap[sortBy] || { name: 'asc' }
  }

  private getProductInclude() {
    return {
      brand: true,
      categories: {
        include: {
          category: true,
        },
        orderBy: {
          isPrimary: 'desc' as const,
        },
      },
      images: {
        orderBy: {
          sortOrder: 'asc' as const,
        },
      },
      characteristics: {
        include: {
          characteristic: {
            include: {
              values: true,
            },
          },
          characteristicValue: true,
        },
      },
      _count: {
        select: {
          vehicleApplications: true,
          crossReferences: true,
        },
      },
    }
  }

  private getProductListInclude() {
    return {
      brand: true,
      images: {
        take: 1,
        orderBy: {
          sortOrder: 'asc' as const,
        },
      },
    }
  }

  private async invalidateProductListCache(): Promise<void> {
    await this.redisService.delByPattern(`${CacheKeys.PRODUCTS}*`)
  }

  async getRelatedProducts(productId: string, limit = 8): Promise<ProductWithRelations[]> {
    const product = await this.findById(productId)
    if (!product) {
      throw new NotFoundException('Товар не найден')
    }

    // Получаем ID категорий текущего товара
    const categoryIds = product.categories.map((pc) => pc.category.id)

    // Ищем похожие товары в тех же категориях
    return this.prisma.product.findMany({
      where: {
        id: { not: productId },
        deletedAt: null,
        isActive: true,
        stock: { gt: 0 },
        categories: {
          some: {
            categoryId: {
              in: categoryIds,
            },
          },
        },
      },
      include: this.getProductListInclude(),
      take: limit,
      orderBy: [{ stock: 'desc' }, { createdAt: 'desc' }],
    }) as Promise<ProductWithRelations[]>
  }

  async setProductCharacteristics(
    productId: string,
    characteristics: SetProductCharacteristicDto[],
  ): Promise<void> {
    const product = await this.findById(productId)
    if (!product) {
      throw new NotFoundException('Товар не найден')
    }

    // Валидируем все характеристики
    for (const char of characteristics) {
      const characteristic = await this.characteristicsService.findById(char.characteristicId)
      if (!characteristic) {
        throw new NotFoundException(`Характеристика ${char.characteristicId} не найдена`)
      }

      // Проверяем, что характеристика применима к категориям товара
      const productCategoryIds = product.categories.map((pc) => pc.category.id)
      const charCategoryIds = characteristic.categories?.map((cc) => cc.category.id) || []

      // Если у характеристики есть категории, проверяем пересечение
      if (charCategoryIds.length > 0) {
        const hasIntersection = productCategoryIds.some((id) => charCategoryIds.includes(id))
        if (!hasIntersection) {
          throw new BadRequestException(
            `Характеристика "${characteristic.name}" не применима к категориям данного товара`,
          )
        }
      }

      // Валидируем значение
      let validationValue: any = {}
      switch (characteristic.type) {
        case 'text':
          validationValue.textValue = char.value
          break
        case 'number':
          validationValue.numberValue = char.value ? parseFloat(char.value) : undefined
          break
        case 'boolean':
          validationValue.booleanValue = char.value === 'true'
          break
        case 'select':
          validationValue.selectValueId = char.characteristicValueId
          break
      }

      const validation = await this.characteristicsService.validateCharacteristicValue(
        char.characteristicId,
        validationValue,
      )

      if (!validation.isValid) {
        throw new BadRequestException(validation.message)
      }
    }

    // Удаляем старые значения
    await this.prisma.productCharacteristic.deleteMany({
      where: { productId },
    })

    // Создаем новые значения
    if (characteristics.length > 0) {
      await this.prisma.productCharacteristic.createMany({
        data: characteristics.map((char) => ({
          productId,
          characteristicId: char.characteristicId,
          value: char.value || null,
          characteristicValueId: char.characteristicValueId || null,
        })),
      })
    }

    // Инвалидируем кеш товара
    await this.redisService.del(`${CacheKeys.PRODUCT}${productId}`)
  }

  async getProductCharacteristics(productId: string): Promise<any[]> {
    return this.prisma.productCharacteristic.findMany({
      where: { productId },
      include: {
        characteristic: {
          include: {
            values: true,
          },
        },
        characteristicValue: true,
      },
    })
  }
}
