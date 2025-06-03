// prisma/seed.ts
import { PrismaClient, UserRole, DiscountType } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Starting database seeding...')

  // Создание статусов чатов
  const chatStatuses = await Promise.all([
    prisma.chatStatus.upsert({
      where: { code: 'new' },
      update: {},
      create: {
        name: 'Новый',
        code: 'new',
        color: '#3B82F6',
        sortOrder: 1,
      },
    }),
    prisma.chatStatus.upsert({
      where: { code: 'in_progress' },
      update: {},
      create: {
        name: 'В обработке',
        code: 'in_progress',
        color: '#F59E0B',
        sortOrder: 2,
      },
    }),
    prisma.chatStatus.upsert({
      where: { code: 'waiting_customer' },
      update: {},
      create: {
        name: 'Ожидает ответа клиента',
        code: 'waiting_customer',
        color: '#8B5CF6',
        sortOrder: 3,
      },
    }),
    prisma.chatStatus.upsert({
      where: { code: 'closed' },
      update: {},
      create: {
        name: 'Закрыт',
        code: 'closed',
        color: '#10B981',
        sortOrder: 4,
      },
    }),
  ])

  // Создание статусов заказов
  const orderStatuses = await Promise.all([
    prisma.orderStatus.upsert({
      where: { code: 'pending' },
      update: {},
      create: {
        name: 'Новый',
        code: 'pending',
        color: '#3B82F6',
        description: 'Заказ создан и ожидает обработки',
        isInitial: true,
        canCancelOrder: true,
        sortOrder: 1,
      },
    }),
    prisma.orderStatus.upsert({
      where: { code: 'confirmed' },
      update: {},
      create: {
        name: 'Подтвержден',
        code: 'confirmed',
        color: '#8B5CF6',
        description: 'Заказ подтвержден менеджером',
        canCancelOrder: true,
        sortOrder: 2,
      },
    }),
    prisma.orderStatus.upsert({
      where: { code: 'paid' },
      update: {},
      create: {
        name: 'Оплачен',
        code: 'paid',
        color: '#10B981',
        description: 'Заказ оплачен',
        canCancelOrder: false,
        sortOrder: 3,
      },
    }),
    prisma.orderStatus.upsert({
      where: { code: 'shipping' },
      update: {},
      create: {
        name: 'В доставке',
        code: 'shipping',
        color: '#F59E0B',
        description: 'Заказ передан в службу доставки',
        canCancelOrder: false,
        sortOrder: 4,
      },
    }),
    prisma.orderStatus.upsert({
      where: { code: 'delivered' },
      update: {},
      create: {
        name: 'Доставлен',
        code: 'delivered',
        color: '#10B981',
        description: 'Заказ доставлен покупателю',
        isFinalSuccess: true,
        canCancelOrder: false,
        sortOrder: 5,
      },
    }),
    prisma.orderStatus.upsert({
      where: { code: 'cancelled' },
      update: {},
      create: {
        name: 'Отменен',
        code: 'cancelled',
        color: '#EF4444',
        description: 'Заказ отменен',
        isFinalFailure: true,
        canCancelOrder: false,
        sortOrder: 6,
      },
    }),
  ])

  // Создание методов доставки
  const deliveryMethods = await Promise.all([
    prisma.deliveryMethod.upsert({
      where: { code: 'pickup' },
      update: {},
      create: {
        name: 'Самовывоз',
        code: 'pickup',
        description: 'Самовывоз со склада в г. Бежецк',
        price: 0,
        sortOrder: 1,
      },
    }),
    prisma.deliveryMethod.upsert({
      where: { code: 'delivery' },
      update: {},
      create: {
        name: 'Доставка по городу',
        code: 'delivery',
        description: 'Доставка курьером по г. Бежецк',
        price: 300,
        minAmount: 5000,
        sortOrder: 2,
      },
    }),
    prisma.deliveryMethod.upsert({
      where: { code: 'transport_company' },
      update: {},
      create: {
        name: 'Транспортная компания',
        code: 'transport_company',
        description: 'Доставка транспортной компанией',
        price: 500,
        sortOrder: 3,
        settings: {
          companies: ['СДЭК', 'Деловые линии', 'ПЭК'],
        },
      },
    }),
  ])

  // Создание методов оплаты
  const paymentMethods = await Promise.all([
    prisma.paymentMethod.upsert({
      where: { code: 'cash' },
      update: {},
      create: {
        name: 'Наличными при получении',
        code: 'cash',
        description: 'Оплата наличными курьеру или в пункте выдачи',
        icon: 'cash',
        isOnline: false,
        sortOrder: 1,
      },
    }),
    prisma.paymentMethod.upsert({
      where: { code: 'card_online' },
      update: {},
      create: {
        name: 'Картой онлайн',
        code: 'card_online',
        description: 'Оплата банковской картой на сайте',
        icon: 'card',
        isOnline: true,
        commission: 2.5,
        sortOrder: 2,
        settings: {
          provider: 'sberbank',
        },
      },
    }),
    prisma.paymentMethod.upsert({
      where: { code: 'invoice' },
      update: {},
      create: {
        name: 'Счет для юридических лиц',
        code: 'invoice',
        description: 'Выставление счета для оплаты безналичным расчетом',
        icon: 'invoice',
        isOnline: false,
        sortOrder: 3,
      },
    }),
  ])

  // Создание группы клиентов
  const customerGroups = await Promise.all([
    prisma.customerGroup.create({
      data: {
        name: 'Обычные покупатели',
        discountPercent: 0,
        benefits: {
          description: 'Базовая группа покупателей',
        },
      },
    }),
    prisma.customerGroup.create({
      data: {
        name: 'Постоянные клиенты',
        discountPercent: 5,
        minOrderAmount: 10000,
        benefits: {
          description: 'Скидка 5% на все товары',
          features: ['Персональный менеджер', 'Приоритетная обработка заказов'],
        },
      },
    }),
    prisma.customerGroup.create({
      data: {
        name: 'VIP клиенты',
        discountPercent: 10,
        minOrderAmount: 50000,
        benefits: {
          description: 'Скидка 10% на все товары',
          features: [
            'Персональный менеджер',
            'Приоритетная обработка заказов',
            'Бесплатная доставка',
            'Эксклюзивные предложения',
          ],
        },
      },
    }),
  ])

  // Создание администратора
  const admin = await prisma.user.upsert({
    where: { phone: '+79000000000' },
    update: {},
    create: {
      phone: '+79000000000',
      email: 'admin@autoparts-aso.ru',
      firstName: 'Admin',
      lastName: 'User',
      role: UserRole.ADMIN,
    },
  })

  // Создание тестового менеджера
  const manager = await prisma.user.upsert({
    where: { phone: '+79111111111' },
    update: {},
    create: {
      phone: '+79111111111',
      email: 'manager@autoparts-aso.ru',
      firstName: 'Manager',
      lastName: 'User',
      role: UserRole.MANAGER,
    },
  })

  // Создание правила скидки
  const discountRule = await prisma.discountRule.create({
    data: {
      name: 'Скидка на первый заказ',
      type: DiscountType.PERCENTAGE,
      value: 10,
      minAmount: 3000,
      usageLimit: 1,
      isActive: true,
    },
  })

  // Создание промокода
  const promoCode = await prisma.promoCode.create({
    data: {
      code: 'FIRST10',
      discountRuleId: discountRule.id,
      usageLimit: 100,
      isActive: true,
    },
  })

  console.log('✅ Database seeding completed!')
  console.log({
    chatStatuses: chatStatuses.length,
    orderStatuses: orderStatuses.length,
    deliveryMethods: deliveryMethods.length,
    paymentMethods: paymentMethods.length,
    customerGroups: customerGroups.length,
    admin,
    manager,
    promoCode,
  })
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
