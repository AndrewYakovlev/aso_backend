// src/modules/vehicles/vehicles.controller.ts
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
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiParam } from '@nestjs/swagger'
import { VehiclesService } from './vehicles.service'
import { CreateVehicleMakeDto } from './dto/create-vehicle-make.dto'
import { UpdateVehicleMakeDto } from './dto/update-vehicle-make.dto'
import { CreateVehicleModelDto } from './dto/create-vehicle-model.dto'
import { UpdateVehicleModelDto } from './dto/update-vehicle-model.dto'
import { CreateVehicleGenerationDto } from './dto/create-vehicle-generation.dto'
import { UpdateVehicleGenerationDto } from './dto/update-vehicle-generation.dto'
import { CreateVehicleModificationDto } from './dto/create-vehicle-modification.dto'
import { UpdateVehicleModificationDto } from './dto/update-vehicle-modification.dto'
import { VehicleFilterDto, VehicleSearchDto } from './dto/vehicle-filters.dto'
import {
  VehicleMakeResponseDto,
  VehicleModelResponseDto,
  VehicleGenerationResponseDto,
  VehicleModificationResponseDto,
  VehicleSearchResultDto,
} from './dto/vehicle-response.dto'
import { RequireRoles } from '../auth/decorators/require-roles.decorator'
import { UserRole } from '@prisma/client'

@ApiTags('Vehicles')
@Controller('vehicles')
export class VehiclesController {
  constructor(private readonly vehiclesService: VehiclesService) {}

  // ================== MAKES ==================

  @Post('makes')
  @RequireRoles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Создать марку автомобиля' })
  @ApiResponse({
    status: 201,
    description: 'Марка создана',
    type: VehicleMakeResponseDto,
  })
  async createMake(@Body() dto: CreateVehicleMakeDto): Promise<VehicleMakeResponseDto> {
    const make = await this.vehiclesService.createMake(dto)
    return VehicleMakeResponseDto.fromEntity(make)
  }

  @Get('makes')
  @ApiOperation({ summary: 'Получить список марок' })
  @ApiResponse({
    status: 200,
    description: 'Список марок',
    type: [VehicleMakeResponseDto],
  })
  async findAllMakes(@Query() filter: VehicleFilterDto): Promise<VehicleMakeResponseDto[]> {
    const makes = await this.vehiclesService.findAllMakes(filter)
    return makes.map((make) => VehicleMakeResponseDto.fromEntity(make))
  }

  @Get('makes/:id')
  @ApiOperation({ summary: 'Получить марку по ID' })
  @ApiParam({ name: 'id', description: 'ID марки' })
  @ApiResponse({
    status: 200,
    description: 'Данные марки',
    type: VehicleMakeResponseDto,
  })
  async findMake(@Param('id') id: string): Promise<VehicleMakeResponseDto> {
    const make = await this.vehiclesService.findMakeById(id)
    if (!make) {
      throw new NotFoundException('Марка не найдена')
    }
    return VehicleMakeResponseDto.fromEntity(make)
  }

  @Get('makes/slug/:slug')
  @ApiOperation({ summary: 'Получить марку по slug' })
  @ApiParam({ name: 'slug', description: 'Slug марки' })
  @ApiResponse({
    status: 200,
    description: 'Данные марки',
    type: VehicleMakeResponseDto,
  })
  async findMakeBySlug(@Param('slug') slug: string): Promise<VehicleMakeResponseDto> {
    const make = await this.vehiclesService.findMakeBySlug(slug)
    if (!make) {
      throw new NotFoundException('Марка не найдена')
    }
    return VehicleMakeResponseDto.fromEntity(make)
  }

  @Patch('makes/:id')
  @RequireRoles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Обновить марку' })
  @ApiParam({ name: 'id', description: 'ID марки' })
  @ApiResponse({
    status: 200,
    description: 'Марка обновлена',
    type: VehicleMakeResponseDto,
  })
  async updateMake(
    @Param('id') id: string,
    @Body() dto: UpdateVehicleMakeDto,
  ): Promise<VehicleMakeResponseDto> {
    const make = await this.vehiclesService.updateMake(id, dto)
    return VehicleMakeResponseDto.fromEntity(make)
  }

