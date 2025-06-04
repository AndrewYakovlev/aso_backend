// src/modules/categories/categories.service.ts
import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { Category, Prisma } from '@prisma/client'
import { CreateCategoryDto } from './dto/create-category.dto'
import { UpdateCategoryDto } from './dto/update-category.dto'
import { PrismaErrorHelper } from '@common/helpers/prisma-error.helper'
import { Cacheable, CacheEvict } from '@common/decorators/cacheable.decorator'
import { CacheKeys, CacheTTL } from '../../redis/redis.constants'
import { RedisService } from '../../redis/redis.service'
import { CategoryBreadcrumbDto } from './dto/category-response.dto'
import { CategoryWithRelations } from './interfaces/category.interface'
import { SeoUtil } from '@common/utils/seo.util'

@Injectable()
export class CategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
  ) {}

  async create(createCategoryDto: CreateCategoryDto): Promise<CategoryWithRelations> {
    try {
      // Проверяем уникальность slug
      const existingCategory = await this.prisma.category.findUnique({
        where: { slug: createCategoryDto.slug },
      })

      if (existingCategory) {
        throw new ConflictException('Категория с таким slug уже существует')
      }

      // Проверяем существование родительской категории
      let parentCategory: Category | null = null
      if (createCategoryDto.parentId) {
        parentCategory = await this.findById(createCategoryDto.parentId)
        if (!parentCategory) {
          throw new NotFoundException('Родительская категория не найдена')
        }
      }

      // Автогенерация SEO полей если не указаны
      const seoData = this.generateSeoData(
        createCategoryDto.name,
        createCategoryDto.description,
        parentCategory?.name,
        createCategoryDto,
      )

      const category = await this.prisma.category.create({
        data: {
          ...createCategoryDto,
          parentId: createCategoryDto.parentId || null,
          metaTitle: seoData.metaTitle,
          metaDescription: seoData.metaDescription,
          metaKeywords: seoData.metaKeywords,
        },
        include: {
          parent: true,
          children: true,
        },
      })

      // Инвалидируем кеш дерева категорий
      await this.invalidateCategoryTreeCache()

      return category
    } catch (error) {
      PrismaErrorHelper.handleError(error)
    }
  }

  @Cacheable({
    key: (id: string) => `${CacheKeys.CATEGORY}${id}`,
    ttl: CacheTTL.CATEGORY,
  })
  async findById(id: string): Promise<CategoryWithRelations | null> {
    return this.prisma.category.findUnique({
      where: { id },
      include: {
        parent: true,
        children: {
          where: { deletedAt: null },
          orderBy: { sortOrder: 'asc' },
        },
        _count: {
          select: {
            products: {
              where: {
                product: {
                  deletedAt: null,
                  isActive: true,
                },
              },
            },
          },
        },
      },
    })
  }

  async findBySlug(slug: string): Promise<CategoryWithRelations | null> {
    return this.prisma.category.findFirst({
      where: {
        slug,
        deletedAt: null,
      },
      include: {
        parent: true,
        children: {
          where: { deletedAt: null },
          orderBy: { sortOrder: 'asc' },
        },
        _count: {
          select: {
            products: {
              where: {
                product: {
                  deletedAt: null,
                  isActive: true,
                },
              },
            },
          },
        },
      },
    })
  }

  @Cacheable({
    key: () => `${CacheKeys.CATEGORIES}tree`,
    ttl: CacheTTL.CATEGORIES,
  })
  async getCategoryTree(includeInactive = false): Promise<CategoryWithRelations[]> {
    const where: Prisma.CategoryWhereInput = {
      parentId: null,
      deletedAt: null,
    }

    if (!includeInactive) {
      where.isActive = true
    }

    const categories = await this.prisma.category.findMany({
      where,
      include: {
        children: {
          where: {
            deletedAt: null,
            ...(includeInactive ? {} : { isActive: true }),
          },
          include: {
            children: {
              where: {
                deletedAt: null,
                ...(includeInactive ? {} : { isActive: true }),
              },
              orderBy: { sortOrder: 'asc' },
            },
          },
          orderBy: { sortOrder: 'asc' },
        },
      },
      orderBy: { sortOrder: 'asc' },
    })

    // Рекурсивно подсчитываем товары
    for (const category of categories) {
      await this.enrichCategoryWithProductCount(category)
    }

    return categories
  }

  async getSubcategories(
    parentId: string,
    includeInactive = false,
  ): Promise<CategoryWithRelations[]> {
    const parent = await this.findById(parentId)
    if (!parent) {
      throw new NotFoundException('Родительская категория не найдена')
    }

    const where: Prisma.CategoryWhereInput = {
      parentId,
      deletedAt: null,
    }

    if (!includeInactive) {
      where.isActive = true
    }

    return this.prisma.category.findMany({
      where,
      include: {
        children: {
          where: {
            deletedAt: null,
            ...(includeInactive ? {} : { isActive: true }),
          },
          orderBy: { sortOrder: 'asc' },
        },
        _count: {
          select: {
            products: {
              where: {
                product: {
                  deletedAt: null,
                  isActive: true,
                },
              },
            },
          },
        },
      },
      orderBy: { sortOrder: 'asc' },
    })
  }

  async getAllSubcategoryIds(categoryId: string): Promise<string[]> {
    const subcategoryIds: string[] = [categoryId]

    const children = await this.prisma.category.findMany({
      where: {
        parentId: categoryId,
        deletedAt: null,
      },
      select: { id: true },
    })

    for (const child of children) {
      const childSubcategoryIds = await this.getAllSubcategoryIds(child.id)
      subcategoryIds.push(...childSubcategoryIds)
    }

    return subcategoryIds
  }

  async getCategoryPath(categoryId: string): Promise<CategoryBreadcrumbDto[]> {
    const path: CategoryBreadcrumbDto[] = []
    let currentCategory = await this.findById(categoryId)

    if (!currentCategory) {
      throw new NotFoundException('Категория не найдена')
    }

    // Идем вверх по дереву
    while (currentCategory) {
      path.unshift({
        id: currentCategory.id,
        name: currentCategory.name,
        slug: currentCategory.slug,
      })

      if (currentCategory.parentId) {
        currentCategory = await this.findById(currentCategory.parentId)
      } else {
        break
      }
    }

    return path
  }

  @CacheEvict({
    key: (id: string) => `${CacheKeys.CATEGORY}${id}`,
  })
  async update(id: string, updateCategoryDto: UpdateCategoryDto): Promise<CategoryWithRelations> {
    try {
      const category = await this.findById(id)
      if (!category) {
        throw new NotFoundException('Категория не найдена')
      }

      // Проверяем, не пытаемся ли мы сделать категорию своим же родителем
      if (updateCategoryDto.parentId) {
        if (updateCategoryDto.parentId === id) {
          throw new BadRequestException('Категория не может быть родителем самой себе')
        }

        // Проверяем, не создаем ли мы циклическую зависимость
        const allSubcategoryIds = await this.getAllSubcategoryIds(id)
        if (allSubcategoryIds.includes(updateCategoryDto.parentId)) {
          throw new BadRequestException('Невозможно создать циклическую зависимость категорий')
        }

        // Проверяем существование новой родительской категории
        const parentCategory = await this.findById(updateCategoryDto.parentId)
        if (!parentCategory) {
          throw new NotFoundException('Родительская категория не найдена')
        }
      }

      // Автогенерация SEO полей если не указаны
      const parentCategory = updateCategoryDto.parentId
        ? await this.findById(updateCategoryDto.parentId)
        : category.parent

      const seoData = this.generateSeoData(
        updateCategoryDto.name || category.name,
        updateCategoryDto.description || category.description,
        parentCategory?.name,
        updateCategoryDto,
        category,
      )

      const updatedCategory = await this.prisma.category.update({
        where: { id },
        data: {
          ...updateCategoryDto,
          metaTitle: seoData.metaTitle,
          metaDescription: seoData.metaDescription,
          metaKeywords: seoData.metaKeywords,
        },
        include: {
          parent: true,
          children: {
            where: { deletedAt: null },
            orderBy: { sortOrder: 'asc' },
          },
          _count: {
            select: {
              products: {
                where: {
                  product: {
                    deletedAt: null,
                    isActive: true,
                  },
                },
              },
            },
          },
        },
      })

      // Инвалидируем кеш дерева категорий
      await this.invalidateCategoryTreeCache()

      return updatedCategory
    } catch (error) {
      PrismaErrorHelper.handleError(error)
    }
  }

  @CacheEvict({
    key: (id: string) => `${CacheKeys.CATEGORY}${id}`,
  })
  async softDelete(id: string): Promise<void> {
    const category = await this.findById(id)
    if (!category) {
      throw new NotFoundException('Категория не найдена')
    }

    // Проверяем наличие товаров в категории
    const productCount = await this.prisma.productCategory.count({
      where: {
        categoryId: id,
        product: {
          deletedAt: null,
        },
      },
    })

    if (productCount > 0) {
      throw new ConflictException(
        `Невозможно удалить категорию. В ней находится ${productCount} товаров`,
      )
    }

    // Проверяем наличие подкатегорий
    const childrenCount = await this.prisma.category.count({
      where: {
        parentId: id,
        deletedAt: null,
      },
    })

    if (childrenCount > 0) {
      throw new ConflictException(
        `Невозможно удалить категорию. В ней находится ${childrenCount} подкатегорий`,
      )
    }

    await this.prisma.category.update({
      where: { id },
      data: { deletedAt: new Date() },
    })

    // Инвалидируем кеш
    await this.invalidateCategoryTreeCache()
  }

  async getProductCount(categoryId: string, includeSubcategories = false): Promise<number> {
    if (!includeSubcategories) {
      return this.prisma.productCategory.count({
        where: {
          categoryId,
          product: {
            deletedAt: null,
            isActive: true,
          },
        },
      })
    }

    // Получаем все ID подкатегорий
    const allCategoryIds = await this.getAllSubcategoryIds(categoryId)

    return this.prisma.productCategory.count({
      where: {
        categoryId: {
          in: allCategoryIds,
        },
        product: {
          deletedAt: null,
          isActive: true,
        },
      },
    })
  }

  /**
   * Генерация SEO данных для категории
   */
  private generateSeoData(
    name: string,
    description?: string | null,
    parentName?: string | null,
    dto?: Partial<CreateCategoryDto | UpdateCategoryDto>,
    existingCategory?: Category | null,
  ): {
    metaTitle: string
    metaDescription: string
    metaKeywords: string
  } {
    return {
      metaTitle:
        dto?.metaTitle || existingCategory?.metaTitle || SeoUtil.generateCategoryMetaTitle(name),
      metaDescription:
        dto?.metaDescription ||
        existingCategory?.metaDescription ||
        SeoUtil.generateCategoryMetaDescription(name, description),
      metaKeywords:
        dto?.metaKeywords ||
        existingCategory?.metaKeywords ||
        SeoUtil.generateCategoryMetaKeywords(name, parentName),
    }
  }

  private async enrichCategoryWithProductCount(category: CategoryWithRelations): Promise<void> {
    // Прямое количество товаров в категории
    const directCount = await this.prisma.productCategory.count({
      where: {
        categoryId: category.id,
        product: {
          deletedAt: null,
          isActive: true,
        },
      },
    })

    category.productCount = directCount

    // Рекурсивно обрабатываем детей
    let totalCount = directCount
    if (category.children && category.children.length > 0) {
      for (const child of category.children) {
        await this.enrichCategoryWithProductCount(child)
        totalCount += child.totalProductCount || 0
      }
    }

    category.totalProductCount = totalCount
  }

  private async invalidateCategoryTreeCache(): Promise<void> {
    await this.redisService.del(`${CacheKeys.CATEGORIES}tree`)
  }

  async findAll(includeInactive = false): Promise<Category[]> {
    const where: Prisma.CategoryWhereInput = {
      deletedAt: null,
    }

    if (!includeInactive) {
      where.isActive = true
    }

    return this.prisma.category.findMany({
      where,
      orderBy: [{ parentId: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
    })
  }
}
