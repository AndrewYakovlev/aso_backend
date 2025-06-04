// src/modules/characteristics/characteristics.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing'
import { ConflictException, NotFoundException, BadRequestException } from '@nestjs/common'
import { CharacteristicsService } from './characteristics.service'
import { PrismaService } from '../../prisma/prisma.service'
import { RedisService } from '../../redis/redis.service'
import { TestUtils } from '../../../test/test.utils'
import { CharacteristicType, CharacteristicFilterType } from './interfaces/characteristic.interface'

describe('CharacteristicsService', () => {
  let service: CharacteristicsService
  let prismaService: PrismaService
  let redisService: RedisService

  const mockCharacteristic = {
    id: 'char-1',
    name: 'Цвет',
    code: 'color',
    type: CharacteristicType.SELECT,
    unit: null,
    isRequired: false,
    isFilterable: true,
    filterType: CharacteristicFilterType.SELECT,
    sortOrder: 0,
    createdAt: new Date(),
    values: [
      { id: 'val-1', value: 'Красный', sortOrder: 0 },
      { id: 'val-2', value: 'Синий', sortOrder: 1 },
    ],
    categories: [
      {
        category: {
          id: 'cat-1',
          name: 'Масла',
          slug: 'masla',
        },
      },
    ],
    _count: {
      productValues: 10,
    },
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CharacteristicsService,
        {
          provide: PrismaService,
          useValue: {
            characteristic: {
              findUnique: jest.fn(),
              findMany: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
              count: jest.fn(),
            },
            characteristicValue: {
              findFirst: jest.fn(),
              deleteMany: jest.fn(),
              createMany: jest.fn(),
              create: jest.fn(),
              delete: jest.fn(),
              aggregate: jest.fn(),
            },
            characteristicCategory: {
              deleteMany: jest.fn(),
              createMany: jest.fn(),
            },
            category: {
              findUnique: jest.fn(),
              findMany: jest.fn(),
            },
            productCharacteristic: {
              count: jest.fn(),
              findMany: jest.fn(),
            },
          },
        },
        {
          provide: RedisService,
          useValue: TestUtils.createMockRedisService(),
        },
      ],
    }).compile()

    service = module.get<CharacteristicsService>(CharacteristicsService)
    prismaService = module.get<PrismaService>(PrismaService)
    redisService = module.get<RedisService>(RedisService)
  })

  describe('create', () => {
    const createDto = {
      name: 'Цвет',
      code: 'color',
      type: CharacteristicType.SELECT,
      isFilterable: true,
      filterType: CharacteristicFilterType.SELECT,
      categoryIds: ['cat-1'],
      values: [
        { value: 'Красный', sortOrder: 0 },
        { value: 'Синий', sortOrder: 1 },
      ],
    }

    it('should create characteristic successfully', async () => {
      jest.spyOn(prismaService.characteristic, 'findUnique').mockResolvedValue(null)
      jest.spyOn(prismaService.category, 'findMany').mockResolvedValue([{ id: 'cat-1' }] as any)
      jest
        .spyOn(prismaService.characteristic, 'create')
        .mockResolvedValue(mockCharacteristic as any)

      const result = await service.create(createDto)

      expect(result).toEqual(mockCharacteristic)
      expect(prismaService.characteristic.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: createDto.name,
          code: createDto.code,
          type: createDto.type,
        }),
        include: expect.any(Object),
      })
    })

    it('should throw ConflictException if code already exists', async () => {
      jest
        .spyOn(prismaService.characteristic, 'findUnique')
        .mockResolvedValue(mockCharacteristic as any)

      await expect(service.create(createDto)).rejects.toThrow(ConflictException)
    })

    it('should throw NotFoundException if category not found', async () => {
      jest.spyOn(prismaService.characteristic, 'findUnique').mockResolvedValue(null)
      jest.spyOn(prismaService.category, 'findMany').mockResolvedValue([])

      await expect(service.create(createDto)).rejects.toThrow(NotFoundException)
    })

    it('should throw BadRequestException if filterable without filterType', async () => {
      const invalidDto = { ...createDto, filterType: undefined }
      jest.spyOn(prismaService.characteristic, 'findUnique').mockResolvedValue(null)
      jest.spyOn(prismaService.category, 'findMany').mockResolvedValue([{ id: 'cat-1' }] as any)

      await expect(service.create(invalidDto)).rejects.toThrow(BadRequestException)
    })

    it('should throw BadRequestException if select type without values', async () => {
      const invalidDto = { ...createDto, values: [] }
      jest.spyOn(prismaService.characteristic, 'findUnique').mockResolvedValue(null)
      jest.spyOn(prismaService.category, 'findMany').mockResolvedValue([{ id: 'cat-1' }] as any)

      await expect(service.create(invalidDto)).rejects.toThrow(BadRequestException)
    })
  })

  describe('findById', () => {
    it('should return characteristic by id', async () => {
      jest
        .spyOn(prismaService.characteristic, 'findUnique')
        .mockResolvedValue(mockCharacteristic as any)

      const result = await service.findById('char-1')

      expect(result).toEqual(mockCharacteristic)
      expect(prismaService.characteristic.findUnique).toHaveBeenCalledWith({
        where: { id: 'char-1' },
        include: expect.any(Object),
      })
    })

    it('should return null if not found', async () => {
      jest.spyOn(prismaService.characteristic, 'findUnique').mockResolvedValue(null)

      const result = await service.findById('non-existent')

      expect(result).toBeNull()
    })
  })

  describe('findByCategoryId', () => {
    it('should return characteristics for category', async () => {
      jest.spyOn(prismaService.category, 'findUnique').mockResolvedValue({ id: 'cat-1' } as any)
      jest
        .spyOn(prismaService.characteristic, 'findMany')
        .mockResolvedValue([mockCharacteristic] as any)

      const result = await service.findByCategoryId('cat-1')

      expect(result).toEqual([mockCharacteristic])
      expect(prismaService.characteristic.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            {
              categories: {
                some: {
                  categoryId: 'cat-1',
                },
              },
            },
            {
              categories: {
                none: {},
              },
            },
          ],
        },
        include: expect.any(Object),
        orderBy: expect.any(Array),
      })
    })

    it('should throw NotFoundException if category not found', async () => {
      jest.spyOn(prismaService.category, 'findUnique').mockResolvedValue(null)

      await expect(service.findByCategoryId('non-existent')).rejects.toThrow(NotFoundException)
    })
  })

  describe('validateCharacteristicValue', () => {
    it('should validate text value', async () => {
      const textCharacteristic = { ...mockCharacteristic, type: CharacteristicType.TEXT }
      jest.spyOn(service, 'findById').mockResolvedValue(textCharacteristic as any)

      const result = await service.validateCharacteristicValue('char-1', {
        textValue: 'Some text',
      })

      expect(result).toEqual({ isValid: true })
    })

    it('should validate number value', async () => {
      const numberCharacteristic = { ...mockCharacteristic, type: CharacteristicType.NUMBER }
      jest.spyOn(service, 'findById').mockResolvedValue(numberCharacteristic as any)

      const result = await service.validateCharacteristicValue('char-1', {
        numberValue: 100,
      })

      expect(result).toEqual({ isValid: true })
    })

    it('should validate boolean value', async () => {
      const booleanCharacteristic = { ...mockCharacteristic, type: CharacteristicType.BOOLEAN }
      jest.spyOn(service, 'findById').mockResolvedValue(booleanCharacteristic as any)

      const result = await service.validateCharacteristicValue('char-1', {
        booleanValue: true,
      })

      expect(result).toEqual({ isValid: true })
    })

    it('should validate select value', async () => {
      jest.spyOn(service, 'findById').mockResolvedValue(mockCharacteristic as any)
      jest
        .spyOn(prismaService.characteristicValue, 'findFirst')
        .mockResolvedValue({ id: 'val-1' } as any)

      const result = await service.validateCharacteristicValue('char-1', {
        selectValueId: 'val-1',
      })

      expect(result).toEqual({ isValid: true })
    })

    it('should return invalid for non-existent select value', async () => {
      jest.spyOn(service, 'findById').mockResolvedValue(mockCharacteristic as any)
      jest.spyOn(prismaService.characteristicValue, 'findFirst').mockResolvedValue(null)

      const result = await service.validateCharacteristicValue('char-1', {
        selectValueId: 'non-existent',
      })

      expect(result.isValid).toBe(false)
      expect(result.message).toContain('Выбранное значение не существует')
    })
  })

  describe('delete', () => {
    it('should delete characteristic successfully', async () => {
      jest.spyOn(service, 'findById').mockResolvedValue(mockCharacteristic as any)
      jest.spyOn(prismaService.productCharacteristic, 'count').mockResolvedValue(0)
      jest
        .spyOn(prismaService.characteristic, 'delete')
        .mockResolvedValue(mockCharacteristic as any)

      await service.delete('char-1')

      expect(prismaService.characteristic.delete).toHaveBeenCalledWith({
        where: { id: 'char-1' },
      })
    })

    it('should throw ConflictException if used in products', async () => {
      jest.spyOn(service, 'findById').mockResolvedValue(mockCharacteristic as any)
      jest.spyOn(prismaService.productCharacteristic, 'count').mockResolvedValue(5)

      await expect(service.delete('char-1')).rejects.toThrow(ConflictException)
    })
  })
})
