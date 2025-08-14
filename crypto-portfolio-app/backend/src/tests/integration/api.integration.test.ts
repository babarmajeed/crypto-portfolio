import request from 'supertest';
import { Express } from 'express';
import { PrismaClient } from '@prisma/client';
import { faker } from '@faker-js/faker';
import { createTestApp, generateTestUser, cleanupTestData } from '../utils/testHelpers';

describe('API Integration Tests', () => {
  let app: Express;
  let prisma: PrismaClient;
  let authToken: string;
  let testUser: any;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = new PrismaClient();
  });

  afterAll(async () => {
    await cleanupTestData();
    await prisma.$disconnect();
  });

  describe('End-to-End User Journey', () => {
    it('should complete a full user registration and portfolio management flow', async () => {
      // 1. User Registration
      const userData = {
        email: faker.internet.email(),
        password: 'SecurePassword123!',
        firstName: faker.person.firstName(),
        lastName: faker.person.lastName()
      };

      const registerResponse = await request(app)
        .post('/api/v1/auth/register')
        .send(userData)
        .expect(201);

      expect(registerResponse.body.success).toBe(true);
      expect(registerResponse.body.data.user.email).toBe(userData.email);
      expect(registerResponse.body.data.token).toBeDefined();

      const token = registerResponse.body.data.token;
      const userId = registerResponse.body.data.user.id;

      // 2. User Profile Update
      const profileUpdateData = {
        preferences: {
          currency: 'EUR',
          timezone: 'Europe/London',
          notifications: {
            email: true,
            push: false,
            sms: false
          }
        }
      };

      const profileResponse = await request(app)
        .put('/api/v1/users/profile')
        .set('Authorization', `Bearer ${token}`)
        .send(profileUpdateData)
        .expect(200);

      expect(profileResponse.body.data.preferences.currency).toBe('EUR');

      // 3. Portfolio Creation
      const portfolioData = {
        name: 'My Crypto Portfolio',
        description: 'Main investment portfolio',
        type: 'MANUAL',
        isDefault: true
      };

      const portfolioResponse = await request(app)
        .post('/api/v1/portfolios')
        .set('Authorization', `Bearer ${token}`)
        .send(portfolioData)
        .expect(201);

      expect(portfolioResponse.body.success).toBe(true);
      expect(portfolioResponse.body.data.name).toBe(portfolioData.name);
      expect(portfolioResponse.body.data.userId).toBe(userId);

      const portfolioId = portfolioResponse.body.data.id;

      // 4. Transaction Creation
      const transactions = [
        {
          type: 'BUY',
          symbol: 'BTC',
          quantity: 0.5,
          price: 45000,
          fee: 25,
          executedAt: new Date().toISOString(),
          notes: 'Initial Bitcoin purchase'
        },
        {
          type: 'BUY',
          symbol: 'ETH',
          quantity: 2,
          price: 3000,
          fee: 15,
          executedAt: new Date().toISOString(),
          notes: 'Ethereum investment'
        }
      ];

      for (const transaction of transactions) {
        const transactionResponse = await request(app)
          .post(`/api/v1/portfolios/${portfolioId}/transactions`)
          .set('Authorization', `Bearer ${token}`)
          .send(transaction)
          .expect(201);

        expect(transactionResponse.body.success).toBe(true);
        expect(transactionResponse.body.data.symbol).toBe(transaction.symbol);
      }

      // 5. Portfolio Retrieval with Transactions
      const portfolioDetailsResponse = await request(app)
        .get(`/api/v1/portfolios/${portfolioId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(portfolioDetailsResponse.body.success).toBe(true);
      expect(portfolioDetailsResponse.body.data.id).toBe(portfolioId);

      // 6. Transaction List Retrieval
      const transactionsResponse = await request(app)
        .get(`/api/v1/portfolios/${portfolioId}/transactions`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(transactionsResponse.body.success).toBe(true);
      expect(transactionsResponse.body.data.length).toBe(2);

      // 7. Portfolio Performance
      const performanceResponse = await request(app)
        .get(`/api/v1/portfolios/${portfolioId}/performance`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(performanceResponse.body.success).toBe(true);
      expect(performanceResponse.body.data.totalValue).toBeDefined();

      // 8. User Statistics
      const statsResponse = await request(app)
        .get('/api/v1/users/statistics')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(statsResponse.body.success).toBe(true);
      expect(statsResponse.body.data.portfolios.total).toBeGreaterThan(0);
      expect(statsResponse.body.data.transactions.total).toBeGreaterThan(0);
    });

    it('should handle user session management flow', async () => {
      // 1. User Login
      testUser = await generateTestUser();
      const loginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testUser.email,
          password: 'TestPassword123!'
        })
        .expect(200);

      const token = loginResponse.body.data.token;
      const refreshToken = loginResponse.body.data.refreshToken;

      // 2. Access Protected Resource
      await request(app)
        .get('/api/v1/users/profile')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      // 3. Token Refresh
      const refreshResponse = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      expect(refreshResponse.body.data.token).toBeDefined();
      expect(refreshResponse.body.data.refreshToken).toBeDefined();

      const newToken = refreshResponse.body.data.token;

      // 4. Use New Token
      await request(app)
        .get('/api/v1/users/profile')
        .set('Authorization', `Bearer ${newToken}`)
        .expect(200);

      // 5. Logout
      await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${newToken}`)
        .send({ refreshToken: refreshResponse.body.data.refreshToken })
        .expect(200);

      // 6. Verify Token Invalidation
      await request(app)
        .get('/api/v1/users/profile')
        .set('Authorization', `Bearer ${newToken}`)
        .expect(401);
    });
  });

  describe('Cross-Service Integration', () => {
    beforeEach(async () => {
      testUser = await generateTestUser();
      const loginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testUser.email,
          password: 'TestPassword123!'
        });
      authToken = loginResponse.body.data.token;
    });

    it('should maintain data consistency across portfolio and transaction operations', async () => {
      // Create portfolio
      const portfolioResponse = await request(app)
        .post('/api/v1/portfolios')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Integration Test Portfolio',
          type: 'MANUAL'
        });

      const portfolioId = portfolioResponse.body.data.id;

      // Add multiple transactions
      const transactions = [
        { type: 'BUY', symbol: 'BTC', quantity: 1, price: 40000, fee: 20 },
        { type: 'BUY', symbol: 'BTC', quantity: 0.5, price: 50000, fee: 15 },
        { type: 'SELL', symbol: 'BTC', quantity: 0.3, price: 55000, fee: 12 }
      ];

      for (const tx of transactions) {
        await request(app)
          .post(`/api/v1/portfolios/${portfolioId}/transactions`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            ...tx,
            executedAt: new Date().toISOString()
          })
          .expect(201);
      }

      // Verify portfolio reflects transaction data
      const portfolioDetails = await request(app)
        .get(`/api/v1/portfolios/${portfolioId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Check that portfolio has been updated with transaction data
      expect(portfolioDetails.body.data.assets).toBeDefined();

      // Verify transaction analytics
      const analyticsResponse = await request(app)
        .get(`/api/v1/portfolios/${portfolioId}/transactions/analytics`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(analyticsResponse.body.data.totalTransactions).toBe(3);
      expect(analyticsResponse.body.data.byType.BUY).toBe(2);
      expect(analyticsResponse.body.data.byType.SELL).toBe(1);
    });

    it('should handle bulk operations with proper rollback on failure', async () => {
      const portfolioResponse = await request(app)
        .post('/api/v1/portfolios')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Bulk Test Portfolio',
          type: 'MANUAL'
        });

      const portfolioId = portfolioResponse.body.data.id;

      // Attempt bulk creation with mixed valid/invalid data
      const bulkTransactions = [
        { type: 'BUY', symbol: 'BTC', quantity: 1, price: 40000, executedAt: new Date().toISOString() },
        { type: 'INVALID_TYPE', symbol: 'ETH', quantity: 2, price: 3000, executedAt: new Date().toISOString() }, // Invalid
        { type: 'BUY', symbol: 'ADA', quantity: 100, price: 0.5, executedAt: new Date().toISOString() }
      ];

      const bulkResponse = await request(app)
        .post(`/api/v1/portfolios/${portfolioId}/transactions/bulk`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ transactions: bulkTransactions })
        .expect(207); // Multi-status

      expect(bulkResponse.body.data.created).toBe(2);
      expect(bulkResponse.body.data.failed).toBe(1);

      // Verify only valid transactions were created
      const transactionsResponse = await request(app)
        .get(`/api/v1/portfolios/${portfolioId}/transactions`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(transactionsResponse.body.data.length).toBe(2);
    });
  });

  describe('Real-World Scenarios', () => {
    beforeEach(async () => {
      testUser = await generateTestUser();
      const loginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testUser.email,
          password: 'TestPassword123!'
        });
      authToken = loginResponse.body.data.token;
    });

    it('should handle a day trading scenario', async () => {
      // Create trading portfolio
      const portfolioResponse = await request(app)
        .post('/api/v1/portfolios')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Day Trading Portfolio',
          type: 'MANUAL',
          description: 'Active trading portfolio'
        });

      const portfolioId = portfolioResponse.body.data.id;

      // Simulate day trading activities
      const tradingActivities = [
        // Buy BTC
        { type: 'BUY', symbol: 'BTC', quantity: 0.1, price: 45000, fee: 10 },
        // Quick sell for profit
        { type: 'SELL', symbol: 'BTC', quantity: 0.05, price: 46000, fee: 8 },
        // Buy ETH
        { type: 'BUY', symbol: 'ETH', quantity: 1, price: 3000, fee: 5 },
        // Sell at loss
        { type: 'SELL', symbol: 'ETH', quantity: 1, price: 2950, fee: 5 },
        // Buy back BTC
        { type: 'BUY', symbol: 'BTC', quantity: 0.05, price: 45500, fee: 7 }
      ];

      // Execute trades with small delays
      for (const [index, trade] of tradingActivities.entries()) {
        const executedAt = new Date(Date.now() + index * 60000).toISOString(); // 1 minute apart
        
        await request(app)
          .post(`/api/v1/portfolios/${portfolioId}/transactions`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            ...trade,
            executedAt,
            notes: `Day trade #${index + 1}`
          })
          .expect(201);
      }

      // Check portfolio performance
      const performanceResponse = await request(app)
        .get(`/api/v1/portfolios/${portfolioId}/performance?period=1d`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(performanceResponse.body.success).toBe(true);
      expect(performanceResponse.body.data.period).toBe('1d');

      // Verify analytics show trading activity
      const analyticsResponse = await request(app)
        .get(`/api/v1/portfolios/${portfolioId}/transactions/analytics`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(analyticsResponse.body.data.totalTransactions).toBe(5);
      expect(analyticsResponse.body.data.byType.BUY).toBe(3);
      expect(analyticsResponse.body.data.byType.SELL).toBe(2);
    });

    it('should handle long-term investment scenario', async () => {
      // Create investment portfolio
      const portfolioResponse = await request(app)
        .post('/api/v1/portfolios')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Long-term Investment Portfolio',
          type: 'MANUAL',
          description: 'HODL strategy portfolio'
        });

      const portfolioId = portfolioResponse.body.data.id;

      // Simulate dollar-cost averaging over time
      const investments = [
        { symbol: 'BTC', amount: 1000, price: 40000 },
        { symbol: 'ETH', amount: 500, price: 2500 },
        { symbol: 'ADA', amount: 200, price: 0.4 },
        { symbol: 'DOT', amount: 300, price: 15 }
      ];

      for (const investment of investments) {
        const quantity = investment.amount / investment.price;
        
        await request(app)
          .post(`/api/v1/portfolios/${portfolioId}/transactions`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            type: 'BUY',
            symbol: investment.symbol,
            quantity,
            price: investment.price,
            fee: investment.amount * 0.001, // 0.1% fee
            executedAt: new Date().toISOString(),
            notes: `DCA investment in ${investment.symbol}`
          })
          .expect(201);
      }

      // Simulate monthly recurring investments
      for (let month = 1; month <= 3; month++) {
        const monthlyBuy = {
          type: 'BUY',
          symbol: 'BTC',
          quantity: 500 / (40000 + month * 1000), // Varying price
          price: 40000 + month * 1000,
          fee: 5,
          executedAt: new Date(Date.now() + month * 30 * 24 * 60 * 60 * 1000).toISOString(),
          notes: `Monthly DCA - Month ${month}`
        };

        await request(app)
          .post(`/api/v1/portfolios/${portfolioId}/transactions`)
          .set('Authorization', `Bearer ${authToken}`)
          .send(monthlyBuy)
          .expect(201);
      }

      // Check long-term performance
      const performanceResponse = await request(app)
        .get(`/api/v1/portfolios/${portfolioId}/performance?period=1y`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(performanceResponse.body.success).toBe(true);
      expect(performanceResponse.body.data.period).toBe('1y');

      // Verify diversification
      const analyticsResponse = await request(app)
        .get(`/api/v1/portfolios/${portfolioId}/transactions/analytics`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Object.keys(analyticsResponse.body.data.bySymbol)).toHaveLength(4);
      expect(analyticsResponse.body.data.totalTransactions).toBe(7); // 4 initial + 3 monthly
    });

    it('should handle portfolio rebalancing scenario', async () => {
      // Create rebalancing portfolio
      const portfolioResponse = await request(app)
        .post('/api/v1/portfolios')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Rebalancing Portfolio',
          type: 'MANUAL',
          description: 'Periodic rebalancing strategy'
        });

      const portfolioId = portfolioResponse.body.data.id;

      // Initial allocation: 50% BTC, 30% ETH, 20% ADA
      const initialInvestment = 10000;
      const initialAllocations = [
        { symbol: 'BTC', percentage: 0.5, price: 50000 },
        { symbol: 'ETH', percentage: 0.3, price: 3000 },
        { symbol: 'ADA', percentage: 0.2, price: 1 }
      ];

      // Make initial purchases
      for (const allocation of initialAllocations) {
        const investmentAmount = initialInvestment * allocation.percentage;
        const quantity = investmentAmount / allocation.price;

        await request(app)
          .post(`/api/v1/portfolios/${portfolioId}/transactions`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            type: 'BUY',
            symbol: allocation.symbol,
            quantity,
            price: allocation.price,
            fee: investmentAmount * 0.001,
            executedAt: new Date().toISOString(),
            notes: `Initial allocation: ${allocation.percentage * 100}%`
          })
          .expect(201);
      }

      // Simulate price changes and rebalancing
      const rebalancingTransactions = [
        // BTC grew too much, sell some
        { type: 'SELL', symbol: 'BTC', quantity: 0.02, price: 55000, fee: 10 },
        // Buy more ADA to rebalance
        { type: 'BUY', symbol: 'ADA', quantity: 500, price: 1.2, fee: 5 },
        // ETH also grew, trim position
        { type: 'SELL', symbol: 'ETH', quantity: 0.2, price: 3500, fee: 8 }
      ];

      for (const tx of rebalancingTransactions) {
        await request(app)
          .post(`/api/v1/portfolios/${portfolioId}/transactions`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            ...tx,
            executedAt: new Date(Date.now() + 86400000).toISOString(), // Next day
            notes: 'Rebalancing transaction'
          })
          .expect(201);
      }

      // Verify rebalancing results
      const finalPortfolioResponse = await request(app)
        .get(`/api/v1/portfolios/${portfolioId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(finalPortfolioResponse.body.data.assets).toBeDefined();
      expect(finalPortfolioResponse.body.data.assets.length).toBeGreaterThan(0);

      // Check transaction history shows rebalancing
      const transactionsResponse = await request(app)
        .get(`/api/v1/portfolios/${portfolioId}/transactions`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const rebalancingTxs = transactionsResponse.body.data.filter(
        (tx: any) => tx.notes && tx.notes.includes('Rebalancing')
      );
      expect(rebalancingTxs).toHaveLength(3);
    });
  });

  describe('Error Recovery and Resilience', () => {
    beforeEach(async () => {
      testUser = await generateTestUser();
      const loginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testUser.email,
          password: 'TestPassword123!'
        });
      authToken = loginResponse.body.data.token;
    });

    it('should handle partial failures gracefully', async () => {
      const portfolioResponse = await request(app)
        .post('/api/v1/portfolios')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Error Recovery Test',
          type: 'MANUAL'
        });

      const portfolioId = portfolioResponse.body.data.id;

      // Create transactions with intentional errors mixed in
      const mixedTransactions = [
        { type: 'BUY', symbol: 'BTC', quantity: 1, price: 50000, executedAt: new Date().toISOString() },
        { type: 'BUY', symbol: 'ETH', quantity: -1, price: 3000, executedAt: new Date().toISOString() }, // Invalid quantity
        { type: 'BUY', symbol: 'ADA', quantity: 100, price: 1, executedAt: new Date().toISOString() }
      ];

      let successCount = 0;
      let errorCount = 0;

      for (const tx of mixedTransactions) {
        const response = await request(app)
          .post(`/api/v1/portfolios/${portfolioId}/transactions`)
          .set('Authorization', `Bearer ${authToken}`)
          .send(tx);

        if (response.status === 201) {
          successCount++;
        } else {
          errorCount++;
        }
      }

      expect(successCount).toBe(2);
      expect(errorCount).toBe(1);

      // Verify portfolio state is consistent
      const portfolioState = await request(app)
        .get(`/api/v1/portfolios/${portfolioId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(portfolioState.body.success).toBe(true);

      // Verify only valid transactions were recorded
      const transactionsResponse = await request(app)
        .get(`/api/v1/portfolios/${portfolioId}/transactions`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(transactionsResponse.body.data).toHaveLength(2);
    });

    it('should maintain data integrity during concurrent operations', async () => {
      const portfolioResponse = await request(app)
        .post('/api/v1/portfolios')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Concurrency Test',
          type: 'MANUAL'
        });

      const portfolioId = portfolioResponse.body.data.id;

      // Create multiple transactions concurrently
      const concurrentTransactions = Array.from({ length: 10 }, (_, i) => ({
        type: 'BUY',
        symbol: 'BTC',
        quantity: 0.1,
        price: 50000 + i * 100,
        fee: 5,
        executedAt: new Date().toISOString(),
        notes: `Concurrent transaction ${i + 1}`
      }));

      const promises = concurrentTransactions.map(tx =>
        request(app)
          .post(`/api/v1/portfolios/${portfolioId}/transactions`)
          .set('Authorization', `Bearer ${authToken}`)
          .send(tx)
      );

      const responses = await Promise.all(promises);

      // All transactions should succeed
      responses.forEach(response => {
        expect(response.status).toBe(201);
      });

      // Verify all transactions were recorded
      const finalTransactionsResponse = await request(app)
        .get(`/api/v1/portfolios/${portfolioId}/transactions`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(finalTransactionsResponse.body.data).toHaveLength(10);

      // Verify no duplicate IDs
      const transactionIds = finalTransactionsResponse.body.data.map((tx: any) => tx.id);
      const uniqueIds = new Set(transactionIds);
      expect(uniqueIds.size).toBe(transactionIds.length);
    });
  });

  describe('Performance Under Load', () => {
    beforeEach(async () => {
      testUser = await generateTestUser();
      const loginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testUser.email,
          password: 'TestPassword123!'
        });
      authToken = loginResponse.body.data.token;
    });

    it('should handle large dataset operations efficiently', async () => {
      const portfolioResponse = await request(app)
        .post('/api/v1/portfolios')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Large Dataset Test',
          type: 'MANUAL'
        });

      const portfolioId = portfolioResponse.body.data.id;

      // Create a large number of transactions
      const largeTransactionSet = Array.from({ length: 100 }, (_, i) => ({
        type: 'BUY',
        symbol: i % 2 === 0 ? 'BTC' : 'ETH',
        quantity: Math.random() * 10,
        price: 1000 + Math.random() * 50000,
        fee: Math.random() * 50,
        executedAt: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString()
      }));

      // Use bulk creation for efficiency
      const bulkResponse = await request(app)
        .post(`/api/v1/portfolios/${portfolioId}/transactions/bulk`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ transactions: largeTransactionSet })
        .expect(201);

      expect(bulkResponse.body.data.created).toBe(100);

      // Test pagination performance
      const startTime = Date.now();
      
      const paginationResponse = await request(app)
        .get(`/api/v1/portfolios/${portfolioId}/transactions?page=1&limit=50`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const responseTime = Date.now() - startTime;
      
      expect(responseTime).toBeLessThan(1000); // Should respond within 1 second
      expect(paginationResponse.body.data).toHaveLength(50);
      expect(paginationResponse.body.pagination.total).toBe(100);

      // Test analytics performance with large dataset
      const analyticsStartTime = Date.now();
      
      const analyticsResponse = await request(app)
        .get(`/api/v1/portfolios/${portfolioId}/transactions/analytics`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const analyticsResponseTime = Date.now() - analyticsStartTime;
      
      expect(analyticsResponseTime).toBeLessThan(2000); // Should respond within 2 seconds
      expect(analyticsResponse.body.data.totalTransactions).toBe(100);
    });
  });
});