// src/modules/products/products.controller.ts
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
import { ProductsService } from './products.service'
import { BrandsService } from './brands.service'
import { CreateProductDto } from './dto/create-product.dto'
import { UpdateProductDto } from './dto/update-product.dto'
import { CreateBrandDto } from './dto/create-brand.dto'
import { UpdateBrandDto } from './dto/update-brand.dto'
import { ProductsFilterDto } from './dto/products-filter.dto'
import {
  ProductResponseDto,
  ProductListItemDto,
  BrandResponseDto,
} from './dto/product-response.dto'
import { RequireRoles } from '../auth/decorators/require-roles.decorator'
import { UserRole } from '@prisma/client'
import { PaginationDto } from '@common/dto/pagination.dto'

@ApiTags('Products')
@Controller('products')
export class ProductsController {
  constructor(
    private readonly productsService: ProductsService,
    private readonly brandsService: BrandsService,
  ) {}

  @Post()
  @RequireRoles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Создать товар' })
  @ApiResponse({
    status: 201,
    description: 'Товар создан',
    type: ProductResponseDto,
  })
  async create(@Body() createProductDto: CreateProductDto): Promise<ProductResponseDto> {
    const product = await this.productsService.create(createProductDto)
    return ProductResponseDto.fromEntity(product)
  }

  @Get()
  @ApiOperation({ summary: 'Получить список товаров' })
  @ApiResponse({
    status: 200,
    description: 'Список товаров',
  })
  async findAll(@Query() paginationDto: PaginationDto, @Query() filterDto: ProductsFilterDto) {
    const result = await this.productsService.findAll(paginationDto, filterDto)

    return {
      ...result,
      data: result.data.map((product) => ProductListItemDto.fromEntity(product)),
    }
  }

  @Get('search')
  @ApiOperation({ summary: 'Поиск товаров' })
  @ApiQuery({
    name: 'q',
    required: true,
    description: 'Поисковый запрос',
  })
  @ApiResponse({
    status: 200,
    description: 'Результаты поиска',
  })
  async search(@Query('q') query: string, @Query() paginationDto: PaginationDto) {
    const filterDto = new ProductsFilterDto()
    filterDto.search = query

    const result = await this.productsService.findAll(paginationDto, filterDto)

    return {
      ...result,
      data: result.data.map((product) => ProductListItemDto.fromEntity(product)),
      query,
    }
  }

  @Get('category/:categoryId')
  @ApiOperation({ summary: 'Получить товары категории' })
  @ApiResponse({
    status: 200,
    description: 'Товары категории',
  })
  async findByCategory(
    @Param('categoryId') categoryId: string,
    @Query() paginationDto: PaginationDto,
    @Query() filterDto: ProductsFilterDto,
  ) {
    const result = await this.productsService.findByCategory(categoryId, paginationDto, filterDto)

    return {
      ...result,
      data: result.data.map((product) => ProductListItemDto.fromEntity(product)),
    }
  }

  @Get(':id')
  @ApiOperation({ summary: 'Получить товар по ID' })
  @ApiResponse({
    status: 200,
    description: 'Данные товара',
    type: ProductResponseDto,
  })
  async findOne(@Param('id') id: string): Promise<ProductResponseDto> {
    const product = await this.productsService.findById(id)
    if (!product) {
      throw new NotFoundException('Товар не найден')
    }
    return ProductResponseDto.fromEntity(product)
  }

  @Get('slug/:slug')
  @ApiOperation({ summary: 'Получить товар по slug' })
  @ApiResponse({
    status: 200,
    description: 'Данные товара',
    type: ProductResponseDto,
  })
  async findBySlug(@Param('slug') slug: string): Promise<ProductResponseDto> {
    const product = await this.productsService.findBySlug(slug)
    if (!product) {
      throw new NotFoundException('Товар не найден')
    }
    return ProductResponseDto.fromEntity(product)
  }

  @Get('sku/:sku')
  @ApiOperation({ summary: 'Получить товар по артикулу' })
  @ApiResponse({
    status: 200,
    description: 'Данные товара',
    type: ProductResponseDto,
  })
  async findBySku(@Param('sku') sku: string): Promise<ProductResponseDto> {
    const product = await this.productsService.findBySku(sku)
    if (!product) {
      throw new NotFoundException('Товар не найден')
    }
    return ProductResponseDto.fromEntity(product)
  }

