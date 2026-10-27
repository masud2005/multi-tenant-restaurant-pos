export const RATE_LIMIT = {
  GLOBAL: {
    name: 'default',
    ttl: 60_000,
    limit: 100,
  },
  AUTH: {
    name: 'auth',
    ttl: 15 * 60_000,
    limit: 10,
  },
  REGISTER: {
    name: 'register',
    ttl: 15 * 60_000,
    limit: 10,
  },
  REFRESH_TOKEN: {
    name: 'refresh-token',
    ttl: 15 * 60_000,
    limit: 10,
  },
  LOGIN: {
    name: 'login',
    ttl: 15 * 60_000,
    limit: process.env.NODE_ENV === 'production' ? 5 : 500,
  },
  OTP: {
    name: 'otp',
    ttl: 10 * 60_000,
    limit: 3,
  },
  OTP_RESEND: {
    name: 'otp-resend',
    ttl: 60_000,
    limit: 1,
  },
  PASSWORD_RESET: {
    name: 'password-reset',
    ttl: 60 * 60_000,
    limit: 3,
  },
} as const;
