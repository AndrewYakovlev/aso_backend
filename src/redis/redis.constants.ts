// src/redis/redis.constants.ts
export const REDIS_CLIENT = Symbol('REDIS_CLIENT')

export enum CacheKeys {
  PRODUCTS = 'products:',
  PRODUCT = 'product:',
  CATEGORIES = 'categories:',
  CATEGORY = 'category:',
  USER = 'user:',
  SESSION = 'session:',
  OTP = 'otp:',
  CART = 'cart:',
  BRANDS = 'brands:',
  BRAND = 'brand:',
  VEHICLES = 'vehicles:',
  CHARACTERISTICS = 'characteristics:',
}

export const CacheTTL = {
  PRODUCTS: 900, // 15 минут
  PRODUCT: 1800, // 30 минут
  CATEGORIES: 3600, // 1 час
  CATEGORY: 1800, // 30 минут
  BRANDS: 3600, // 1 час
  USER: 300, // 5 минут
  SESSION: 86400, // 24 часа
  OTP: 300, // 5 минут
  CART: 3600, // 1 час
  VEHICLES: 3600, // 1 час
  CHARACTERISTICS: 3600, // 1 час
}