  @Get(':id/related')
  @ApiOperation({ summary: 'Получить похожие товары' })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Количество товаров',
    example: 8,
  })
  @ApiResponse({
    status: 200,
    description: 'Похожие товары',
    type: [ProductListItemDto],
  })
  async getRelatedProducts(
    @Param('id') id: string,
    @Query('limit') limit?: number,
  ): Promise<ProductListItemDto[]> {
    const products = await this.productsService.getRelatedProducts(id, limit)
    return products.map((product) => ProductListItemDto.fromEntity(product))
  }

  @Patch(':id')
  @RequireRoles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Обновить товар' })
  @ApiResponse({
    status: 200,
    description: 'Товар обновлен',
    type: ProductResponseDto,
  })
  async update(
    @Param('id') id: string,
    @Body() updateProductDto: UpdateProductDto,
  ): Promise<ProductResponseDto> {
    const product = await this.productsService.update(id, updateProductDto)
    return ProductResponseDto.fromEntity(product)
  }

  @Delete(':id')
  @RequireRoles(UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Удалить товар' })
  @ApiResponse({
    status: 204,
    description: 'Товар удален',
  })
  @ApiResponse({
    status: 409,
    description: 'Невозможно удалить товар с активными заказами',
  })
  async remove(@Param('id') id: string): Promise<void> {
    await this.productsService.softDelete(id)
  }

  // Бренды
  @Post('brands')
  @RequireRoles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Создать бренд' })
  @ApiResponse({
    status: 201,
    description: 'Бренд создан',
    type: BrandResponseDto,
  })
  async createBrand(@Body() createBrandDto: CreateBrandDto): Promise<BrandResponseDto> {
    return this.brandsService.create(createBrandDto)
  }

  @Get('brands')
  @ApiOperation({ summary: 'Получить список брендов' })
  @ApiQuery({
    name: 'includeInactive',
    required: false,
    type: Boolean,
    description: 'Включить неактивные бренды',
  })
  @ApiResponse({
    status: 200,
    description: 'Список брендов',
    type: [BrandResponseDto],
  })
  async findAllBrands(
    @Query('includeInactive') includeInactive?: boolean,
  ): Promise<BrandResponseDto[]> {
    return this.brandsService.findAll(includeInactive)
  }

  @Get('brands/:id')
  @ApiOperation({ summary: 'Получить бренд по ID' })
  @ApiResponse({
    status: 200,
    description: 'Данные бренда',
    type: BrandResponseDto,
  })
  async findBrand(@Param('id') id: string): Promise<BrandResponseDto> {
    const brand = await this.brandsService.findById(id)
    if (!brand) {
      throw new NotFoundException('Бренд не найден')
    }
    return brand
  }

  @Get('brands/slug/:slug')
  @ApiOperation({ summary: 'Получить бренд по slug' })
  @ApiResponse({
    status: 200,
    description: 'Данные бренда',
    type: BrandResponseDto,
  })
  async findBrandBySlug(@Param('slug') slug: string): Promise<BrandResponseDto> {
    const brand = await this.brandsService.findBySlug(slug)
    if (!brand) {
      throw new NotFoundException('Бренд не найден')
    }
    return brand
  }

  @Patch('brands/:id')
  @RequireRoles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Обновить бренд' })
  @ApiResponse({
    status: 200,
    description: 'Бренд обновлен',
    type: BrandResponseDto,
  })
  async updateBrand(
    @Param('id') id: string,
    @Body() updateBrandDto: UpdateBrandDto,
  ): Promise<BrandResponseDto> {
    return this.brandsService.update(id, updateBrandDto)
  }

  @Delete('brands/:id')
  @RequireRoles(UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Удалить бренд' })
  @ApiResponse({
    status: 204,
    description: 'Бренд удален',
  })
  @ApiResponse({
    status: 409,
    description: 'Невозможно удалить бренд с товарами',
  })
  async removeBrand(@Param('id') id: string): Promise<void> {
    await this.brandsService.delete(id)
  }
}
