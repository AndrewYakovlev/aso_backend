// src/modules/vehicle-applications/vehicle-applications.service.ts
import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { Prisma } from '@prisma/client'
import {
  CreateVehicleApplicationDto,
  CreateBulkApplicationDto,
} from './dto/create-vehicle-application.dto'
import { UpdateVehicleApplicationDto } from './dto/update-vehicle-application.dto'
import { VehicleApplicationFiltersDto } from './dto/vehicle-application-filters.dto'
import { PrismaErrorHelper } from '@common/helpers/prisma-error.helper'
import { Cacheable, CacheEvict } from '@common/decorators/cacheable.decorator'
import { CacheKeys, CacheTTL } from '../../redis/redis.constants'
import { RedisService } from '../../redis/redis.service'
import { PaginationUtil } from '@common/utils/pagination.util'
import { PaginatedResult } from '@common/interfaces/paginated-result.interface'

@Injectable()
export class VehicleApplicationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
  ) {}

  /**
   * Создать применимость товара к модификациям
   */
  async create(dto: CreateVehicleApplicationDto): Promise<any> {
    try {
      // Проверяем существование товара
      const product = await this.prisma.product.findUnique({
        where: { id: dto.productId },
      })

      if (!product) {
        throw new NotFoundException('Товар не найден')
      }

      // Проверяем существование модификаций
      const modifications = await this.prisma.vehicleModification.findMany({
        where: {
          id: { in: dto.modificationIds },
        },
      })

      if (modifications.length !== dto.modificationIds.length) {
        throw new NotFoundException('Одна или несколько модификаций не найдены')
      }

      // Создаем применимости
      const applications = await Promise.all(
        dto.modificationIds.map(async (modificationId) => {
          try {
            return await this.prisma.vehicleApplication.create({
              data: {
                productId: dto.productId,
                modificationId,
                kTypeId: dto.kTypeId,
                notes: dto.notes,
                isVerified: dto.isVerified || false,
              },
              include: {
                product: {
                  include: {
                    brand: true,
                    images: {
                      where: { sortOrder: 0 },
                      take: 1,
                    },
                  },
                },
                modification: {
                  include: {
                    generation: {
                      include: {
                        model: {
                          include: {
                            make: true,
                          },
                        },
                      },
                    },
                  },
                },
              },
            })
          } catch (error: any) {
            if (error.code === 'P2002') {
              // Уникальное ограничение - пропускаем
              return null
            }
            throw error
          }
        }),
      )

      // Инвалидируем кеш
      await this.invalidateApplicationCache(dto.productId)

      // Фильтруем null значения (дубликаты)
      const createdApplications = applications.filter((app) => app !== null)

      return {
        created: createdApplications.length,
        skipped: dto.modificationIds.length - createdApplications.length,
        applications: createdApplications,
      }
    } catch (error) {
      PrismaErrorHelper.handleError(error)
    }
  }

  /**
   * Массовое создание применимости для нескольких товаров
   */
  async createBulk(dto: CreateBulkApplicationDto): Promise<any> {
    try {
      // Проверяем существование товаров
      const products = await this.prisma.product.findMany({
        where: {
          id: { in: dto.productIds },
        },
      })

      if (products.length !== dto.productIds.length) {
        throw new NotFoundException('Один или несколько товаров не найдены')
      }

      // Проверяем существование модификации
      const modification = await this.prisma.vehicleModification.findUnique({
        where: { id: dto.modificationId },
      })

      if (!modification) {
        throw new NotFoundException('Модификация не найдена')
      }

      // Создаем применимости
      const result = await this.prisma.vehicleApplication.createMany({
        data: dto.productIds.map((productId) => ({
          productId,
          modificationId: dto.modificationId,
          kTypeId: dto.kTypeId,
          notes: dto.notes,
          isVerified: dto.isVerified || false,
        })),
        skipDuplicates: true,
      })

      // Инвалидируем кеш для всех товаров
      await Promise.all(
        dto.productIds.map((productId) => this.invalidateApplicationCache(productId)),
      )

      return {
        created: result.count,
        skipped: dto.productIds.length - result.count,
      }
    } catch (error) {
      PrismaErrorHelper.handleError(error)
    }
  }

  /**
   * Получить все применимости с фильтрацией
   */
  async findAll(filters: VehicleApplicationFiltersDto): Promise<PaginatedResult<any>> {
    const where: Prisma.VehicleApplicationWhereInput = {}

    if (filters.productId) {
      where.productId = filters.productId
    }

    if (filters.modificationId) {
      where.modificationId = filters.modificationId
    }

    if (filters.isVerified !== undefined) {
      where.isVerified = filters.isVerified
    }

    // Фильтрация по иерархии автомобилей
    if (filters.makeId || filters.modelId || filters.generationId) {
      where.modification = {
        generation: {},
      }

      if (filters.generationId) {
        where.modification.generationId = filters.generationId
      }

      if (filters.modelId || filters.makeId) {
        // Убедимся, что generation существует
        if (!where.modification.generation) {
          where.modification.generation = {}
        }

        where.modification.generation.model = {}

        if (filters.modelId) {
          where.modification.generation.modelId = filters.modelId
        }

        if (filters.makeId) {
          where.modification.generation.model.makeId = filters.makeId
        }
      }
    }

    // Используем значения по умолчанию для page и limit
    const page = filters.page || 1
    const limit = filters.limit || 20

    const [items, total] = await Promise.all([
      this.prisma.vehicleApplication.findMany({
        where,
        include: {
          product: {
            include: {
              brand: true,
              images: {
                where: { sortOrder: 0 },
                take: 1,
              },
            },
          },
          modification: {
            include: {
              generation: {
                include: {
                  model: {
                    include: {
                      make: true,
                    },
                  },
                },
              },
            },
          },
        },
        skip: PaginationUtil.getSkip(page, limit),
        take: limit,
        orderBy: { id: 'desc' },
      }),
      this.prisma.vehicleApplication.count({ where }),
    ])

    return PaginationUtil.createPaginatedResult(items, total, page, limit)
  }

  /**
   * Получить применимость по ID
   */
  async findOne(id: string): Promise<any> {
    const application = await this.prisma.vehicleApplication.findUnique({
      where: { id },
      include: {
        product: {
          include: {
            brand: true,
            images: {
              where: { sortOrder: 0 },
              take: 1,
            },
          },
        },
        modification: {
          include: {
            generation: {
              include: {
                model: {
                  include: {
                    make: true,
                  },
                },
              },
            },
          },
        },
      },
    })

    if (!application) {
      throw new NotFoundException('Применимость не найдена')
    }

    return application
  }

  /**
   * Обновить применимость
   */
  @CacheEvict({
    key: (id: string) => `${CacheKeys.VEHICLE_APPS}*`,
  })
  async update(id: string, dto: UpdateVehicleApplicationDto): Promise<any> {
    try {
      const application = await this.findOne(id)

      const updated = await this.prisma.vehicleApplication.update({
        where: { id },
        data: dto,
        include: {
          product: {
            include: {
              brand: true,
              images: {
                where: { sortOrder: 0 },
                take: 1,
              },
            },
          },
          modification: {
            include: {
              generation: {
                include: {
                  model: {
                    include: {
                      make: true,
                    },
                  },
                },
              },
            },
          },
        },
      })

      await this.invalidateApplicationCache(application.productId)

      return updated
    } catch (error) {
      PrismaErrorHelper.handleError(error)
    }
  }

  /**
   * Удалить применимость
   */
  async remove(id: string): Promise<void> {
    const application = await this.findOne(id)

    await this.prisma.vehicleApplication.delete({
      where: { id },
    })

    await this.invalidateApplicationCache(application.productId)
  }

  /**
   * Удалить применимость по товару и модификации
   */
  async removeByProductAndModification(productId: string, modificationId: string): Promise<void> {
    const application = await this.prisma.vehicleApplication.findUnique({
      where: {
        productId_modificationId: {
          productId,
          modificationId,
        },
      },
    })

    if (!application) {
      throw new NotFoundException('Применимость не найдена')
    }

    await this.prisma.vehicleApplication.delete({
      where: {
        productId_modificationId: {
          productId,
          modificationId,
        },
      },
    })

    await this.invalidateApplicationCache(productId)
  }

  /**
   * Получить товары для модификации
   */
  @Cacheable({
    key: (modificationId: string, filters: any) =>
      `${CacheKeys.VEHICLE_APPS}mod:${modificationId}:${JSON.stringify(filters)}`,
    ttl: CacheTTL.VEHICLE_APPS,
  })
  async getProductsForModification(
    modificationId: string,
    filters: VehicleApplicationFiltersDto,
  ): Promise<any> {
    // Проверяем существование модификации
    const modification = await this.prisma.vehicleModification.findUnique({
      where: { id: modificationId },
      include: {
        generation: {
          include: {
            model: {
              include: {
                make: true,
              },
            },
          },
        },
      },
    })

    if (!modification) {
      throw new NotFoundException('Модификация не найдена')
    }

    const where: Prisma.VehicleApplicationWhereInput = {
      modificationId,
    }

    if (filters.isVerified !== undefined) {
      where.isVerified = filters.isVerified
    }

    // Используем значения по умолчанию для page и limit
    const page = filters.page || 1
    const limit = filters.limit || 20

    const [applications, total] = await Promise.all([
      this.prisma.vehicleApplication.findMany({
        where,
        include: {
          product: {
            include: {
              brand: true,
              images: {
                where: { sortOrder: 0 },
                take: 1,
              },
              categories: {
                include: {
                  category: true,
                },
                where: {
                  isPrimary: true,
                },
                take: 1,
              },
            },
          },
        },
        skip: PaginationUtil.getSkip(page, limit),
        take: limit,
        orderBy: { product: { name: 'asc' } },
      }),
      this.prisma.vehicleApplication.count({ where }),
    ])

    const products = applications.map((app) => ({
      ...app.product,
      applicationInfo: {
        id: app.id,
        kTypeId: app.kTypeId,
        notes: app.notes,
        isVerified: app.isVerified,
      },
    }))

    return {
      modification,
      products: PaginationUtil.createPaginatedResult(products, total, page, limit),
    }
  }

  /**
   * Получить автомобили для товара
   */
  @Cacheable({
    key: (productId: string) => `${CacheKeys.VEHICLE_APPS}prod:${productId}`,
    ttl: CacheTTL.VEHICLE_APPS,
  })
  async getVehiclesForProduct(productId: string): Promise<any> {
    // Проверяем существование товара
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: {
        brand: true,
        images: {
          where: { sortOrder: 0 },
          take: 1,
        },
      },
    })

    if (!product) {
      throw new NotFoundException('Товар не найден')
    }

    // Получаем все применимости
    const applications = await this.prisma.vehicleApplication.findMany({
      where: { productId },
      include: {
        modification: {
          include: {
            generation: {
              include: {
                model: {
                  include: {
                    make: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: [
        { modification: { generation: { model: { make: { name: 'asc' } } } } },
        { modification: { generation: { model: { name: 'asc' } } } },
        { modification: { generation: { name: 'asc' } } },
        { modification: { name: 'asc' } },
      ],
    })

    // Типизированные интерфейсы для Map
    interface GenerationData {
      id: string
      name: string
      slug: string
      startYear: number
      endYear: number | null
      bodyType: string | null
      modifications: any[]
    }

    interface ModelData {
      id: string
      makeId: string
      name: string
      slug: string
      modelCode: string | null
      startYear: number
      endYear: number | null
      generations: Map<string, GenerationData>
    }

    interface MakeData {
      id: string
      name: string
      slug: string
      country: string | null
      logoUrl: string | null
      models: Map<string, ModelData>
    }

    // Группируем по маркам для удобства
    const makeMap = new Map<string, MakeData>()

    applications.forEach((app) => {
      const make = app.modification.generation.model.make
      const makeId = make.id

      if (!makeMap.has(makeId)) {
        makeMap.set(makeId, {
          ...make,
          models: new Map(),
        })
      }

      const makeData = makeMap.get(makeId)!
      const model = app.modification.generation.model
      const modelId = model.id

      if (!makeData.models.has(modelId)) {
        makeData.models.set(modelId, {
          ...model,
          generations: new Map(),
        })
      }

      const modelData = makeData.models.get(modelId)!
      const generation = app.modification.generation
      const generationId = generation.id

      if (!modelData.generations.has(generationId)) {
        modelData.generations.set(generationId, {
          ...generation,
          modifications: [],
        })
      }

      const generationData = modelData.generations.get(generationId)!
      generationData.modifications.push({
        ...app.modification,
        applicationInfo: {
          id: app.id,
          kTypeId: app.kTypeId,
          notes: app.notes,
          isVerified: app.isVerified,
        },
      })
    })

    // Преобразуем Map в массивы
    const makes = Array.from(makeMap.values()).map((make) => ({
      ...make,
      models: Array.from(make.models.values()).map((model) => ({
        ...model,
        generations: Array.from(model.generations.values()),
      })),
    }))

    return {
      product,
      applications: applications.length,
      makes,
    }
  }

  /**
   * Инвалидация кеша
   */
  private async invalidateApplicationCache(productId: string): Promise<void> {
    await this.redisService.delByPattern(`${CacheKeys.VEHICLE_APPS}*${productId}*`)
    await this.redisService.delByPattern(`${CacheKeys.PRODUCTS}*`)
  }
}
