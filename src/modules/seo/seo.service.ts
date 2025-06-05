// src/modules/seo/seo.service.ts
import { Injectable, NotFoundException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PrismaService } from '../../prisma/prisma.service'
import { CategoriesService } from '../categories/categories.service'
import { ProductsService } from '../products/products.service'
import { SeoUtil } from '@common/utils/seo.util'
import { Cacheable } from '@common/decorators/cacheable.decorator'
import { CacheKeys, CacheTTL } from '../../redis/redis.constants'

@Injectable()
export class SeoService {
  private readonly baseUrl: string
  private readonly productsPerSitemap = 5000

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly categoriesService: CategoriesService,
    private readonly productsService: ProductsService,
  ) {
    this.baseUrl = this.configService.get<string>('BASE_URL', 'https://autoparts-aso.ru')
  }

  /**
   * Генерация основного sitemap (индекс)
   */
  @Cacheable({
    key: () => `${CacheKeys.SEO}sitemap:index`,
    ttl: CacheTTL.SEO_SITEMAP,
  })
  async generateSitemapIndex(): Promise<string> {
    const totalProducts = await this.prisma.product.count({
      where: { deletedAt: null, isActive: true },
    })

    const productSitemapCount = Math.ceil(totalProducts / this.productsPerSitemap)

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
    xml += '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'

    // Статические страницы
    xml += this.generateSitemapEntry('sitemap-static.xml')

    // Категории
    xml += this.generateSitemapEntry('sitemap-categories.xml')

    // Товары (разбиты на части)
    for (let i = 1; i <= productSitemapCount; i++) {
      xml += this.generateSitemapEntry(`sitemap-products-${i}.xml`)
    }

    xml += '</sitemapindex>'

    return xml
  }

  /**
   * Генерация sitemap для статических страниц
   */
  @Cacheable({
    key: () => `${CacheKeys.SEO}sitemap:static`,
    ttl: CacheTTL.SEO_SITEMAP,
  })
  async generateStaticSitemap(): Promise<string> {
    const staticPages = [
      { loc: '/', changefreq: 'daily', priority: '1.0' },
      { loc: '/catalog', changefreq: 'daily', priority: '0.9' },
      { loc: '/about', changefreq: 'monthly', priority: '0.5' },
      { loc: '/contacts', changefreq: 'monthly', priority: '0.5' },
      { loc: '/delivery', changefreq: 'monthly', priority: '0.5' },
      { loc: '/payment', changefreq: 'monthly', priority: '0.5' },
      { loc: '/warranty', changefreq: 'monthly', priority: '0.5' },
    ]

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'

    for (const page of staticPages) {
      xml += '<url>\n'
      xml += `<loc>${this.baseUrl}${page.loc}</loc>\n`
      xml += `<changefreq>${page.changefreq}</changefreq>\n`
      xml += `<priority>${page.priority}</priority>\n`
      xml += '</url>\n'
    }

    xml += '</urlset>'

    return xml
  }

  /**
   * Генерация sitemap для категорий
   */
  @Cacheable({
    key: () => `${CacheKeys.SEO}sitemap:categories`,
    ttl: CacheTTL.SEO_SITEMAP,
  })
  async generateCategoriesSitemap(): Promise<string> {
    const categories = await this.prisma.category.findMany({
      where: { deletedAt: null, isActive: true },
      select: {
        slug: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: 'desc' },
    })

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'

    for (const category of categories) {
      xml += '<url>\n'
      xml += `<loc>${this.baseUrl}/catalog/${category.slug}</loc>\n`
      xml += `<lastmod>${category.updatedAt.toISOString().split('T')[0]}</lastmod>\n`
      xml += '<changefreq>weekly</changefreq>\n'
      xml += '<priority>0.8</priority>\n'
      xml += '</url>\n'
    }

    xml += '</urlset>'

    return xml
  }

  /**
   * Генерация sitemap для товаров (с пагинацией)
   */
  @Cacheable({
    key: (page: number) => `${CacheKeys.SEO}sitemap:products:${page}`,
    ttl: CacheTTL.SEO_SITEMAP,
  })
  async generateProductsSitemap(page: number): Promise<string> {
    const skip = (page - 1) * this.productsPerSitemap

    const products = await this.prisma.product.findMany({
      where: { deletedAt: null, isActive: true },
      select: {
        slug: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: 'desc' },
      skip,
      take: this.productsPerSitemap,
    })

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'

    for (const product of products) {
      xml += '<url>\n'
      xml += `<loc>${this.baseUrl}/product/${product.slug}</loc>\n`
      xml += `<lastmod>${product.updatedAt.toISOString().split('T')[0]}</lastmod>\n`
      xml += '<changefreq>weekly</changefreq>\n'
      xml += '<priority>0.7</priority>\n'
      xml += '</url>\n'
    }

    xml += '</urlset>'

    return xml
  }

  /**
   * Генерация robots.txt
   */
  generateRobotsTxt(): string {
    const content = `# Robots.txt for ${this.baseUrl}
User-agent: *
Allow: /
Disallow: /api/
Disallow: /admin/
Disallow: /cart
Disallow: /checkout
Disallow: /profile
Disallow: /*.json$
Disallow: /*?*sort=
Disallow: /*?*filter=
Disallow: /*?*page=

# Sitemap
Sitemap: ${this.baseUrl}/sitemap.xml

# Crawl-delay
Crawl-delay: 1

# Yandex
User-agent: Yandex
Allow: /
Disallow: /api/
Disallow: /admin/
Clean-param: utm_source&utm_medium&utm_campaign&utm_term&utm_content&yclid&gclid&fbclid
Host: ${this.baseUrl.replace(/^https?:\/\//, '')}
`

    return content
  }

  /**
   * Получение структурированных данных для категории
   */
  async getCategoryStructuredData(slug: string): Promise<object> {
    const category = await this.categoriesService.findBySlug(slug)
    if (!category) {
      throw new NotFoundException('Категория не найдена')
    }

    const breadcrumbs = await this.categoriesService.getCategoryPath(category.id)
    const canonicalUrl = `${this.baseUrl}${SeoUtil.generateCategoryCanonicalUrl(slug)}`

    return SeoUtil.generateCategoryStructuredData({
      name: category.name,
      description: category.description,
      canonicalUrl,
      breadcrumbs: breadcrumbs.map((crumb) => ({
        name: crumb.name,
        url: `${this.baseUrl}/catalog/${crumb.slug}`,
      })),
    })
  }

  /**
   * Получение структурированных данных для товара
   */
  async getProductStructuredData(slug: string): Promise<object> {
    const product = await this.productsService.findBySlug(slug)
    if (!product) {
      throw new NotFoundException('Товар не найден')
    }

    const canonicalUrl = `${this.baseUrl}${SeoUtil.generateProductCanonicalUrl(slug)}`

    return SeoUtil.generateProductStructuredData({
      name: product.name,
      description: product.description,
      sku: product.sku,
      brand: product.brand.name,
      price: Number(product.price),
      inStock: product.stock > 0,
      images: product.images.map((img) => img.url),
      canonicalUrl,
    })
  }

  /**
   * Вспомогательный метод для генерации записи в sitemap index
   */
  private generateSitemapEntry(filename: string): string {
    const lastmod = new Date().toISOString().split('T')[0]
    return `  <sitemap>
    <loc>${this.baseUrl}/${filename}</loc>
    <lastmod>${lastmod}</lastmod>
  </sitemap>\n`
  }

  /**
   * Генерация sitemap для автомобилей
   */
  @Cacheable({
    key: () => `${CacheKeys.SEO}sitemap:vehicles`,
    ttl: CacheTTL.SEO_SITEMAP,
  })
  async generateVehiclesSitemap(): Promise<string> {
    const [makes, models, generations] = await Promise.all([
      this.prisma.vehicleMake.findMany({
        where: {},
        select: {
          slug: true,
        },
      }),
      this.prisma.vehicleModel.findMany({
        where: {},
        select: {
          slug: true,
          make: {
            select: {
              slug: true,
            },
          },
        },
      }),
      this.prisma.vehicleGeneration.findMany({
        where: {},
        select: {
          slug: true,
          model: {
            select: {
              slug: true,
              make: {
                select: {
                  slug: true,
                },
              },
            },
          },
        },
      }),
    ])

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'

    // Марки
    for (const make of makes) {
      xml += '<url>\n'
      xml += `<loc>${this.baseUrl}/vehicles/makes/${make.slug}</loc>\n`
      xml += '<changefreq>weekly</changefreq>\n'
      xml += '<priority>0.8</priority>\n'
      xml += '</url>\n'
    }

    // Модели
    for (const model of models) {
      xml += '<url>\n'
      xml += `<loc>${this.baseUrl}/vehicles/makes/${model.make.slug}/models/${model.slug}</loc>\n`
      xml += '<changefreq>weekly</changefreq>\n'
      xml += '<priority>0.7</priority>\n'
      xml += '</url>\n'
    }

    // Поколения
    for (const generation of generations) {
      xml += '<url>\n'
      xml += `<loc>${this.baseUrl}/vehicles/makes/${generation.model.make.slug}/models/${generation.model.slug}/generations/${generation.slug}</loc>\n`
      xml += '<changefreq>monthly</changefreq>\n'
      xml += '<priority>0.6</priority>\n'
      xml += '</url>\n'
    }

    xml += '</urlset>'

    return xml
  }
}
