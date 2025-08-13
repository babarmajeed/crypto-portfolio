import dotenv from 'dotenv'
import { z } from 'zod'

dotenv.config()

const configSchema = z.object({
  nodeEnv: z.enum(['development', 'production', 'test']).default('development'),
  port: z.coerce.number().default(3001),
  cors: z.object({
    origin: z.string().or(z.array(z.string())).default('http://localhost:3000'),
  }),
  database: z.object({
    url: z.string().min(1, 'Database URL is required'),
  }),
  redis: z.object({
    url: z.string().default('redis://localhost:6379'),
    host: z.string().default('localhost'),
    port: z.coerce.number().default(6379),
    password: z.string().optional(),
  }),
  jwt: z.object({
    secret: z.string().min(32, 'JWT secret must be at least 32 characters'),
    expiresIn: z.string().default('7d'),
  }),
  bcrypt: z.object({
    saltRounds: z.coerce.number().default(12),
  }),
  api: z.object({
    coingecko: z.object({
      baseUrl: z.string().default('https://api.coingecko.com/api/v3'),
      apiKey: z.string().optional(),
    }),
  }),
  rateLimit: z.object({
    windowMs: z.coerce.number().default(15 * 60 * 1000), // 15 minutes
    max: z.coerce.number().default(100), // requests per window
    enabled: z.boolean().default(true),
    whitelist: z.string().optional(),
  }),
})

const rawConfig = {
  nodeEnv: process.env.NODE_ENV,
  port: process.env.PORT,
  cors: {
    origin: process.env.CORS_ORIGIN?.split(',') || process.env.CORS_ORIGIN,
  },
  database: {
    url: process.env.DATABASE_URL,
  },
  redis: {
    url: process.env.REDIS_URL,
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT,
    password: process.env.REDIS_PASSWORD,
  },
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN,
  },
  bcrypt: {
    saltRounds: process.env.BCRYPT_SALT_ROUNDS,
  },
  api: {
    coingecko: {
      baseUrl: process.env.COINGECKO_API_URL,
      apiKey: process.env.COINGECKO_API_KEY,
    },
  },
  rateLimit: {
    windowMs: process.env.RATE_LIMIT_WINDOW_MS,
    max: process.env.RATE_LIMIT_MAX,
    enabled: process.env.RATE_LIMIT_ENABLED,
    whitelist: process.env.RATE_LIMIT_WHITELIST,
  },
}

export const config = configSchema.parse(rawConfig)