// src/modules/vehicle-applications/vehicle-applications.controller.ts
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
} from '@nestjs/common'
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger'
import { VehicleApplicationsService } from './vehicle-applications.service'
import {
  CreateVehicleApplicationDto,
  CreateBulkApplicationDto,
} from './dto/create-vehicle-application.dto'
import { UpdateVehicleApplicationDto } from './dto/update-vehicle-application.dto'
import { VehicleApplicationFiltersDto } from './dto/vehicle-application-filters.dto'
import { VehicleApplicationResponseDto } from './dto/vehicle-application-response.dto'
import { RequireRoles } from '../auth/decorators/require-roles.decorator'
import { UserRole } from '@prisma/client'

@ApiTags('Vehicle Applications')
@Controller('vehicle-applications')
export class VehicleApplicationsController {
  constructor(private readonly service: VehicleApplicationsService) {}

  @Post()
  @RequireRoles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Создать применимость товара к модификациям' })
  @ApiResponse({
    status: 201,
    description: 'Применимость создана',
  })
  async create(@Body() dto: CreateVehicleApplicationDto) {
    return this.service.create(dto)
  }

  @Post('bulk')
  @RequireRoles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Массовое создание применимости' })
  @ApiResponse({
    status: 201,
    description: 'Применимости созданы',
  })
  async createBulk(@Body() dto: CreateBulkApplicationDto) {
    return this.service.createBulk(dto)
  }

  @Get()
  @ApiOperation({ summary: 'Получить список применимостей' })
  @ApiResponse({
    status: 200,
    description: 'Список применимостей',
  })
  async findAll(@Query() filters: VehicleApplicationFiltersDto) {
    return this.service.findAll(filters)
  }

  @Get(':id')
  @ApiOperation({ summary: 'Получить применимость по ID' })
  @ApiParam({ name: 'id', description: 'ID применимости' })
  @ApiResponse({
    status: 200,
    description: 'Данные применимости',
  })
  async findOne(@Param('id') id: string) {
    return this.service.findOne(id)
  }

  @Patch(':id')
  @RequireRoles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Обновить применимость' })
  @ApiParam({ name: 'id', description: 'ID применимости' })
  @ApiResponse({
    status: 200,
    description: 'Применимость обновлена',
  })
  async update(@Param('id') id: string, @Body() dto: UpdateVehicleApplicationDto) {
    return this.service.update(id, dto)
  }

  @Delete(':id')
  @RequireRoles(UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Удалить применимость' })
  @ApiParam({ name: 'id', description: 'ID применимости' })
  @ApiResponse({
    status: 204,
    description: 'Применимость удалена',
  })
  async remove(@Param('id') id: string) {
    await this.service.remove(id)
  }

  @Delete('product/:productId/modification/:modificationId')
  @RequireRoles(UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Удалить применимость по товару и модификации' })
  @ApiParam({ name: 'productId', description: 'ID товара' })
  @ApiParam({ name: 'modificationId', description: 'ID модификации' })
  @ApiResponse({
    status: 204,
    description: 'Применимость удалена',
  })
  async removeByProductAndModification(
    @Param('productId') productId: string,
    @Param('modificationId') modificationId: string,
  ) {
    await this.service.removeByProductAndModification(productId, modificationId)
  }

  @Get('modification/:modificationId/products')
  @ApiOperation({ summary: 'Получить товары для модификации' })
  @ApiParam({ name: 'modificationId', description: 'ID модификации' })
  @ApiResponse({
    status: 200,
    description: 'Товары для модификации',
  })
  async getProductsForModification(
    @Param('modificationId') modificationId: string,
    @Query() filters: VehicleApplicationFiltersDto,
  ) {
    return this.service.getProductsForModification(modificationId, filters)
  }

  @Get('product/:productId/vehicles')
  @ApiOperation({ summary: 'Получить автомобили для товара' })
  @ApiParam({ name: 'productId', description: 'ID товара' })
  @ApiResponse({
    status: 200,
    description: 'Автомобили для товара',
  })
  async getVehiclesForProduct(@Param('productId') productId: string) {
    return this.service.getVehiclesForProduct(productId)
  }
}
