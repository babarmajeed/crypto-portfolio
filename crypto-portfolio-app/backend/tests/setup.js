"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const child_process_1 = require("child_process");
const prisma = new client_1.PrismaClient();
beforeAll(async () => {
    const timestamp = Date.now();
    process.env.DATABASE_URL = `postgresql://postgres:postgres@localhost:5432/crypto_portfolio_test_${timestamp}?schema=public`;
    (0, child_process_1.execSync)('npx prisma migrate deploy', { stdio: 'inherit' });
    await prisma.$connect();
});
afterAll(async () => {
    await prisma.$disconnect();
});
beforeEach(async () => {
    const tablenames = await prisma.$queryRaw `SELECT tablename FROM pg_tables WHERE schemaname='public'`;
    const tables = tablenames
        .map(({ tablename }) => tablename)
        .filter((name) => name !== '_prisma_migrations')
        .map((name) => `"public"."${name}"`)
        .join(', ');
    try {
        await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tables} CASCADE;`);
    }
    catch (error) {
        console.log({ error });
    }
});
//# sourceMappingURL=setup.js.map