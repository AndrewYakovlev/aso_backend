// test/health.e2e-spec.ts
import { Test, TestingModule } from '@nestjs/testing'
import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { AppModule } from '../src/app.module'

describe('Health Endpoints (e2e)', () => {
  let app: INestApplication

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()

    app = moduleFixture.createNestApplication()
    await app.init()
  })

  afterAll(async () => {
    await app.close()
  })

  describe('/health (GET)', () => {
    it('should return health check results', () => {
      return request(app.getHttpServer())
        .get('/health')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('status')
          expect(res.body).toHaveProperty('info')
          expect(res.body).toHaveProperty('error')
          expect(res.body).toHaveProperty('details')

          // Проверяем статусы индикаторов
          expect(res.body.info).toHaveProperty('database')
          expect(res.body.info).toHaveProperty('redis')
          expect(res.body.info).toHaveProperty('memory_heap')
          expect(res.body.info).toHaveProperty('memory_rss')
          expect(res.body.info).toHaveProperty('storage')
        })
    })

    it('should handle unhealthy services', async () => {
      // Этот тест полезен для проверки поведения при недоступных сервисах
      // В реальном тесте вы можете замокать сервисы для имитации сбоев
      const response = await request(app.getHttpServer())
        .get('/health')
        .expect((res) => {
          // Даже если некоторые сервисы недоступны,
          // endpoint должен вернуть 200 или 503 в зависимости от настроек
          expect([200, 503]).toContain(res.status)
        })
    })
  })

  describe('/health/liveness (GET)', () => {
    it('should return liveness status', () => {
      return request(app.getHttpServer())
        .get('/health/liveness')
        .expect(200)
        .expect((res) => {
          expect(res.body).toEqual({
            status: 'ok',
            timestamp: expect.any(String),
          })
        })
    })
  })

  describe('/health/readiness (GET)', () => {
    it('should check critical services', () => {
      return request(app.getHttpServer())
        .get('/health/readiness')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('status')
          expect(res.body).toHaveProperty('info')

          // Readiness проверяет только критичные сервисы
          expect(res.body.info).toHaveProperty('database')
          expect(res.body.info).toHaveProperty('redis')
        })
    })
  })
})
