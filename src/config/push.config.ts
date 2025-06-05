// src/config/push.config.ts
import { registerAs } from '@nestjs/config'

export default registerAs('push', () => ({
  vapidPublicKey: process.env.VAPID_PUBLIC_KEY,
  vapidPrivateKey: process.env.VAPID_PRIVATE_KEY,
  vapidEmail: process.env.VAPID_EMAIL || 'mailto:admin@example.com',
}))
