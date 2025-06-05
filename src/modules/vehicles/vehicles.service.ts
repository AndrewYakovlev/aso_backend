// src/modules/vehicles/vehicles.service.ts
import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { Prisma } from '@prisma/client'
import { CreateVehicleMakeDto } from './dto/create-vehicle-make.dto'
import { UpdateVehicleMakeDto } from './dto/update-vehicle-make.dto'
import { CreateVehicleModelDto } from './dto/create-vehicle-model.dto'
import { UpdateVehicleModelDto } from './dto/update-vehicle-model.dto'
import { CreateVehicleGenerationDto } from './dto/create-vehicle-generation.dto'
import { UpdateVehicleGenerationDto } from './dto/update-vehicle-generation.dto'
import { CreateVehicleModificationDto } from './dto/create-vehicle-modification.dto'
import { UpdateVehicleModificationDto } from './dto/update-vehicle-modification.dto'
import { VehicleFilterDto, VehicleSearchDto } from './dto/vehicle-filters.dto'
import { PrismaErrorHelper } from '@common/helpers/prisma-error.helper'
import { Cacheable, CacheEvict } from '@common/decorators/cacheable.decorator'
import { CacheKeys, CacheTTL } from '../../redis/redis.constants'
import { RedisService } from '../../redis/redis.service'
import { StringUtil } from '@common/utils/string.util'
import {
  VehicleMakeWithRelations,
  VehicleModelWithRelations,
  VehicleGenerationWithRelations,
  VehicleModificationWithRelations,
  VehicleSearchResult,
} from './interfaces/vehicle.interface'
import { SeoUtil } from '@common/utils/seo.util'

