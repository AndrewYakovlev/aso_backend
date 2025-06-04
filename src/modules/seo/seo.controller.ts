// src/modules/seo/seo.controller.ts
import { Controller, Get, Header, Param } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiResponse, ApiExcludeEndpoint } from '@nestjs/swagger'
import { SeoService } from './seo.service'

@ApiTags('SEO')
@Controller()
export class SeoController {
  constructor(private readonly seoService: SeoService) {}

  @Get('sitemap.xml')
  @Header('Content-Type', 'application/xml')
  @ApiExcludeEndpoint() // Исключаем из Swagger документации
  async getSitemapIndex(): Promise<string> {
    return this.seoService.generateSitemapIndex()
  }

  @Get('sitemap-categories.xml')
  @Header('Content-Type', 'application/xml')
  @ApiExcludeEndpoint()
  async getCategoriesSitemap(): Promise<string> {
    return this.seoService.generateCategoriesSitemap()
  }

  @Get('sitemap-products-:page.xml')
  @Header('Content-Type', 'application/xml')
  @ApiExcludeEndpoint()
  async getProductsSitemap(@Param('page') page: string): Promise<string> {
    const pageNumber = parseInt(page, 10)
    return this.seoService.generateProductsSitemap(pageNumber)
  }

  @Get('sitemap-static.xml')
  @Header('Content-Type', 'application/xml')
  @ApiExcludeEndpoint()
  async getStaticSitemap(): Promise<string> {
    return this.seoService.generateStaticSitemap()
  }

  @Get('robots.txt')
  @Header('Content-Type', 'text/plain')
  @ApiExcludeEndpoint()
  async getRobotsTxt(): Promise<string> {
    return this.seoService.generateRobotsTxt()
  }

  @Get('api/v1/seo/structured-data/category/:slug')
  @ApiOperation({ summary: 'Получить структурированные данные для категории' })
  @ApiResponse({
    status: 200,
    description: 'Структурированные данные категории',
  })
  async getCategoryStructuredData(@Param('slug') slug: string): Promise<object> {
    return this.seoService.getCategoryStructuredData(slug)
  }

  @Get('api/v1/seo/structured-data/product/:slug')
  @ApiOperation({ summary: 'Получить структурированные данные для товара' })
  @ApiResponse({
    status: 200,
    description: 'Структурированные данные товара',
  })
  async getProductStructuredData(@Param('slug') slug: string): Promise<object> {
    return this.seoService.getProductStructuredData(slug)
  }
}
