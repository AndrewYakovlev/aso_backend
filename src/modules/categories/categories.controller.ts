// src/modules/categories/categories.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  HttpCode,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common'
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger'
import { CategoriesService } from './categories.service'
import { CreateCategoryDto } from './dto/create-category.dto'
import { UpdateCategoryDto } from './dto/update-category.dto'
import {
  CategoryResponseDto,
  CategoryTreeResponseDto,
  CategoryBreadcrumbDto,
} from './dto/category-response.dto'
import { RequireRoles } from '../auth/decorators/require-roles.decorator'
import { UserRole } from '@prisma/client'

@ApiTags('Categories')
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Post()
  @RequireRoles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Создать категорию' })
  @ApiResponse({
    status: 201,
    description: 'Категория создана',
    type: CategoryResponseDto,
  })
  async create(@Body() createCategoryDto: CreateCategoryDto): Promise<CategoryResponseDto> {
    const category = await this.categoriesService.create(createCategoryDto)
    return CategoryResponseDto.fromEntity(category)
  }

  @Get()
  @ApiOperation({ summary: 'Получить все категории списком' })
  @ApiQuery({
    name: 'includeInactive',
    required: false,
    type: Boolean,
    description: 'Включить неактивные категории',
  })
  @ApiResponse({
    status: 200,
    description: 'Список категорий',
    type: [CategoryResponseDto],
  })
  async findAll(
    @Query('includeInactive') includeInactive?: boolean,
  ): Promise<CategoryResponseDto[]> {
    const categories = await this.categoriesService.findAll(includeInactive)
    return categories.map((category) => CategoryResponseDto.fromEntity(category))
  }

  @Get('tree')
  @ApiOperation({ summary: 'Получить дерево категорий' })
  @ApiQuery({
    name: 'includeInactive',
    required: false,
    type: Boolean,
    description: 'Включить неактивные категории',
  })
  @ApiResponse({
    status: 200,
    description: 'Дерево категорий',
    type: [CategoryTreeResponseDto],
  })
  async getCategoryTree(
    @Query('includeInactive') includeInactive?: boolean,
  ): Promise<CategoryTreeResponseDto[]> {
    const categories = await this.categoriesService.getCategoryTree(includeInactive)
    return categories.map((category) => CategoryTreeResponseDto.fromEntity(category))
  }

  @Get(':id')
  @ApiOperation({ summary: 'Получить категорию по ID' })
  @ApiResponse({
    status: 200,
    description: 'Данные категории',
    type: CategoryResponseDto,
  })
  async findOne(@Param('id') id: string): Promise<CategoryResponseDto> {
    const category = await this.categoriesService.findById(id)
    if (!category) {
      throw new NotFoundException('Категория не найдена')
    }
    return CategoryResponseDto.fromEntity(category)
  }

  @Get('slug/:slug')
  @ApiOperation({ summary: 'Получить категорию по slug' })
  @ApiResponse({
    status: 200,
    description: 'Данные категории',
    type: CategoryResponseDto,
  })
  async findBySlug(@Param('slug') slug: string): Promise<CategoryResponseDto> {
    const category = await this.categoriesService.findBySlug(slug)
    if (!category) {
      throw new NotFoundException('Категория не найдена')
    }
    return CategoryResponseDto.fromEntity(category)
  }

  @Get(':id/subcategories')
  @ApiOperation({ summary: 'Получить подкатегории' })
  @ApiQuery({
    name: 'includeInactive',
    required: false,
    type: Boolean,
    description: 'Включить неактивные категории',
  })
  @ApiResponse({
    status: 200,
    description: 'Список подкатегорий',
    type: [CategoryResponseDto],
  })
  async getSubcategories(
    @Param('id') id: string,
    @Query('includeInactive') includeInactive?: boolean,
  ): Promise<CategoryResponseDto[]> {
    const categories = await this.categoriesService.getSubcategories(id, includeInactive)
    return categories.map((category) => CategoryResponseDto.fromEntity(category))
  }

  @Get(':id/path')
  @ApiOperation({ summary: 'Получить путь категории (хлебные крошки)' })
  @ApiResponse({
    status: 200,
    description: 'Путь категории',
    type: [CategoryBreadcrumbDto],
  })
  async getCategoryPath(@Param('id') id: string): Promise<CategoryBreadcrumbDto[]> {
    return this.categoriesService.getCategoryPath(id)
  }

  @Get(':id/product-count')
  @ApiOperation({ summary: 'Получить количество товаров в категории' })
  @ApiQuery({
    name: 'includeSubcategories',
    required: false,
    type: Boolean,
    description: 'Включить товары из подкатегорий',
  })
  @ApiResponse({
    status: 200,
    description: 'Количество товаров',
    schema: {
      type: 'object',
      properties: {
        count: { type: 'number' },
      },
    },
  })
  async getProductCount(
    @Param('id') id: string,
    @Query('includeSubcategories') includeSubcategories?: boolean,
  ): Promise<{ count: number }> {
    const count = await this.categoriesService.getProductCount(id, includeSubcategories)
    return { count }
  }

  @Patch(':id')
  @RequireRoles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Обновить категорию' })
  @ApiResponse({
    status: 200,
    description: 'Категория обновлена',
    type: CategoryResponseDto,
  })
  async update(
    @Param('id') id: string,
    @Body() updateCategoryDto: UpdateCategoryDto,
  ): Promise<CategoryResponseDto> {
    const category = await this.categoriesService.update(id, updateCategoryDto)
    return CategoryResponseDto.fromEntity(category)
  }

  @Delete(':id')
  @RequireRoles(UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Удалить категорию' })
  @ApiResponse({
    status: 204,
    description: 'Категория удалена',
  })
  @ApiResponse({
    status: 409,
    description: 'Невозможно удалить категорию с товарами или подкатегориями',
  })
  async remove(@Param('id') id: string): Promise<void> {
    await this.categoriesService.softDelete(id)
  }
}
