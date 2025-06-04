// src/modules/products/brands.service.ts
import { Injectable, NotFoundException, ConflictException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { Brand, Prisma } from '@prisma/client'
import { CreateBrandDto } from './dto/create-brand.dto'
import { UpdateBrandDto } from './dto/update-brand.dto'
import { PrismaErrorHelper } from '@common/helpers/prisma-error.helper'
import { Cacheable, CacheEvict } from '@common/decorators/cacheable.decorator'
import { CacheKeys, CacheTTL } from '../../redis/redis.constants'
import { RedisService } from '../../redis/redis.service'
import { BrandWithCount } from './interfaces/brand.interface'

@Injectable()
export class BrandsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
  ) {}

  async create(createBrandDto: CreateBrandDto): Promise<Brand> {
    try {
      return await this.prisma.brand.create({
        data: createBrandDto,
      })
    } catch (error) {
      if (PrismaErrorHelper.isUniqueConstraintError(error)) {
        throw new ConflictException('Бренд с таким названием или slug уже существует')
      }
      PrismaErrorHelper.handleError(error)
    }
  }

  @Cacheable({
    key: () => `${CacheKeys.BRANDS}all`,
    ttl: CacheTTL.BRANDS,
  })
  async findAll(includeInactive = false): Promise<BrandWithCount[]> {
    const where: Prisma.BrandWhereInput = {}

    if (!includeInactive) {
      where.isActive = true
    }

    return this.prisma.brand.findMany({
      where,
      include: {
        _count: {
          select: {
            products: {
              where: {
                deletedAt: null,
                isActive: true,
              },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    })
  }

  @Cacheable({
    key: (id: string) => `${CacheKeys.BRAND}${id}`,
    ttl: CacheTTL.BRANDS,
  })
  async findById(id: string): Promise<BrandWithCount | null> {
    return this.prisma.brand.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            products: {
              where: {
                deletedAt: null,
                isActive: true,
              },
            },
          },
        },
      },
    })
  }

  async findBySlug(slug: string): Promise<BrandWithCount | null> {
    return this.prisma.brand.findUnique({
      where: { slug },
      include: {
        _count: {
          select: {
            products: {
              where: {
                deletedAt: null,
                isActive: true,
              },
            },
          },
        },
      },
    })
  }

  @CacheEvict({
    key: (id: string) => `${CacheKeys.BRAND}${id}`,
  })
  async update(id: string, updateBrandDto: UpdateBrandDto): Promise<Brand> {
    try {
      const brand = await this.findById(id)
      if (!brand) {
        throw new NotFoundException('Бренд не найден')
      }

      const updatedBrand = await this.prisma.brand.update({
        where: { id },
        data: updateBrandDto,
      })

      // Инвалидируем кеш списка брендов
      await this.redisService.del(`${CacheKeys.BRANDS}all`)

      return updatedBrand
    } catch (error) {
      if (PrismaErrorHelper.isUniqueConstraintError(error)) {
        throw new ConflictException('Бренд с таким названием или slug уже существует')
      }
      PrismaErrorHelper.handleError(error)
    }
  }

  async delete(id: string): Promise<void> {
    const brand = await this.findById(id)
    if (!brand) {
      throw new NotFoundException('Бренд не найден')
    }

    // Проверяем наличие товаров
    if (brand._count && brand._count.products > 0) {
      throw new ConflictException(
        `Невозможно удалить бренд. Существует ${brand._count.products} товаров этого бренда`,
      )
    }

    await this.prisma.brand.delete({
      where: { id },
    })

    // Инвалидируем кеш
    await this.redisService.del(`${CacheKeys.BRAND}${id}`)
    await this.redisService.del(`${CacheKeys.BRANDS}all`)
  }
}
