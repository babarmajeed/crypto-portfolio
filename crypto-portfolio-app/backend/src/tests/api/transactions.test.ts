import request from 'supertest';
import { Express } from 'express';
import { PrismaClient } from '@prisma/client';
import { faker } from '@faker-js/faker';
import { createTestApp, generateTestUser, generateTestPortfolio, generateTestTransaction, cleanupTestData } from '../utils/testHelpers';

describe('Transaction API Tests', () => {
  let app: Express;
  let prisma: PrismaClient;
  let authToken: string;
  let testUser: any;
  let testPortfolio: any;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = new PrismaClient();
    
    // Create test user and get auth token
    testUser = await generateTestUser();
    const loginResponse = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: testUser.email,
        password: 'TestPassword123!'
      });
    
    authToken = loginResponse.body.data.token;
    testPortfolio = await generateTestPortfolio(testUser.id);
  });

  afterAll(async () => {
    await cleanupTestData();
    await prisma.$disconnect();
  });

  describe('POST /api/v1/portfolios/:portfolioId/transactions', () => {
    it('should create a new transaction with valid data', async () => {
      const transactionData = {
        type: 'BUY',
        symbol: 'BTC',
        quantity: 0.5,
        price: 45000,
        fee: 25,
        executedAt: new Date().toISOString(),
        notes: 'Initial Bitcoin purchase'
      };

      const response = await request(app)
        .post(`/api/v1/portfolios/${testPortfolio.id}/transactions`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(transactionData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        type: transactionData.type,
        symbol: transactionData.symbol,
        quantity: transactionData.quantity,
        price: transactionData.price,
        fee: transactionData.fee,
        total: (transactionData.quantity * transactionData.price) + transactionData.fee,
        portfolioId: testPortfolio.id,
        notes: transactionData.notes
      });
      expect(response.body.data.id).toBeDefined();
      expect(response.body.data.createdAt).toBeDefined();
    });

    it('should auto-calculate total when not provided', async () => {
      const transactionData = {
        type: 'BUY',
        symbol: 'ETH',
        quantity: 2,
        price: 3000,
        fee: 10,
        executedAt: new Date().toISOString()
      };

      const response = await request(app)
        .post(`/api/v1/portfolios/${testPortfolio.id}/transactions`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(transactionData)
        .expect(201);

      expect(response.body.data.total).toBe(6010); // (2 * 3000) + 10
    });

    it('should validate required transaction fields', async () => {
      const invalidData = {
        type: 'BUY',
        // Missing required fields: symbol, quantity, price
        fee: 10
      };

      const response = await request(app)
        .post(`/api/v1/portfolios/${testPortfolio.id}/transactions`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Validation Error');
      expect(response.body.details).toBeDefined();
    });

    it('should validate transaction type enum', async () => {
      const invalidData = {
        type: 'INVALID_TYPE',
        symbol: 'BTC',
        quantity: 1,
        price: 45000,
        executedAt: new Date().toISOString()
      };

      await request(app)
        .post(`/api/v1/portfolios/${testPortfolio.id}/transactions`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidData)
        .expect(400);
    });

    it('should validate positive numbers for quantity and price', async () => {
      const invalidData = {
        type: 'BUY',
        symbol: 'BTC',
        quantity: -1, // Negative quantity
        price: -45000, // Negative price
        executedAt: new Date().toISOString()
      };

      await request(app)
        .post(`/api/v1/portfolios/${testPortfolio.id}/transactions`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidData)
        .expect(400);
    });

    it('should return 404 for non-existent portfolio', async () => {
      const fakePortfolioId = faker.string.uuid();
      const transactionData = {
        type: 'BUY',
        symbol: 'BTC',
        quantity: 1,
        price: 45000,
        executedAt: new Date().toISOString()
      };

      await request(app)
        .post(`/api/v1/portfolios/${fakePortfolioId}/transactions`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(transactionData)
        .expect(404);
    });

    it('should prevent access to other users\' portfolios', async () => {
      const otherUser = await generateTestUser();
      const otherPortfolio = await generateTestPortfolio(otherUser.id);

      const transactionData = {
        type: 'BUY',
        symbol: 'BTC',
        quantity: 1,
        price: 45000,
        executedAt: new Date().toISOString()
      };

      await request(app)
        .post(`/api/v1/portfolios/${otherPortfolio.id}/transactions`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(transactionData)
        .expect(403);
    });

    it('should handle different asset symbols', async () => {
      const symbols = ['BTC', 'ETH', 'ADA', 'DOT', 'LINK'];

      for (const symbol of symbols) {
        const transactionData = {
          type: 'BUY',
          symbol,
          quantity: 1,
          price: 1000,
          executedAt: new Date().toISOString()
        };

        const response = await request(app)
          .post(`/api/v1/portfolios/${testPortfolio.id}/transactions`)
          .set('Authorization', `Bearer ${authToken}`)
          .send(transactionData)
          .expect(201);

        expect(response.body.data.symbol).toBe(symbol);
      }
    });

    it('should handle different transaction types', async () => {
      const types = ['BUY', 'SELL', 'TRANSFER', 'DIVIDEND'];

      for (const type of types) {
        const transactionData = {
          type,
          symbol: 'BTC',
          quantity: 0.1,
          price: 45000,
          executedAt: new Date().toISOString()
        };

        const response = await request(app)
          .post(`/api/v1/portfolios/${testPortfolio.id}/transactions`)
          .set('Authorization', `Bearer ${authToken}`)
          .send(transactionData)
          .expect(201);

        expect(response.body.data.type).toBe(type);
      }
    });
  });

  describe('GET /api/v1/portfolios/:portfolioId/transactions', () => {
    beforeEach(async () => {
      // Create test transactions
      for (let i = 0; i < 20; i++) {
        await generateTestTransaction(testPortfolio.id);
      }
    });

    it('should return paginated transactions', async () => {
      const response = await request(app)
        .get(`/api/v1/portfolios/${testPortfolio.id}/transactions?page=1&limit=10`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data.length).toBeLessThanOrEqual(10);
      expect(response.body.pagination).toMatchObject({
        page: 1,
        limit: 10,
        total: expect.any(Number),
        pages: expect.any(Number)
      });
    });

    it('should support sorting by different fields', async () => {
      const response = await request(app)
        .get(`/api/v1/portfolios/${testPortfolio.id}/transactions?sort=-executedAt`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      const transactions = response.body.data;
      
      // Check if sorted by executedAt descending
      for (let i = 0; i < transactions.length - 1; i++) {
        const current = new Date(transactions[i].executedAt);
        const next = new Date(transactions[i + 1].executedAt);
        expect(current.getTime()).toBeGreaterThanOrEqual(next.getTime());
      }
    });

    it('should filter transactions by type', async () => {
      const response = await request(app)
        .get(`/api/v1/portfolios/${testPortfolio.id}/transactions?type=BUY`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      response.body.data.forEach((transaction: any) => {
        expect(transaction.type).toBe('BUY');
      });
    });

    it('should filter transactions by symbol', async () => {
      const response = await request(app)
        .get(`/api/v1/portfolios/${testPortfolio.id}/transactions?symbol=BTC`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      response.body.data.forEach((transaction: any) => {
        expect(transaction.symbol).toBe('BTC');
      });
    });

    it('should filter transactions by date range', async () => {
      const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days ago
      const endDate = new Date().toISOString();

      const response = await request(app)
        .get(`/api/v1/portfolios/${testPortfolio.id}/transactions?startDate=${startDate}&endDate=${endDate}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      response.body.data.forEach((transaction: any) => {
        const executedDate = new Date(transaction.executedAt);
        expect(executedDate.getTime()).toBeGreaterThanOrEqual(new Date(startDate).getTime());
        expect(executedDate.getTime()).toBeLessThanOrEqual(new Date(endDate).getTime());
      });
    });

    it('should return empty array when portfolio has no transactions', async () => {
      const emptyPortfolio = await generateTestPortfolio(testUser.id);

      const response = await request(app)
        .get(`/api/v1/portfolios/${emptyPortfolio.id}/transactions`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual([]);
      expect(response.body.pagination.total).toBe(0);
    });
  });

  describe('GET /api/v1/portfolios/:portfolioId/transactions/:id', () => {
    let testTransaction: any;

    beforeEach(async () => {
      testTransaction = await generateTestTransaction(testPortfolio.id);
    });

    it('should return transaction details for valid ID', async () => {
      const response = await request(app)
        .get(`/api/v1/portfolios/${testPortfolio.id}/transactions/${testTransaction.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        id: testTransaction.id,
        portfolioId: testPortfolio.id,
        type: testTransaction.type,
        symbol: testTransaction.symbol
      });
    });

    it('should return 404 for non-existent transaction', async () => {
      const fakeId = faker.string.uuid();
      
      await request(app)
        .get(`/api/v1/portfolios/${testPortfolio.id}/transactions/${fakeId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should return 400 for invalid UUID format', async () => {
      await request(app)
        .get(`/api/v1/portfolios/${testPortfolio.id}/transactions/invalid-uuid`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);
    });
  });

  describe('PUT /api/v1/portfolios/:portfolioId/transactions/:id', () => {
    let testTransaction: any;

    beforeEach(async () => {
      testTransaction = await generateTestTransaction(testPortfolio.id);
    });

    it('should update transaction with valid data', async () => {
      const updateData = {
        quantity: 2.0,
        price: 50000,
        fee: 30,
        notes: 'Updated transaction notes'
      };

      const response = await request(app)
        .put(`/api/v1/portfolios/${testPortfolio.id}/transactions/${testTransaction.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        id: testTransaction.id,
        quantity: updateData.quantity,
        price: updateData.price,
        fee: updateData.fee,
        notes: updateData.notes,
        total: (updateData.quantity * updateData.price) + updateData.fee
      });
      expect(response.body.data.updatedAt).not.toBe(testTransaction.updatedAt);
    });

    it('should allow partial updates', async () => {
      const updateData = {
        notes: 'Only notes updated'
      };

      const response = await request(app)
        .put(`/api/v1/portfolios/${testPortfolio.id}/transactions/${testTransaction.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.notes).toBe(updateData.notes);
      expect(response.body.data.quantity).toBe(testTransaction.quantity);
    });

    it('should recalculate total when quantity or price changes', async () => {
      const updateData = {
        quantity: 3.0,
        price: 60000
      };

      const response = await request(app)
        .put(`/api/v1/portfolios/${testPortfolio.id}/transactions/${testTransaction.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      const expectedTotal = (updateData.quantity * updateData.price) + (testTransaction.fee || 0);
      expect(response.body.data.total).toBe(expectedTotal);
    });

    it('should return 404 for non-existent transaction', async () => {
      const fakeId = faker.string.uuid();
      
      await request(app)
        .put(`/api/v1/portfolios/${testPortfolio.id}/transactions/${fakeId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ notes: 'Updated notes' })
        .expect(404);
    });

    it('should validate update data', async () => {
      const invalidData = {
        quantity: -1, // Negative quantity
        price: 'invalid' // Non-numeric price
      };

      await request(app)
        .put(`/api/v1/portfolios/${testPortfolio.id}/transactions/${testTransaction.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidData)
        .expect(400);
    });
  });

  describe('DELETE /api/v1/portfolios/:portfolioId/transactions/:id', () => {
    let testTransaction: any;

    beforeEach(async () => {
      testTransaction = await generateTestTransaction(testPortfolio.id);
    });

    it('should delete transaction successfully', async () => {
      await request(app)
        .delete(`/api/v1/portfolios/${testPortfolio.id}/transactions/${testTransaction.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(204);

      // Verify transaction is deleted
      await request(app)
        .get(`/api/v1/portfolios/${testPortfolio.id}/transactions/${testTransaction.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should return 404 for non-existent transaction', async () => {
      const fakeId = faker.string.uuid();
      
      await request(app)
        .delete(`/api/v1/portfolios/${testPortfolio.id}/transactions/${fakeId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });

  describe('Bulk Operations', () => {
    describe('POST /api/v1/portfolios/:portfolioId/transactions/bulk', () => {
      it('should create multiple transactions', async () => {
        const transactions = [
          {
            type: 'BUY',
            symbol: 'BTC',
            quantity: 0.5,
            price: 45000,
            executedAt: new Date().toISOString()
          },
          {
            type: 'BUY',
            symbol: 'ETH',
            quantity: 2,
            price: 3000,
            executedAt: new Date().toISOString()
          },
          {
            type: 'BUY',
            symbol: 'ADA',
            quantity: 1000,
            price: 0.5,
            executedAt: new Date().toISOString()
          }
        ];

        const response = await request(app)
          .post(`/api/v1/portfolios/${testPortfolio.id}/transactions/bulk`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ transactions })
          .expect(201);

        expect(response.body.success).toBe(true);
        expect(response.body.data.created).toBe(3);
        expect(response.body.data.failed).toBe(0);
        expect(response.body.data.transactions).toHaveLength(3);
      });

      it('should handle partial failures in bulk creation', async () => {
        const transactions = [
          {
            type: 'BUY',
            symbol: 'BTC',
            quantity: 0.5,
            price: 45000,
            executedAt: new Date().toISOString()
          },
          {
            type: 'INVALID_TYPE', // This should fail
            symbol: 'ETH',
            quantity: 2,
            price: 3000,
            executedAt: new Date().toISOString()
          }
        ];

        const response = await request(app)
          .post(`/api/v1/portfolios/${testPortfolio.id}/transactions/bulk`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ transactions })
          .expect(207); // Multi-status

        expect(response.body.data.created).toBe(1);
        expect(response.body.data.failed).toBe(1);
        expect(response.body.data.errors).toHaveLength(1);
      });

      it('should limit bulk operation size', async () => {
        const transactions = Array.from({ length: 1001 }, (_, i) => ({
          type: 'BUY',
          symbol: 'BTC',
          quantity: 0.1,
          price: 45000,
          executedAt: new Date().toISOString()
        }));

        await request(app)
          .post(`/api/v1/portfolios/${testPortfolio.id}/transactions/bulk`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ transactions })
          .expect(400);
      });
    });
  });

  describe('Transaction Analytics', () => {
    beforeEach(async () => {
      // Create transactions with different symbols and types
      const transactions = [
        { type: 'BUY', symbol: 'BTC', quantity: 1, price: 40000 },
        { type: 'BUY', symbol: 'BTC', quantity: 0.5, price: 50000 },
        { type: 'SELL', symbol: 'BTC', quantity: 0.3, price: 55000 },
        { type: 'BUY', symbol: 'ETH', quantity: 10, price: 2500 },
        { type: 'BUY', symbol: 'ETH', quantity: 5, price: 3000 }
      ];

      for (const tx of transactions) {
        await generateTestTransaction(testPortfolio.id, tx);
      }
    });

    describe('GET /api/v1/portfolios/:portfolioId/transactions/analytics', () => {
      it('should return transaction analytics', async () => {
        const response = await request(app)
          .get(`/api/v1/portfolios/${testPortfolio.id}/transactions/analytics`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toMatchObject({
          totalTransactions: expect.any(Number),
          totalVolume: expect.any(Number),
          totalFees: expect.any(Number),
          byType: expect.any(Object),
          bySymbol: expect.any(Object),
          averageTransactionSize: expect.any(Number)
        });
      });

      it('should filter analytics by date range', async () => {
        const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const endDate = new Date().toISOString();

        const response = await request(app)
          .get(`/api/v1/portfolios/${testPortfolio.id}/transactions/analytics?startDate=${startDate}&endDate=${endDate}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.dateRange).toMatchObject({
          startDate,
          endDate
        });
      });
    });
  });

  describe('Import/Export', () => {
    describe('POST /api/v1/portfolios/:portfolioId/transactions/import', () => {
      it('should import transactions from CSV format', async () => {
        const csvData = `type,symbol,quantity,price,fee,executedAt,notes
BUY,BTC,0.5,45000,25,2024-01-15T10:00:00Z,First purchase
BUY,ETH,2,3000,15,2024-01-15T10:30:00Z,Second purchase
SELL,BTC,0.1,50000,20,2024-01-15T11:00:00Z,Partial sale`;

        const response = await request(app)
          .post(`/api/v1/portfolios/${testPortfolio.id}/transactions/import`)
          .set('Authorization', `Bearer ${authToken}`)
          .set('Content-Type', 'text/csv')
          .send(csvData)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.imported).toBe(3);
        expect(response.body.data.failed).toBe(0);
      });

      it('should validate CSV headers', async () => {
        const invalidCsv = `invalid,headers,here
BUY,BTC,0.5`;

        await request(app)
          .post(`/api/v1/portfolios/${testPortfolio.id}/transactions/import`)
          .set('Authorization', `Bearer ${authToken}`)
          .set('Content-Type', 'text/csv')
          .send(invalidCsv)
          .expect(400);
      });
    });

    describe('GET /api/v1/portfolios/:portfolioId/transactions/export', () => {
      it('should export transactions in CSV format', async () => {
        const response = await request(app)
          .get(`/api/v1/portfolios/${testPortfolio.id}/transactions/export?format=csv`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.headers['content-type']).toContain('text/csv');
        expect(response.headers['content-disposition']).toContain('attachment');
        expect(response.text).toContain('type,symbol,quantity,price');
      });

      it('should export transactions in JSON format', async () => {
        const response = await request(app)
          .get(`/api/v1/portfolios/${testPortfolio.id}/transactions/export?format=json`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.headers['content-type']).toContain('application/json');
        expect(response.body.data).toBeInstanceOf(Array);
      });
    });
  });

  describe('Performance and Validation', () => {
    it('should handle large transaction lists efficiently', async () => {
      // Create many transactions
      const promises = Array.from({ length: 100 }, () =>
        generateTestTransaction(testPortfolio.id)
      );
      await Promise.all(promises);

      const startTime = Date.now();
      const response = await request(app)
        .get(`/api/v1/portfolios/${testPortfolio.id}/transactions?limit=100`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const responseTime = Date.now() - startTime;
      expect(responseTime).toBeLessThan(1000); // 1 second limit
      expect(response.body.data.length).toBeLessThanOrEqual(100);
    });

    it('should sanitize transaction data', async () => {
      const maliciousData = {
        type: 'BUY',
        symbol: 'BTC',
        quantity: 1,
        price: 45000,
        notes: '<script>alert("xss")</script>Malicious note',
        executedAt: new Date().toISOString()
      };

      const response = await request(app)
        .post(`/api/v1/portfolios/${testPortfolio.id}/transactions`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(maliciousData)
        .expect(201);

      expect(response.body.data.notes).not.toContain('<script>');
    });

    it('should handle concurrent transaction operations', async () => {
      const promises = Array.from({ length: 10 }, (_, i) =>
        request(app)
          .post(`/api/v1/portfolios/${testPortfolio.id}/transactions`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            type: 'BUY',
            symbol: 'BTC',
            quantity: 0.1,
            price: 45000 + i * 100,
            executedAt: new Date().toISOString()
          })
      );

      const responses = await Promise.all(promises);
      
      responses.forEach(response => {
        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
      });

      // Verify all transactions were created with unique IDs
      const transactionIds = responses.map(r => r.body.data.id);
      const uniqueIds = new Set(transactionIds);
      expect(uniqueIds.size).toBe(transactionIds.length);
    });
  });
});