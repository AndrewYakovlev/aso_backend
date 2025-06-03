import { registerAs } from '@nestjs/config'

export default registerAs('jwt', () => ({
  access: {
    secret: process.env.JWT_SECRET || 'default-secret-change-this',
    expiresIn: process.env.JWT_ACCESS_TOKEN_EXPIRATION || '15m',
  },
  refresh: {
    secret: process.env.JWT_REFRESH_TOKEN_SECRET || 'default-refresh-secret-change-this',
    expiresIn: process.env.JWT_REFRESH_TOKEN_EXPIRATION || '90d',
  },
  anonymous: {
    expiresIn: process.env.JWT_ANONYMOUS_TOKEN_EXPIRATION || '365d',
  },
  otp: {
    secret: process.env.OTP_SECRET || 'default-otp-secret',
    expiration: parseInt(process.env.OTP_EXPIRATION || '300', 10),
    length: parseInt(process.env.OTP_LENGTH || '4', 10),
  },
}))
