// src/modules/characteristics/characteristics.controller.ts
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
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger'
import { CharacteristicsService } from './characteristics.service'
import { CreateCharacteristicDto } from './dto/create-characteristic.dto'
import { UpdateCharacteristicDto } from './dto/update-characteristic.dto'
import { CharacteristicsFilterDto } from './dto/characteristics-filter.dto'
import { CharacteristicValueDto } from './dto/characteristic-value.dto'
import { CharacteristicResponseDto } from './dto/characteristic-response.dto'
import { RequireRoles } from '../auth/decorators/require-roles.decorator'
import { UserRole } from '@prisma/client'

@ApiTags('Characteristics')
@Controller('characteristics')
export class CharacteristicsController {
  constructor(private readonly characteristicsService: CharacteristicsService) {}

  @Post()
  @RequireRoles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Создать характеристику' })
  @ApiResponse({
    status: 201,
    description: 'Характеристика создана',
    type: CharacteristicResponseDto,
  })
  async create(
    @Body() createCharacteristicDto: CreateCharacteristicDto,
  ): Promise<CharacteristicResponseDto> {
    const characteristic = await this.characteristicsService.create(createCharacteristicDto)
    return CharacteristicResponseDto.fromEntity(characteristic)
  }

  @Get()
  @ApiOperation({ summary: 'Получить все характеристики' })
  @ApiResponse({
    status: 200,
    description: 'Список характеристик',
    type: [CharacteristicResponseDto],
  })
  async findAll(
    @Query() filterDto: CharacteristicsFilterDto,
  ): Promise<CharacteristicResponseDto[]> {
    const characteristics = await this.characteristicsService.findAll(filterDto)
    return characteristics.map((characteristic) =>
      CharacteristicResponseDto.fromEntity(characteristic),
    )
  }

  @Get('category/:categoryId')
  @ApiOperation({ summary: 'Получить характеристики категории' })
  @ApiParam({
    name: 'categoryId',
    description: 'ID категории',
  })
  @ApiResponse({
    status: 200,
    description: 'Характеристики категории',
    type: [CharacteristicResponseDto],
  })
  async findByCategoryId(
    @Param('categoryId') categoryId: string,
  ): Promise<CharacteristicResponseDto[]> {
    const characteristics = await this.characteristicsService.findByCategoryId(categoryId)
    return characteristics.map((characteristic) =>
      CharacteristicResponseDto.fromEntity(characteristic),
    )
  }

  @Get(':id')
  @ApiOperation({ summary: 'Получить характеристику по ID' })
  @ApiParam({
    name: 'id',
    description: 'ID характеристики',
  })
  @ApiResponse({
    status: 200,
    description: 'Данные характеристики',
    type: CharacteristicResponseDto,
  })
  async findOne(@Param('id') id: string): Promise<CharacteristicResponseDto> {
    const characteristic = await this.characteristicsService.findById(id)
    if (!characteristic) {
      throw new NotFoundException('Характеристика не найдена')
    }
    return CharacteristicResponseDto.fromEntity(characteristic)
  }

  @Get('code/:code')
  @ApiOperation({ summary: 'Получить характеристику по коду' })
  @ApiParam({
    name: 'code',
    description: 'Код характеристики',
  })
  @ApiResponse({
    status: 200,
    description: 'Данные характеристики',
    type: CharacteristicResponseDto,
  })
  async findByCode(@Param('code') code: string): Promise<CharacteristicResponseDto> {
    const characteristic = await this.characteristicsService.findByCode(code)
    if (!characteristic) {
      throw new NotFoundException('Характеристика не найдена')
    }
    return CharacteristicResponseDto.fromEntity(characteristic)
  }

  @Post(':id/validate')
  @ApiOperation({ summary: 'Валидировать значение характеристики' })
  @ApiParam({
    name: 'id',
    description: 'ID характеристики',
  })
  @ApiResponse({
    status: 200,
    description: 'Результат валидации',
    schema: {
      type: 'object',
      properties: {
        isValid: { type: 'boolean' },
        message: { type: 'string' },
      },
    },
  })
  async validateValue(
    @Param('id') id: string,
    @Body() value: CharacteristicValueDto,
  ): Promise<{ isValid: boolean; message?: string }> {
    return this.characteristicsService.validateCharacteristicValue(id, value)
  }

  @Post(':id/values')
  @RequireRoles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Добавить значение для характеристики типа select' })
  @ApiParam({
    name: 'id',
    description: 'ID характеристики',
  })
  @HttpCode(HttpStatus.CREATED)
  @ApiResponse({
    status: 201,
    description: 'Значение добавлено',
  })
  async addValue(
    @Param('id') id: string,
    @Body() body: { value: string; sortOrder?: number },
  ): Promise<void> {
    await this.characteristicsService.addCharacteristicValue(id, body.value, body.sortOrder)
  }

  @Delete(':id/values/:valueId')
  @RequireRoles(UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Удалить значение характеристики' })
  @ApiParam({
    name: 'id',
    description: 'ID характеристики',
  })
  @ApiParam({
    name: 'valueId',
    description: 'ID значения',
  })
  @ApiResponse({
    status: 204,
    description: 'Значение удалено',
  })
  @ApiResponse({
    status: 409,
    description: 'Невозможно удалить значение, используемое в товарах',
  })
  async removeValue(@Param('id') id: string, @Param('valueId') valueId: string): Promise<void> {
    await this.characteristicsService.removeCharacteristicValue(id, valueId)
  }

  @Patch(':id')
  @RequireRoles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Обновить характеристику' })
  @ApiParam({
    name: 'id',
    description: 'ID характеристики',
  })
  @ApiResponse({
    status: 200,
    description: 'Характеристика обновлена',
    type: CharacteristicResponseDto,
  })
  async update(
    @Param('id') id: string,
    @Body() updateCharacteristicDto: UpdateCharacteristicDto,
  ): Promise<CharacteristicResponseDto> {
    const characteristic = await this.characteristicsService.update(id, updateCharacteristicDto)
    return CharacteristicResponseDto.fromEntity(characteristic)
  }

  @Delete(':id')
  @RequireRoles(UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Удалить характеристику' })
  @ApiParam({
    name: 'id',
    description: 'ID характеристики',
  })
  @ApiResponse({
    status: 204,
    description: 'Характеристика удалена',
  })
  @ApiResponse({
    status: 409,
    description: 'Невозможно удалить характеристику с товарами',
  })
  async remove(@Param('id') id: string): Promise<void> {
    await this.characteristicsService.delete(id)
  }

  @Get('product/:productId')
  @ApiOperation({ summary: 'Получить характеристики товара' })
  @ApiParam({
    name: 'productId',
    description: 'ID товара',
  })
  @ApiResponse({
    status: 200,
    description: 'Характеристики товара',
  })
  async getProductCharacteristics(@Param('productId') productId: string): Promise<any[]> {
    return this.characteristicsService.getCharacteristicsByProductId(productId)
  }
}
