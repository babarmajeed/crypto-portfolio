import { PrismaClient } from '@prisma/client'
import { execSync } from 'child_process'

const prisma = new PrismaClient()

beforeAll(async () => {
  // Generate a unique database for testing
  const timestamp = Date.now()
  process.env.DATABASE_URL = `postgresql://postgres:postgres@localhost:5432/crypto_portfolio_test_${timestamp}?schema=public`
  
  // Run database migrations
  execSync('npx prisma migrate deploy', { stdio: 'inherit' })
  
  // Connect to the database
  await prisma.$connect()
})

afterAll(async () => {
  // Clean up
  await prisma.$disconnect()
})

beforeEach(async () => {
  // Clean all tables before each test
  const tablenames = await prisma.$queryRaw<
    Array<{ tablename: string }>
  >`SELECT tablename FROM pg_tables WHERE schemaname='public'`

  const tables = tablenames
    .map(({ tablename }) => tablename)
    .filter((name) => name !== '_prisma_migrations')
    .map((name) => `"public"."${name}"`)
    .join(', ')

  try {
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tables} CASCADE;`)
  } catch (error) {
    console.log({ error })
  }
})