  @Delete('makes/:id')
  @RequireRoles(UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Удалить марку' })
  @ApiParam({ name: 'id', description: 'ID марки' })
  @ApiResponse({
    status: 204,
    description: 'Марка удалена',
  })
  async deleteMake(@Param('id') id: string): Promise<void> {
    await this.vehiclesService.deleteMake(id)
  }

  // ================== MODELS ==================

  @Post('models')
  @RequireRoles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Создать модель автомобиля' })
  @ApiResponse({
    status: 201,
    description: 'Модель создана',
    type: VehicleModelResponseDto,
  })
  async createModel(@Body() dto: CreateVehicleModelDto): Promise<VehicleModelResponseDto> {
    const model = await this.vehiclesService.createModel(dto)
    return VehicleModelResponseDto.fromEntity(model)
  }

  @Get('models')
  @ApiOperation({ summary: 'Получить список моделей' })
  @ApiQuery({
    name: 'makeId',
    required: false,
    description: 'Фильтр по марке',
  })
  @ApiResponse({
    status: 200,
    description: 'Список моделей',
    type: [VehicleModelResponseDto],
  })
  async findAllModels(
    @Query('makeId') makeId?: string,
    @Query() filter?: VehicleFilterDto,
  ): Promise<VehicleModelResponseDto[]> {
    const models = await this.vehiclesService.findAllModels(makeId, filter)
    return models.map((model) => VehicleModelResponseDto.fromEntity(model))
  }

  @Get('models/:id')
  @ApiOperation({ summary: 'Получить модель по ID' })
  @ApiParam({ name: 'id', description: 'ID модели' })
  @ApiResponse({
    status: 200,
    description: 'Данные модели',
    type: VehicleModelResponseDto,
  })
  async findModel(@Param('id') id: string): Promise<VehicleModelResponseDto> {
    const model = await this.vehiclesService.findModelById(id)
    if (!model) {
      throw new NotFoundException('Модель не найдена')
    }
    return VehicleModelResponseDto.fromEntity(model)
  }

  @Get('models/slug/:slug')
  @ApiOperation({ summary: 'Получить модель по slug' })
  @ApiParam({ name: 'slug', description: 'Slug модели' })
  @ApiResponse({
    status: 200,
    description: 'Данные модели',
    type: VehicleModelResponseDto,
  })
  async findModelBySlug(@Param('slug') slug: string): Promise<VehicleModelResponseDto> {
    const model = await this.vehiclesService.findModelBySlug(slug)
    if (!model) {
      throw new NotFoundException('Модель не найдена')
    }
    return VehicleModelResponseDto.fromEntity(model)
  }

  @Patch('models/:id')
  @RequireRoles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Обновить модель' })
  @ApiParam({ name: 'id', description: 'ID модели' })
  @ApiResponse({
    status: 200,
    description: 'Модель обновлена',
    type: VehicleModelResponseDto,
  })
  async updateModel(
    @Param('id') id: string,
    @Body() dto: UpdateVehicleModelDto,
  ): Promise<VehicleModelResponseDto> {
    const model = await this.vehiclesService.updateModel(id, dto)
    return VehicleModelResponseDto.fromEntity(model)
  }

  @Delete('models/:id')
  @RequireRoles(UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Удалить модель' })
  @ApiParam({ name: 'id', description: 'ID модели' })
  @ApiResponse({
    status: 204,
    description: 'Модель удалена',
  })
  async deleteModel(@Param('id') id: string): Promise<void> {
    await this.vehiclesService.deleteModel(id)
  }

  // ================== GENERATIONS ==================

  @Post('generations')
  @RequireRoles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Создать поколение автомобиля' })
  @ApiResponse({
    status: 201,
    description: 'Поколение создано',
    type: VehicleGenerationResponseDto,
  })
  async createGeneration(
    @Body() dto: CreateVehicleGenerationDto,
  ): Promise<VehicleGenerationResponseDto> {
    const generation = await this.vehiclesService.createGeneration(dto)
    return VehicleGenerationResponseDto.fromEntity(generation)
  }

  @Get('generations')
  @ApiOperation({ summary: 'Получить список поколений' })
  @ApiQuery({
    name: 'modelId',
    required: false,
    description: 'Фильтр по модели',
  })
  @ApiResponse({
    status: 200,
    description: 'Список поколений',
    type: [VehicleGenerationResponseDto],
  })
  async findAllGenerations(
    @Query('modelId') modelId?: string,
    @Query() filter?: VehicleFilterDto,
  ): Promise<VehicleGenerationResponseDto[]> {
    const generations = await this.vehiclesService.findAllGenerations(modelId, filter)
    return generations.map((generation) => VehicleGenerationResponseDto.fromEntity(generation))
  }

  @Get('generations/:id')
  @ApiOperation({ summary: 'Получить поколение по ID' })
  @ApiParam({ name: 'id', description: 'ID поколения' })
  @ApiResponse({
    status: 200,
    description: 'Данные поколения',
    type: VehicleGenerationResponseDto,
  })
  async findGeneration(@Param('id') id: string): Promise<VehicleGenerationResponseDto> {
    const generation = await this.vehiclesService.findGenerationById(id)
    if (!generation) {
      throw new NotFoundException('Поколение не найдено')
    }
    return VehicleGenerationResponseDto.fromEntity(generation)
  }

  @Get('generations/slug/:slug')
  @ApiOperation({ summary: 'Получить поколение по slug' })
  @ApiParam({ name: 'slug', description: 'Slug поколения' })
  @ApiResponse({
    status: 200,
    description: 'Данные поколения',
    type: VehicleGenerationResponseDto,
  })
  async findGenerationBySlug(@Param('slug') slug: string): Promise<VehicleGenerationResponseDto> {
    const generation = await this.vehiclesService.findGenerationBySlug(slug)
    if (!generation) {
      throw new NotFoundException('Поколение не найдено')
    }
    return VehicleGenerationResponseDto.fromEntity(generation)
  }

  @Patch('generations/:id')
  @RequireRoles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Обновить поколение' })
  @ApiParam({ name: 'id', description: 'ID поколения' })
  @ApiResponse({
    status: 200,
    description: 'Поколение обновлено',
    type: VehicleGenerationResponseDto,
  })
  async updateGeneration(
    @Param('id') id: string,
    @Body() dto: UpdateVehicleGenerationDto,
  ): Promise<VehicleGenerationResponseDto> {
    const generation = await this.vehiclesService.updateGeneration(id, dto)
    return VehicleGenerationResponseDto.fromEntity(generation)
  }

  @Delete('generations/:id')
  @RequireRoles(UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Удалить поколение' })
  @ApiParam({ name: 'id', description: 'ID поколения' })
  @ApiResponse({
    status: 204,
    description: 'Поколение удалено',
  })
  async deleteGeneration(@Param('id') id: string): Promise<void> {
    await this.vehiclesService.deleteGeneration(id)
  }

  // ================== MODIFICATIONS ==================

  @Post('modifications')
  @RequireRoles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Создать модификацию автомобиля' })
  @ApiResponse({
    status: 201,
    description: 'Модификация создана',
    type: VehicleModificationResponseDto,
  })
  async createModification(
    @Body() dto: CreateVehicleModificationDto,
  ): Promise<VehicleModificationResponseDto> {
    const modification = await this.vehiclesService.createModification(dto)
    return VehicleModificationResponseDto.fromEntity(modification)
  }

  @Get('modifications')
  @ApiOperation({ summary: 'Получить список модификаций' })
  @ApiQuery({
    name: 'generationId',
    required: false,
    description: 'Фильтр по поколению',
  })
  @ApiResponse({
    status: 200,
    description: 'Список модификаций',
    type: [VehicleModificationResponseDto],
  })
  async findAllModifications(
    @Query('generationId') generationId?: string,
  ): Promise<VehicleModificationResponseDto[]> {
    const modifications = await this.vehiclesService.findAllModifications(generationId)
    return modifications.map((modification) =>
      VehicleModificationResponseDto.fromEntity(modification),
    )
  }

  @Get('modifications/:id')
  @ApiOperation({ summary: 'Получить модификацию по ID' })
  @ApiParam({ name: 'id', description: 'ID модификации' })
  @ApiResponse({
    status: 200,
    description: 'Данные модификации',
    type: VehicleModificationResponseDto,
  })
  async findModification(@Param('id') id: string): Promise<VehicleModificationResponseDto> {
    const modification = await this.vehiclesService.findModificationById(id)
    if (!modification) {
      throw new NotFoundException('Модификация не найдена')
    }
    return VehicleModificationResponseDto.fromEntity(modification)
  }

  @Patch('modifications/:id')
  @RequireRoles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Обновить модификацию' })
  @ApiParam({ name: 'id', description: 'ID модификации' })
  @ApiResponse({
    status: 200,
    description: 'Модификация обновлена',
    type: VehicleModificationResponseDto,
  })
  async updateModification(
    @Param('id') id: string,
    @Body() dto: UpdateVehicleModificationDto,
  ): Promise<VehicleModificationResponseDto> {
    const modification = await this.vehiclesService.updateModification(id, dto)
    return VehicleModificationResponseDto.fromEntity(modification)
  }

  @Delete('modifications/:id')
  @RequireRoles(UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Удалить модификацию' })
  @ApiParam({ name: 'id', description: 'ID модификации' })
  @ApiResponse({
    status: 204,
    description: 'Модификация удалена',
  })
  async deleteModification(@Param('id') id: string): Promise<void> {
    await this.vehiclesService.deleteModification(id)
  }

  // ================== SEARCH & UTILITIES ==================

  @Get('search')
  @ApiOperation({ summary: 'Поиск автомобилей' })
  @ApiResponse({
    status: 200,
    description: 'Результаты поиска',
    type: [VehicleSearchResultDto],
  })
  async searchVehicles(@Query() searchDto: VehicleSearchDto): Promise<any[]> {
    const results = await this.vehiclesService.searchVehicles(searchDto)
    return results.map((result) => ({
      make: VehicleMakeResponseDto.fromEntity(result.make),
      model: result.model ? VehicleModelResponseDto.fromEntity(result.model) : undefined,
      generation: result.generation
        ? VehicleGenerationResponseDto.fromEntity(result.generation)
        : undefined,
      modification: result.modification
        ? VehicleModificationResponseDto.fromEntity(result.modification)
        : undefined,
      fullName: [
        result.make.name,
        result.model?.name,
        result.generation?.name,
        result.modification?.name,
      ]
        .filter(Boolean)
        .join(' '),
    }))
  }

  @Post('decode-vin')
  @ApiOperation({ summary: 'Декодирование VIN номера' })
  @ApiResponse({
    status: 200,
    description: 'Данные автомобиля по VIN',
  })
  async decodeVin(@Body() dto: { vin: string }): Promise<any> {
    // TODO: Интеграция с сервисом декодирования VIN
    throw new NotFoundException('Функция декодирования VIN еще не реализована')
  }

  @Get(':id/parts')
  @ApiOperation({ summary: 'Получить запчасти для автомобиля' })
  @ApiParam({ name: 'id', description: 'ID модификации автомобиля' })
  @ApiResponse({
    status: 200,
    description: 'Список применимых запчастей',
  })
  async getVehicleParts(@Param('id') id: string): Promise<any> {
    // TODO: Реализовать после создания модуля VehicleApplications
    throw new NotFoundException('Функция получения запчастей еще не реализована')
  }

  // ================== SEO ENDPOINTS ==================

  @Get('seo/makes/:slug')
  @ApiOperation({ summary: 'Получить марку с SEO данными' })
  @ApiParam({ name: 'slug', description: 'Slug марки' })
  @ApiResponse({
    status: 200,
    description: 'Марка с SEO данными',
  })
  async getMakeWithSeo(@Param('slug') slug: string) {
    return this.vehiclesService.getMakeWithSeo(slug)
  }

  @Get('seo/models/:slug')
  @ApiOperation({ summary: 'Получить модель с SEO данными' })
  @ApiParam({ name: 'slug', description: 'Slug модели' })
  @ApiResponse({
    status: 200,
    description: 'Модель с SEO данными',
  })
  async getModelWithSeo(@Param('slug') slug: string) {
    return this.vehiclesService.getModelWithSeo(slug)
  }

  @Get('seo/generations/:slug')
  @ApiOperation({ summary: 'Получить поколение с SEO данными' })
  @ApiParam({ name: 'slug', description: 'Slug поколения' })
  @ApiResponse({
    status: 200,
    description: 'Поколение с SEO данными',
  })
  async getGenerationWithSeo(@Param('slug') slug: string) {
    return this.vehiclesService.getGenerationWithSeo(slug)
  }
}