@Injectable()
export class VehiclesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
  ) {}

  // ================== MAKES ==================

  async createMake(dto: CreateVehicleMakeDto): Promise<VehicleMakeWithRelations> {
    try {
      // Генерируем slug если не указан
      const slug = dto.slug || this.generateSlug(dto.name)

      // Проверяем уникальность slug
      const existingMake = await this.prisma.vehicleMake.findFirst({
        where: {
          OR: [{ name: dto.name }, { slug }],
        },
      })

      if (existingMake) {
        if (existingMake.name === dto.name) {
          throw new ConflictException('Марка с таким названием уже существует')
        }
        throw new ConflictException('Марка с таким slug уже существует')
      }

      // Генерируем SEO данные если не указаны
      const metaTitle = dto.metaTitle || SeoUtil.generateVehicleMakeMetaTitle(dto.name)
      const metaDescription =
        dto.metaDescription || SeoUtil.generateVehicleMakeMetaDescription(dto.name, dto.country)
      const metaKeywords =
        dto.metaKeywords || SeoUtil.generateVehicleMakeMetaKeywords(dto.name, dto.country)

      const make = await this.prisma.vehicleMake.create({
        data: {
          ...dto,
          slug,
          metaTitle,
          metaDescription,
          metaKeywords,
        },
        include: {
          _count: {
            select: { models: true },
          },
        },
      })

      // Инвалидируем кеш
      await this.invalidateVehicleCache()

      return make
    } catch (error) {
      PrismaErrorHelper.handleError(error)
    }
  }

  @Cacheable({
    key: () => `${CacheKeys.VEHICLES}makes:all`,
    ttl: CacheTTL.VEHICLES,
  })
  async findAllMakes(filter?: VehicleFilterDto): Promise<VehicleMakeWithRelations[]> {
    const where: Prisma.VehicleMakeWhereInput = {}

    if (filter?.search) {
      where.name = {
        contains: filter.search,
        mode: 'insensitive',
      }
    }

    if (filter?.country) {
      where.country = filter.country
    }

    return this.prisma.vehicleMake.findMany({
      where,
      include: {
        _count: {
          select: { models: true },
        },
      },
      orderBy: { name: 'asc' },
    })
  }

  @Cacheable({
    key: (id: string) => `${CacheKeys.VEHICLES}make:${id}`,
    ttl: CacheTTL.VEHICLES,
  })
  async findMakeById(id: string): Promise<VehicleMakeWithRelations | null> {
    return this.prisma.vehicleMake.findUnique({
      where: { id },
      include: {
        models: {
          orderBy: { name: 'asc' },
        },
        _count: {
          select: { models: true },
        },
      },
    })
  }

  async findMakeBySlug(slug: string): Promise<VehicleMakeWithRelations | null> {
    return this.prisma.vehicleMake.findFirst({
      where: { slug },
      include: {
        models: {
          orderBy: { name: 'asc' },
        },
        _count: {
          select: { models: true },
        },
      },
    })
  }

  @CacheEvict({
    key: (id: string) => `${CacheKeys.VEHICLES}make:${id}`,
  })
  async updateMake(id: string, dto: UpdateVehicleMakeDto): Promise<VehicleMakeWithRelations> {
    try {
      const make = await this.findMakeById(id)
      if (!make) {
        throw new NotFoundException('Марка не найдена')
      }

      const updatedMake = await this.prisma.vehicleMake.update({
        where: { id },
        data: dto,
        include: {
          _count: {
            select: { models: true },
          },
        },
      })

      await this.invalidateVehicleCache()

      return updatedMake
    } catch (error) {
      PrismaErrorHelper.handleError(error)
    }
  }

  async deleteMake(id: string): Promise<void> {
    const make = await this.prisma.vehicleMake.findUnique({
      where: { id },
      include: {
        _count: {
          select: { models: true },
        },
      },
    })

    if (!make) {
      throw new NotFoundException('Марка не найдена')
    }

    if (make._count.models > 0) {
      throw new ConflictException(
        `Невозможно удалить марку. Существует ${make._count.models} моделей этой марки`,
      )
    }

    await this.prisma.vehicleMake.delete({ where: { id } })
    await this.invalidateVehicleCache()
  }

  // ================== MODELS ==================

  async createModel(dto: CreateVehicleModelDto): Promise<VehicleModelWithRelations> {
    try {
      // Проверяем существование марки
      const make = await this.findMakeById(dto.makeId)
      if (!make) {
        throw new NotFoundException('Марка не найдена')
      }

      // Генерируем slug
      const slug = dto.slug || this.generateSlug(`${make.name} ${dto.name}`)

      // Проверяем уникальность в рамках марки
      const existingModel = await this.prisma.vehicleModel.findFirst({
        where: {
          makeId: dto.makeId,
          OR: [{ name: dto.name }, { slug }],
        },
      })

      if (existingModel) {
        if (existingModel.name === dto.name) {
          throw new ConflictException('Модель с таким названием уже существует для этой марки')
        }
        throw new ConflictException('Модель с таким slug уже существует')
      }

      // Валидация годов
      if (dto.endYear && dto.endYear < dto.startYear) {
        throw new BadRequestException('Год окончания не может быть меньше года начала')
      }

      // Генерируем SEO данные
      const metaTitle =
        dto.metaTitle ||
        SeoUtil.generateVehicleModelMetaTitle(make.name, dto.name, {
          start: dto.startYear,
          end: dto.endYear,
        })
      const metaDescription =
        dto.metaDescription ||
        SeoUtil.generateVehicleModelMetaDescription(make.name, dto.name, {
          start: dto.startYear,
          end: dto.endYear,
        })
      const metaKeywords =
        dto.metaKeywords ||
        SeoUtil.generateVehicleModelMetaKeywords(make.name, dto.name, dto.modelCode)

      const model = await this.prisma.vehicleModel.create({
        data: {
          ...dto,
          slug,
          metaTitle,
          metaDescription,
          metaKeywords,
        },
        include: {
          make: true,
          _count: {
            select: { generations: true },
          },
        },
      })

      await this.invalidateVehicleCache()

      return model
    } catch (error) {
      PrismaErrorHelper.handleError(error)
    }
  }

  @Cacheable({
    key: (makeId?: string) => `${CacheKeys.VEHICLES}models:${makeId || 'all'}`,
    ttl: CacheTTL.VEHICLES,
  })
  async findAllModels(
    makeId?: string,
    filter?: VehicleFilterDto,
  ): Promise<VehicleModelWithRelations[]> {
    const where: Prisma.VehicleModelWhereInput = {}

    if (makeId) {
      where.makeId = makeId
    }

    if (filter?.search) {
      where.name = {
        contains: filter.search,
        mode: 'insensitive',
      }
    }

    if (filter?.yearFrom) {
      where.OR = [{ endYear: null }, { endYear: { gte: filter.yearFrom } }]
    }

    if (filter?.yearTo) {
      where.startYear = { lte: filter.yearTo }
    }

    return this.prisma.vehicleModel.findMany({
      where,
      include: {
        make: true,
        _count: {
          select: { generations: true },
        },
      },
      orderBy: [{ make: { name: 'asc' } }, { name: 'asc' }],
    })
  }

  @Cacheable({
    key: (id: string) => `${CacheKeys.VEHICLES}model:${id}`,
    ttl: CacheTTL.VEHICLES,
  })
  async findModelById(id: string): Promise<VehicleModelWithRelations | null> {
    return this.prisma.vehicleModel.findUnique({
      where: { id },
      include: {
        make: true,
        generations: {
          orderBy: { startYear: 'desc' },
        },
        _count: {
          select: { generations: true },
        },
      },
    })
  }

  async findModelBySlug(slug: string): Promise<VehicleModelWithRelations | null> {
    return this.prisma.vehicleModel.findFirst({
      where: { slug },
      include: {
        make: true,
        generations: {
          orderBy: { startYear: 'desc' },
        },
        _count: {
          select: { generations: true },
        },
      },
    })
  }

  @CacheEvict({
    key: (id: string) => `${CacheKeys.VEHICLES}model:${id}`,
  })
  async updateModel(id: string, dto: UpdateVehicleModelDto): Promise<VehicleModelWithRelations> {
    try {
      const model = await this.findModelById(id)
      if (!model) {
        throw new NotFoundException('Модель не найдена')
      }

      // Валидация годов
      if (dto.endYear && (dto.startYear || model.startYear) > dto.endYear) {
        throw new BadRequestException('Год окончания не может быть меньше года начала')
      }

      const updatedModel = await this.prisma.vehicleModel.update({
        where: { id },
        data: dto,
        include: {
          make: true,
          _count: {
            select: { generations: true },
          },
        },
      })

      await this.invalidateVehicleCache()

      return updatedModel
    } catch (error) {
      PrismaErrorHelper.handleError(error)
    }
  }

  async deleteModel(id: string): Promise<void> {
    const model = await this.prisma.vehicleModel.findUnique({
      where: { id },
      include: {
        _count: {
          select: { generations: true },
        },
      },
    })

    if (!model) {
      throw new NotFoundException('Модель не найдена')
    }

    if (model._count.generations > 0) {
      throw new ConflictException(
        `Невозможно удалить модель. Существует ${model._count.generations} поколений этой модели`,
      )
    }

    await this.prisma.vehicleModel.delete({ where: { id } })
    await this.invalidateVehicleCache()
  }

  // ================== GENERATIONS ==================

  async createGeneration(dto: CreateVehicleGenerationDto): Promise<VehicleGenerationWithRelations> {
    try {
      // Проверяем существование модели
      const model = await this.findModelById(dto.modelId)
      if (!model) {
        throw new NotFoundException('Модель не найдена')
      }

      // Генерируем slug
      const makeName = model.make?.name || 'Unknown'
      const slug = dto.slug || this.generateSlug(`${makeName} ${model.name} ${dto.name}`)

      // Проверяем уникальность
      const existingGeneration = await this.prisma.vehicleGeneration.findFirst({
        where: {
          modelId: dto.modelId,
          OR: [{ name: dto.name }, { slug }],
        },
      })

      if (existingGeneration) {
        if (existingGeneration.name === dto.name) {
          throw new ConflictException('Поколение с таким названием уже существует для этой модели')
        }
        throw new ConflictException('Поколение с таким slug уже существует')
      }

      // Валидация годов
      if (dto.endYear && dto.endYear < dto.startYear) {
        throw new BadRequestException('Год окончания не может быть меньше года начала')
      }

      // Генерируем SEO данные
      const metaTitle =
        dto.metaTitle ||
        SeoUtil.generateVehicleGenerationMetaTitle(makeName, model.name, dto.name, {
          start: dto.startYear,
          end: dto.endYear,
        })
      const metaDescription =
        dto.metaDescription ||
        SeoUtil.generateVehicleGenerationMetaDescription(
          makeName,
          model.name,
          dto.name,
          dto.bodyType,
          { start: dto.startYear, end: dto.endYear },
        )
      const metaKeywords =
        dto.metaKeywords ||
        SeoUtil.generateVehicleModelMetaKeywords(makeName, model.name, model.modelCode)

      const generation = await this.prisma.vehicleGeneration.create({
        data: {
          ...dto,
          slug,
          metaTitle,
          metaDescription,
          metaKeywords,
        },
        include: {
          model: {
            include: { make: true },
          },
          _count: {
            select: { modifications: true },
          },
        },
      })

      await this.invalidateVehicleCache()

      return generation
    } catch (error) {
      PrismaErrorHelper.handleError(error)
    }
  }

  @Cacheable({
    key: (modelId?: string) => `${CacheKeys.VEHICLES}generations:${modelId || 'all'}`,
    ttl: CacheTTL.VEHICLES,
  })
  async findAllGenerations(
    modelId?: string,
    filter?: VehicleFilterDto,
  ): Promise<VehicleGenerationWithRelations[]> {
    const where: Prisma.VehicleGenerationWhereInput = {}

    if (modelId) {
      where.modelId = modelId
    }

    if (filter?.search) {
      where.name = {
        contains: filter.search,
        mode: 'insensitive',
      }
    }

    if (filter?.yearFrom) {
      where.OR = [{ endYear: null }, { endYear: { gte: filter.yearFrom } }]
    }

    if (filter?.yearTo) {
      where.startYear = { lte: filter.yearTo }
    }

    return this.prisma.vehicleGeneration.findMany({
      where,
      include: {
        model: {
          include: { make: true },
        },
        _count: {
          select: { modifications: true },
        },
      },
      orderBy: { startYear: 'desc' },
    })
  }

  @Cacheable({
    key: (id: string) => `${CacheKeys.VEHICLES}generation:${id}`,
    ttl: CacheTTL.VEHICLES,
  })
  async findGenerationById(id: string): Promise<VehicleGenerationWithRelations | null> {
    return this.prisma.vehicleGeneration.findUnique({
      where: { id },
      include: {
        model: {
          include: { make: true },
        },
        modifications: {
          orderBy: { name: 'asc' },
        },
        _count: {
          select: { modifications: true },
        },
      },
    })
  }

  async findGenerationBySlug(slug: string): Promise<VehicleGenerationWithRelations | null> {
    return this.prisma.vehicleGeneration.findFirst({
      where: { slug },
      include: {
        model: {
          include: { make: true },
        },
        modifications: {
          orderBy: { name: 'asc' },
        },
        _count: {
          select: { modifications: true },
        },
      },
    })
  }

  @CacheEvict({
    key: (id: string) => `${CacheKeys.VEHICLES}generation:${id}`,
  })
  async updateGeneration(
    id: string,
    dto: UpdateVehicleGenerationDto,
  ): Promise<VehicleGenerationWithRelations> {
    try {
      const generation = await this.findGenerationById(id)
      if (!generation) {
        throw new NotFoundException('Поколение не найдено')
      }

      // Валидация годов
      if (dto.endYear && (dto.startYear || generation.startYear) > dto.endYear) {
        throw new BadRequestException('Год окончания не может быть меньше года начала')
      }

      const updatedGeneration = await this.prisma.vehicleGeneration.update({
        where: { id },
        data: dto,
        include: {
          model: {
            include: { make: true },
          },
          _count: {
            select: { modifications: true },
          },
        },
      })

      await this.invalidateVehicleCache()

      return updatedGeneration
    } catch (error) {
      PrismaErrorHelper.handleError(error)
    }
  }

  async deleteGeneration(id: string): Promise<void> {
    const generation = await this.prisma.vehicleGeneration.findUnique({
      where: { id },
      include: {
        _count: {
          select: { modifications: true },
        },
      },
    })

    if (!generation) {
      throw new NotFoundException('Поколение не найдено')
    }

    if (generation._count.modifications > 0) {
      throw new ConflictException(
        `Невозможно удалить поколение. Существует ${generation._count.modifications} модификаций этого поколения`,
      )
    }

    await this.prisma.vehicleGeneration.delete({ where: { id } })
    await this.invalidateVehicleCache()
  }

  // ================== MODIFICATIONS ==================

  async createModification(
    dto: CreateVehicleModificationDto,
  ): Promise<VehicleModificationWithRelations> {
    try {
      // Проверяем существование поколения
      const generation = await this.findGenerationById(dto.generationId)
      if (!generation) {
        throw new NotFoundException('Поколение не найдено')
      }

      const modification = await this.prisma.vehicleModification.create({
        data: dto,
        include: {
          generation: {
            include: {
              model: {
                include: { make: true },
              },
            },
          },
          _count: {
            select: { applications: true },
          },
        },
      })

      await this.invalidateVehicleCache()

      return modification
    } catch (error) {
      PrismaErrorHelper.handleError(error)
    }
  }

  @Cacheable({
    key: (generationId?: string) => `${CacheKeys.VEHICLES}modifications:${generationId || 'all'}`,
    ttl: CacheTTL.VEHICLES,
  })
  async findAllModifications(generationId?: string): Promise<VehicleModificationWithRelations[]> {
    const where: Prisma.VehicleModificationWhereInput = {}

    if (generationId) {
      where.generationId = generationId
    }

    return this.prisma.vehicleModification.findMany({
      where,
      include: {
        generation: {
          include: {
            model: {
              include: { make: true },
            },
          },
        },
        _count: {
          select: { applications: true },
        },
      },
      orderBy: { name: 'asc' },
    })
  }

  @Cacheable({
    key: (id: string) => `${CacheKeys.VEHICLES}modification:${id}`,
    ttl: CacheTTL.VEHICLES,
  })
  async findModificationById(id: string): Promise<VehicleModificationWithRelations | null> {
    return this.prisma.vehicleModification.findUnique({
      where: { id },
      include: {
        generation: {
          include: {
            model: {
              include: { make: true },
            },
          },
        },
        _count: {
          select: { applications: true },
        },
      },
    })
  }

  @CacheEvict({
    key: (id: string) => `${CacheKeys.VEHICLES}modification:${id}`,
  })
  async updateModification(
    id: string,
    dto: UpdateVehicleModificationDto,
  ): Promise<VehicleModificationWithRelations> {
    try {
      const modification = await this.findModificationById(id)
      if (!modification) {
        throw new NotFoundException('Модификация не найдена')
      }

      const updatedModification = await this.prisma.vehicleModification.update({
        where: { id },
        data: dto,
        include: {
          generation: {
            include: {
              model: {
                include: { make: true },
              },
            },
          },
          _count: {
            select: { applications: true },
          },
        },
      })

      await this.invalidateVehicleCache()

      return updatedModification
    } catch (error) {
      PrismaErrorHelper.handleError(error)
    }
  }

  async deleteModification(id: string): Promise<void> {
    const modification = await this.prisma.vehicleModification.findUnique({
      where: { id },
      include: {
        _count: {
          select: { applications: true },
        },
      },
    })

    if (!modification) {
      throw new NotFoundException('Модификация не найдена')
    }

    if (modification._count.applications > 0) {
      throw new ConflictException(
        `Невозможно удалить модификацию. Существует ${modification._count.applications} применений запчастей`,
      )
    }

    await this.prisma.vehicleModification.delete({ where: { id } })
    await this.invalidateVehicleCache()
  }

  // ================== SEARCH ==================

  async searchVehicles(searchDto: VehicleSearchDto): Promise<VehicleSearchResult[]> {
    const results: VehicleSearchResult[] = []

    if (!searchDto.q || searchDto.q.length < 2) {
      return results
    }

    const searchTerm = searchDto.q.toLowerCase()

    // Поиск по маркам с условным включением модификаций
    const makes = await this.prisma.vehicleMake.findMany({
      where: {
        name: {
          contains: searchDto.q,
          mode: 'insensitive',
        },
      },
      include: {
        models: {
          include: {
            generations: searchDto.includeModifications
              ? {
                  include: {
                    modifications: true,
                  },
                }
              : true,
          },
        },
      },
      take: 10,
    })

    // Формируем результаты
    for (const make of makes) {
      // Если указан только поиск и найдена марка
      if (!searchDto.makeId && !searchDto.modelId) {
        results.push({ make, model: null as any })
      }

      // Ищем модели в рамках марки
      for (const model of make.models) {
        if (
          model.name.toLowerCase().includes(searchTerm) ||
          (searchDto.makeId === make.id && !searchDto.modelId)
        ) {
          results.push({ make, model })

          // Ищем поколения
          if (model.generations) {
            for (const generation of model.generations) {
              if (
                generation.name.toLowerCase().includes(searchTerm) ||
                searchDto.modelId === model.id
              ) {
                results.push({ make, model, generation })

                // Ищем модификации (исправлено - проверяем тип)
                if (searchDto.includeModifications && 'modifications' in generation) {
                  const genWithMods = generation as any
                  if (genWithMods.modifications && Array.isArray(genWithMods.modifications)) {
                    for (const modification of genWithMods.modifications) {
                      if (
                        modification.name?.toLowerCase().includes(searchTerm) ||
                        modification.engineCode?.toLowerCase().includes(searchTerm)
                      ) {
                        results.push({ make, model, generation, modification })
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }

    // Ограничиваем количество результатов
    return results.slice(0, 20)
  }

  // ================== UTILITIES ==================

  private generateSlug(name: string): string {
    return StringUtil.slugify(name)
  }

  private async invalidateVehicleCache(): Promise<void> {
    await this.redisService.delByPattern(`${CacheKeys.VEHICLES}*`)
  }

  /**
   * Получить марку со структурированными данными для SEO
   */
  @Cacheable({
    key: (slug: string) => `${CacheKeys.VEHICLES}make:seo:${slug}`,
    ttl: CacheTTL.VEHICLES,
  })
  async getMakeWithSeo(slug: string): Promise<any> {
    const make = await this.prisma.vehicleMake.findFirst({
      where: { slug },
      include: {
        models: {
          orderBy: { name: 'asc' },
        },
        _count: {
          select: { models: true },
        },
      },
    })

    if (!make) {
      throw new NotFoundException('Марка не найдена')
    }

    const canonicalUrl = SeoUtil.generateVehicleMakeCanonicalUrl(slug)
    const structuredData = SeoUtil.generateVehicleMakeStructuredData({
      name: make.name,
      description: make.description,
      country: make.country,
      canonicalUrl,
      modelsCount: make._count.models,
    })

    return {
      ...make,
      seo: {
        canonicalUrl,
        structuredData,
      },
    }
  }

  /**
   * Получить модель со структурированными данными для SEO
   */
  @Cacheable({
    key: (slug: string) => `${CacheKeys.VEHICLES}model:seo:${slug}`,
    ttl: CacheTTL.VEHICLES,
  })
  async getModelWithSeo(slug: string): Promise<any> {
    const model = await this.prisma.vehicleModel.findFirst({
      where: { slug },
      include: {
        make: true,
        generations: {
          orderBy: { startYear: 'desc' },
        },
        _count: {
          select: { generations: true },
        },
      },
    })

    if (!model) {
      throw new NotFoundException('Модель не найдена')
    }

    const canonicalUrl = SeoUtil.generateVehicleModelCanonicalUrl(model.make.slug, model.slug)
    const structuredData = SeoUtil.generateVehicleModelStructuredData({
      makeName: model.make.name,
      name: model.name,
      description: model.description,
      canonicalUrl,
      startYear: model.startYear,
      endYear: model.endYear,
    })

    return {
      ...model,
      seo: {
        canonicalUrl,
        structuredData,
      },
    }
  }

  /**
   * Получить поколение со структурированными данными для SEO
   */
  @Cacheable({
    key: (slug: string) => `${CacheKeys.VEHICLES}generation:seo:${slug}`,
    ttl: CacheTTL.VEHICLES,
  })
  async getGenerationWithSeo(slug: string): Promise<any> {
    const generation = await this.prisma.vehicleGeneration.findFirst({
      where: { slug },
      include: {
        model: {
          include: { make: true },
        },
        modifications: {
          orderBy: { name: 'asc' },
        },
        _count: {
          select: { modifications: true },
        },
      },
    })

    if (!generation) {
      throw new NotFoundException('Поколение не найдено')
    }

    const canonicalUrl = SeoUtil.generateVehicleGenerationCanonicalUrl(
      generation.model.make.slug,
      generation.model.slug,
      generation.slug,
    )

    return {
      ...generation,
      seo: {
        canonicalUrl,
      },
    }
  }
}
