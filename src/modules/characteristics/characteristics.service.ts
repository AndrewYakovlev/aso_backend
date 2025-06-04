// src/modules/characteristics/characteristics.service.ts
import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { Prisma } from '@prisma/client'
import { CreateCharacteristicDto } from './dto/create-characteristic.dto'
import { UpdateCharacteristicDto } from './dto/update-characteristic.dto'
import { CharacteristicsFilterDto } from './dto/characteristics-filter.dto'
import { CharacteristicValueDto } from './dto/characteristic-value.dto'
import { PrismaErrorHelper } from '@common/helpers/prisma-error.helper'
import { Cacheable, CacheEvict } from '@common/decorators/cacheable.decorator'
import { CacheKeys, CacheTTL } from '../../redis/redis.constants'
import { RedisService } from '../../redis/redis.service'
import {
  CharacteristicType,
  CharacteristicWithRelations,
  CharacteristicFilterType,
  CharacteristicValueValidation,
} from './interfaces/characteristic.interface'

@Injectable()
export class CharacteristicsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
  ) {}

  async create(
    createCharacteristicDto: CreateCharacteristicDto,
  ): Promise<CharacteristicWithRelations> {
    try {
      const { values, categoryIds, ...characteristicData } = createCharacteristicDto

      // Проверяем уникальность кода
      const existingCharacteristic = await this.prisma.characteristic.findUnique({
        where: { code: characteristicData.code },
      })

      if (existingCharacteristic) {
        throw new ConflictException('Характеристика с таким кодом уже существует')
      }

      // Проверяем существование категорий
      if (categoryIds && categoryIds.length > 0) {
        const existingCategories = await this.prisma.category.findMany({
          where: {
            id: { in: categoryIds },
            deletedAt: null,
          },
        })

        if (existingCategories.length !== categoryIds.length) {
          throw new NotFoundException('Одна или несколько категорий не найдены')
        }
      }

      // Валидация типа фильтра
      if (characteristicData.isFilterable && !characteristicData.filterType) {
        throw new BadRequestException(
          'Для фильтруемой характеристики необходимо указать тип фильтра',
        )
      }

      // Валидация значений для типа select
      if (
        characteristicData.type === CharacteristicType.SELECT &&
        (!values || values.length === 0)
      ) {
        throw new BadRequestException(
          'Для характеристики типа select необходимо указать хотя бы одно значение',
        )
      }

      // Создаем характеристику с значениями и связями с категориями
      const characteristic = await this.prisma.characteristic.create({
        data: {
          ...characteristicData,
          values:
            values && characteristicData.type === CharacteristicType.SELECT
              ? {
                  create: values.map((value, index) => ({
                    ...value,
                    sortOrder: value.sortOrder ?? index,
                  })),
                }
              : undefined,
          categories:
            categoryIds && categoryIds.length > 0
              ? {
                  create: categoryIds.map((categoryId) => ({
                    categoryId,
                  })),
                }
              : undefined,
        },
        include: this.getCharacteristicInclude(),
      })

      // Инвалидируем кеш
      await this.invalidateCharacteristicsCache()

      return characteristic
    } catch (error) {
      PrismaErrorHelper.handleError(error)
    }
  }

  @Cacheable({
    key: (id: string) => `${CacheKeys.CHARACTERISTICS}${id}`,
    ttl: CacheTTL.CHARACTERISTICS,
  })
  async findById(id: string): Promise<CharacteristicWithRelations | null> {
    return this.prisma.characteristic.findUnique({
      where: { id },
      include: this.getCharacteristicInclude(),
    })
  }

  async findByCode(code: string): Promise<CharacteristicWithRelations | null> {
    return this.prisma.characteristic.findUnique({
      where: { code },
      include: this.getCharacteristicInclude(),
    })
  }

  @Cacheable({
    key: () => `${CacheKeys.CHARACTERISTICS}all`,
    ttl: CacheTTL.CHARACTERISTICS,
  })
  async findAll(filterDto?: CharacteristicsFilterDto): Promise<CharacteristicWithRelations[]> {
    const where = this.buildWhereClause(filterDto)

    return this.prisma.characteristic.findMany({
      where,
      include: this.getCharacteristicInclude(),
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    })
  }

  async findByCategoryId(categoryId: string): Promise<CharacteristicWithRelations[]> {
    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
    })

    if (!category) {
      throw new NotFoundException('Категория не найдена')
    }

    return this.prisma.characteristic.findMany({
      where: {
        OR: [
          {
            categories: {
              some: {
                categoryId,
              },
            },
          },
          {
            categories: {
              none: {},
            },
          }, // Общие характеристики без привязки к категориям
        ],
      },
      include: this.getCharacteristicInclude(),
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    })
  }

  @CacheEvict({
    key: (id: string) => `${CacheKeys.CHARACTERISTICS}${id}`,
  })
  async update(
    id: string,
    updateCharacteristicDto: UpdateCharacteristicDto,
  ): Promise<CharacteristicWithRelations> {
    try {
      const characteristic = await this.findById(id)
      if (!characteristic) {
        throw new NotFoundException('Характеристика не найдена')
      }

      const { values, categoryIds, ...characteristicData } = updateCharacteristicDto

      // Проверяем существование категорий
      if (categoryIds !== undefined && categoryIds.length > 0) {
        const existingCategories = await this.prisma.category.findMany({
          where: {
            id: { in: categoryIds },
            deletedAt: null,
          },
        })

        if (existingCategories.length !== categoryIds.length) {
          throw new NotFoundException('Одна или несколько категорий не найдены')
        }
      }

      // Валидация типа фильтра
      if (
        characteristicData.isFilterable === true &&
        !characteristicData.filterType &&
        !characteristic.filterType
      ) {
        throw new BadRequestException(
          'Для фильтруемой характеристики необходимо указать тип фильтра',
        )
      }

      // Обновляем характеристику
      const updatedCharacteristic = await this.prisma.characteristic.update({
        where: { id },
        data: characteristicData,
        include: this.getCharacteristicInclude(),
      })

      // Обновляем связи с категориями, если они переданы
      if (categoryIds !== undefined) {
        // Удаляем старые связи
        await this.prisma.characteristicCategory.deleteMany({
          where: { characteristicId: id },
        })

        // Создаем новые связи
        if (categoryIds.length > 0) {
          await this.prisma.characteristicCategory.createMany({
            data: categoryIds.map((categoryId) => ({
              characteristicId: id,
              categoryId,
            })),
          })
        }
      }

      // Обновляем значения для типа select
      if (values !== undefined && updatedCharacteristic.type === CharacteristicType.SELECT) {
        // Удаляем старые значения
        await this.prisma.characteristicValue.deleteMany({
          where: { characteristicId: id },
        })

        // Создаем новые значения
        if (values.length > 0) {
          await this.prisma.characteristicValue.createMany({
            data: values.map((value, index) => ({
              characteristicId: id,
              ...value,
              sortOrder: value.sortOrder ?? index,
            })),
          })
        }
      }

      // Получаем обновленную характеристику со всеми связями
      const finalCharacteristic = await this.findById(id)
      if (!finalCharacteristic) {
        throw new Error('Failed to retrieve updated characteristic')
      }

      // Инвалидируем кеш
      await this.invalidateCharacteristicsCache()

      return finalCharacteristic
    } catch (error) {
      PrismaErrorHelper.handleError(error)
    }
  }

  async delete(id: string): Promise<void> {
    const characteristic = await this.findById(id)
    if (!characteristic) {
      throw new NotFoundException('Характеристика не найдена')
    }

    // Проверяем наличие товаров с этой характеристикой
    const productCount = await this.prisma.productCharacteristic.count({
      where: { characteristicId: id },
    })

    if (productCount > 0) {
      throw new ConflictException(
        `Невозможно удалить характеристику. Она используется в ${productCount} товарах`,
      )
    }

    await this.prisma.characteristic.delete({
      where: { id },
    })

    // Инвалидируем кеш
    await this.redisService.del(`${CacheKeys.CHARACTERISTICS}${id}`)
    await this.invalidateCharacteristicsCache()
  }

  async validateCharacteristicValue(
    characteristicId: string,
    value: CharacteristicValueDto,
  ): Promise<CharacteristicValueValidation> {
    const characteristic = await this.findById(characteristicId)
    if (!characteristic) {
      return { isValid: false, message: 'Характеристика не найдена' }
    }

    switch (characteristic.type) {
      case CharacteristicType.TEXT:
        if (!value.textValue || typeof value.textValue !== 'string') {
          return {
            isValid: false,
            message: 'Для текстовой характеристики требуется строковое значение',
          }
        }
        if (value.textValue.length > 500) {
          return { isValid: false, message: 'Текстовое значение не должно превышать 500 символов' }
        }
        break

      case CharacteristicType.NUMBER:
        if (value.numberValue === undefined || typeof value.numberValue !== 'number') {
          return {
            isValid: false,
            message: 'Для числовой характеристики требуется числовое значение',
          }
        }
        if (!Number.isFinite(value.numberValue)) {
          return { isValid: false, message: 'Числовое значение должно быть конечным числом' }
        }
        break

      case CharacteristicType.BOOLEAN:
        if (value.booleanValue === undefined || typeof value.booleanValue !== 'boolean') {
          return {
            isValid: false,
            message: 'Для логической характеристики требуется булево значение',
          }
        }
        break

      case CharacteristicType.SELECT:
        if (!value.selectValueId) {
          return {
            isValid: false,
            message: 'Для характеристики типа select требуется выбрать значение',
          }
        }
        // Проверяем существование значения
        const valueExists = await this.prisma.characteristicValue.findFirst({
          where: {
            id: value.selectValueId,
            characteristicId,
          },
        })
        if (!valueExists) {
          return { isValid: false, message: 'Выбранное значение не существует' }
        }
        break

      default:
        return { isValid: false, message: 'Неизвестный тип характеристики' }
    }

    return { isValid: true }
  }

  async getCharacteristicsByProductId(productId: string): Promise<any[]> {
    const productCharacteristics = await this.prisma.productCharacteristic.findMany({
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

    return productCharacteristics.map((pc) => ({
      characteristic: pc.characteristic,
      value: pc.value,
      characteristicValue: pc.characteristicValue,
    }))
  }

  async addCharacteristicValue(
    characteristicId: string,
    value: string,
    sortOrder?: number,
  ): Promise<void> {
    const characteristic = await this.findById(characteristicId)
    if (!characteristic) {
      throw new NotFoundException('Характеристика не найдена')
    }

    if (characteristic.type !== CharacteristicType.SELECT) {
      throw new BadRequestException(
        'Добавление значений возможно только для характеристик типа select',
      )
    }

    // Проверяем уникальность значения
    const existingValue = await this.prisma.characteristicValue.findFirst({
      where: {
        characteristicId,
        value,
      },
    })

    if (existingValue) {
      throw new ConflictException('Такое значение уже существует')
    }

    // Определяем порядок сортировки
    if (sortOrder === undefined) {
      const maxSortOrder = await this.prisma.characteristicValue.aggregate({
        where: { characteristicId },
        _max: { sortOrder: true },
      })
      sortOrder = (maxSortOrder._max.sortOrder || 0) + 1
    }

    await this.prisma.characteristicValue.create({
      data: {
        characteristicId,
        value,
        sortOrder,
      },
    })

    // Инвалидируем кеш
    await this.redisService.del(`${CacheKeys.CHARACTERISTICS}${characteristicId}`)
    await this.invalidateCharacteristicsCache()
  }

  async removeCharacteristicValue(characteristicId: string, valueId: string): Promise<void> {
    // Проверяем, не используется ли значение в товарах
    const usageCount = await this.prisma.productCharacteristic.count({
      where: { characteristicValueId: valueId },
    })

    if (usageCount > 0) {
      throw new ConflictException(
        `Невозможно удалить значение. Оно используется в ${usageCount} товарах`,
      )
    }

    await this.prisma.characteristicValue.delete({
      where: { id: valueId },
    })

    // Инвалидируем кеш
    await this.redisService.del(`${CacheKeys.CHARACTERISTICS}${characteristicId}`)
    await this.invalidateCharacteristicsCache()
  }

  private buildWhereClause(filterDto?: CharacteristicsFilterDto): Prisma.CharacteristicWhereInput {
    if (!filterDto) {
      return {}
    }

    const where: Prisma.CharacteristicWhereInput = {}

    if (filterDto.search) {
      where.OR = [
        { name: { contains: filterDto.search, mode: 'insensitive' } },
        { code: { contains: filterDto.search, mode: 'insensitive' } },
      ]
    }

    if (filterDto.categoryId !== undefined) {
      where.categories = {
        some: {
          categoryId: filterDto.categoryId,
        },
      }
    }

    if (filterDto.isRequired !== undefined) {
      where.isRequired = filterDto.isRequired
    }

    if (filterDto.isFilterable !== undefined) {
      where.isFilterable = filterDto.isFilterable
    }

    if (filterDto.types && filterDto.types.length > 0) {
      where.type = { in: filterDto.types }
    }

    return where
  }

  private getCharacteristicInclude() {
    return {
      values: {
        orderBy: {
          sortOrder: 'asc' as const,
        },
      },
      categories: {
        include: {
          category: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
        },
      },
      _count: {
        select: {
          productValues: true,
        },
      },
    }
  }

  private async invalidateCharacteristicsCache(): Promise<void> {
    await this.redisService.del(`${CacheKeys.CHARACTERISTICS}all`)
  }
}
