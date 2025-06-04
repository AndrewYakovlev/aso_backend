// src/common/utils/seo.util.ts
export class SeoUtil {
  private static readonly SHOP_NAME = 'Автозапчасти АСО'
  private static readonly CITY = 'Бежецк'

  /**
   * Генерация SEO заголовка для категории
   */
  static generateCategoryMetaTitle(name: string): string {
    return `${name} - купить в интернет-магазине ${this.SHOP_NAME}`
  }

  /**
   * Генерация SEO описания для категории
   */
  static generateCategoryMetaDescription(name: string, description?: string | null): string {
    if (description) {
      const cleanDescription = this.truncate(description, 150)
      return `${cleanDescription} Доставка по Бежецку. Гарантия качества.`
    }
    return `Большой выбор товаров в категории "${name}". Выгодные цены, быстрая доставка по Бежецку. ${this.SHOP_NAME}.`
  }

  /**
   * Генерация SEO ключевых слов для категории
   */
  static generateCategoryMetaKeywords(name: string, parentName?: string | null): string {
    const keywords: string[] = []

    // Добавляем название категории
    keywords.push(name.toLowerCase())

    // Добавляем слова из названия
    const words = name.toLowerCase().split(/\s+/)
    keywords.push(...words.filter((word) => word.length > 3))

    // Добавляем родительскую категорию
    if (parentName) {
      keywords.push(parentName.toLowerCase())
    }

    // Добавляем общие ключевые слова
    keywords.push(`купить ${name.toLowerCase()}`)
    keywords.push(`${name.toLowerCase()} в Бежецке`)
    keywords.push(this.SHOP_NAME.toLowerCase())

    // Убираем дубликаты и соединяем
    return [...new Set(keywords)].join(', ')
  }

  /**
   * Генерация SEO заголовка для товара
   */
  static generateProductMetaTitle(name: string, brandName: string, sku: string): string {
    return `${name} ${sku} - купить в Бежецке | ${this.SHOP_NAME}`
  }

  /**
   * Генерация SEO описания для товара
   */
  static generateProductMetaDescription(
    name: string,
    brandName: string,
    price: number,
    description?: string | null,
  ): string {
    const priceText = `${price.toLocaleString('ru-RU')} ₽`

    if (description) {
      const cleanDescription = this.truncate(description, 100)
      return `${cleanDescription} Цена: ${priceText}. В наличии. Доставка по Бежецку>.`
    }

    return `Купить ${name} ${brandName} по цене ${priceText}. В наличии. Быстрая доставка по Бежецку. Гарантия качества.`
  }

  /**
   * Генерация SEO ключевых слов для товара
   */
  static generateProductMetaKeywords(
    name: string,
    brandName: string,
    sku: string,
    categoryName?: string,
  ): string {
    const keywords: string[] = []

    // Добавляем название товара и бренд
    keywords.push(name.toLowerCase())
    keywords.push(brandName.toLowerCase())
    keywords.push(sku.toLowerCase())

    // Добавляем слова из названия
    const words = name.toLowerCase().split(/\s+/)
    keywords.push(...words.filter((word) => word.length > 3))

    // Добавляем комбинации
    keywords.push(`${brandName.toLowerCase()} ${sku.toLowerCase()}`)
    keywords.push(`купить ${name.toLowerCase()}`)
    keywords.push(`${name.toLowerCase()} в Бежецке`)

    // Добавляем категорию
    if (categoryName) {
      keywords.push(categoryName.toLowerCase())
    }

    // Убираем дубликаты и соединяем
    return [...new Set(keywords)].filter((k) => k.length > 2).join(', ')
  }

  /**
   * Генерация canonical URL для категории
   */
  static generateCategoryCanonicalUrl(slug: string): string {
    return `/catalog/${slug}`
  }

  /**
   * Генерация canonical URL для товара
   */
  static generateProductCanonicalUrl(slug: string): string {
    return `/product/${slug}`
  }

  /**
   * Обрезка текста до указанной длины с сохранением целостности слов
   */
  private static truncate(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text

    const truncated = text.substring(0, maxLength)
    const lastSpaceIndex = truncated.lastIndexOf(' ')

    if (lastSpaceIndex > 0) {
      return truncated.substring(0, lastSpaceIndex) + '...'
    }

    return truncated + '...'
  }

  /**
   * Транслитерация для создания slug
   */
  static transliterate(text: string): string {
    const ru = 'абвгдеёжзийклмнопрстуфхцчшщъыьэюя'
    const en = 'abvgdeejziyklmnoprstufhcchhshh_y_eya'
    const ruRegexp = new RegExp(`[${ru}]`, 'gi')

    let slug = text.toLowerCase()

    // Заменяем русские буквы
    for (let i = 0; i < ru.length; i++) {
      slug = slug.replace(new RegExp(ru[i], 'g'), en[i])
    }

    // Заменяем пробелы и специальные символы
    slug = slug
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')

    return slug
  }

  /**
   * Генерация структурированных данных для категории
   */
  static generateCategoryStructuredData(category: {
    name: string
    description?: string | null
    canonicalUrl: string
    breadcrumbs?: Array<{ name: string; url: string }>
  }): object {
    const structuredData: any[] = []

    // BreadcrumbList
    if (category.breadcrumbs && category.breadcrumbs.length > 0) {
      structuredData.push({
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: category.breadcrumbs.map((crumb, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          name: crumb.name,
          item: crumb.url,
        })),
      })
    }

    // CollectionPage
    structuredData.push({
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: category.name,
      description: category.description,
      url: category.canonicalUrl,
    })

    return structuredData
  }

  /**
   * Генерация структурированных данных для товара
   */
  static generateProductStructuredData(product: {
    name: string
    description?: string | null
    sku: string
    brand: string
    price: number
    inStock: boolean
    images?: string[]
    canonicalUrl: string
  }): object {
    return {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: product.name,
      description: product.description,
      sku: product.sku,
      brand: {
        '@type': 'Brand',
        name: product.brand,
      },
      offers: {
        '@type': 'Offer',
        priceCurrency: 'RUB',
        price: product.price,
        availability: product.inStock
          ? 'https://schema.org/InStock'
          : 'https://schema.org/OutOfStock',
        seller: {
          '@type': 'Organization',
          name: this.SHOP_NAME,
        },
      },
      image: product.images || [],
      url: product.canonicalUrl,
    }
  }
}
