// src/redis/redis.constants.ts
export const REDIS_CLIENT = Symbol('REDIS_CLIENT')

export const CacheKeys = {
  // Пользователи и сессии
  USER: 'user:',
  SESSION: 'session:',
  OTP: 'otp:',

  // Каталог
  CATEGORY: 'category:',
  CATEGORIES: 'categories:',
  PRODUCT: 'product:',
  PRODUCTS: 'products:',
  BRAND: 'brand:',
  BRANDS: 'brands:',

  // Характеристики
  CHARACTERISTICS: 'characteristics:',

  // Корзина и заказы
  CART: 'cart:',
  ORDER: 'order:',

  // Чат
  CHAT: 'chat:',
  CHAT_TYPING: 'chat:typing:',

  // Избранное и история
  FAVORITES: 'favorites:',
  HISTORY: 'history:',

  // SEO
  SEO: 'seo:',
} as const

export const CacheTTL = {
  // Короткоживущие (минуты)
  USER: 5 * 60, // 5 минут
  SESSION: 24 * 60 * 60, // 24 часа
  OTP: 5 * 60, // 5 минут

  // Среднеживущие (часы)
  PRODUCT: 60 * 60, // 1 час
  PRODUCTS: 30 * 60, // 30 минут
  CATEGORY: 60 * 60, // 1 час
  CATEGORIES: 60 * 60, // 1 час
  BRANDS: 2 * 60 * 60, // 2 часа
  CHARACTERISTICS: 60 * 60, // 1 час

  // Долгоживущие (дни)
  SEO_SITEMAP: 24 * 60 * 60, // 24 часа

  // Пользовательские данные
  CART: 7 * 24 * 60 * 60, // 7 дней
  FAVORITES: 30 * 24 * 60 * 60, // 30 дней
  HISTORY: 7 * 24 * 60 * 60, // 7 дней

  // Чат
  CHAT_TYPING: 5, // 5 секунд
  CHAT_MESSAGE: 60 * 60, // 1 час
} as const

export type CacheKey = (typeof CacheKeys)[keyof typeof CacheKeys]
export type CacheTTLValue = (typeof CacheTTL)[keyof typeof CacheTTL]
