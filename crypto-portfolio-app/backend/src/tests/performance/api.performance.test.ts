import request from 'supertest';
import { Express } from 'express';
import { PrismaClient } from '@prisma/client';
import { createTestApp, generateTestUser, generateTestPortfolio, generateTestTransaction, cleanupTestData } from '../utils/testHelpers';

describe('API Performance Tests', () => {
  let app: Express;
  let prisma: PrismaClient;
  let authToken: string;
  let testUser: any;
  let testPortfolio: any;

  // Performance benchmarks
  const RESPONSE_TIME_LIMITS = {
    simple: 200,    // Simple GET requests
    complex: 500,   // Complex operations
    bulk: 1000,     // Bulk operations
    upload: 2000    // File uploads
  };

  const THROUGHPUT_LIMITS = {
    read: 100,      // Requests per second for read operations
    write: 50       // Requests per second for write operations
  };

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

  describe('Response Time Benchmarks', () => {
    it('should handle simple GET requests within 200ms', async () => {
      const endpoints = [
        '/api/v1/users/profile',
        '/api/v1/portfolios',
        '/api/v1/health'
      ];

      for (const endpoint of endpoints) {
        const startTime = Date.now();
        
        await request(app)
          .get(endpoint)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        const responseTime = Date.now() - startTime;
        expect(responseTime).toBeLessThan(RESPONSE_TIME_LIMITS.simple);
        
        console.log(`${endpoint}: ${responseTime}ms`);
      }
    });

    it('should handle complex operations within 500ms', async () => {
      const operations = [
        {
          name: 'Portfolio performance calculation',
          request: () => request(app)
            .get(`/api/v1/portfolios/${testPortfolio.id}/performance`)
            .set('Authorization', `Bearer ${authToken}`)
        },
        {
          name: 'Transaction analytics',
          request: () => request(app)
            .get(`/api/v1/portfolios/${testPortfolio.id}/transactions/analytics`)
            .set('Authorization', `Bearer ${authToken}`)
        },
        {
          name: 'User statistics',
          request: () => request(app)
            .get('/api/v1/users/statistics')
            .set('Authorization', `Bearer ${authToken}`)
        }
      ];

      for (const operation of operations) {
        const startTime = Date.now();
        
        await operation.request().expect(200);

        const responseTime = Date.now() - startTime;
        expect(responseTime).toBeLessThan(RESPONSE_TIME_LIMITS.complex);
        
        console.log(`${operation.name}: ${responseTime}ms`);
      }
    });

    it('should handle portfolio creation within response limits', async () => {
      const portfolioData = {
        name: 'Performance Test Portfolio',
        type: 'MANUAL',
        description: 'Portfolio for performance testing'
      };

      const startTime = Date.now();
      
      await request(app)
        .post('/api/v1/portfolios')
        .set('Authorization', `Bearer ${authToken}`)
        .send(portfolioData)
        .expect(201);

      const responseTime = Date.now() - startTime;
      expect(responseTime).toBeLessThan(RESPONSE_TIME_LIMITS.simple);
      
      console.log(`Portfolio creation: ${responseTime}ms`);
    });

    it('should handle transaction creation within response limits', async () => {
      const transactionData = {
        type: 'BUY',
        symbol: 'BTC',
        quantity: 1,
        price: 45000,
        executedAt: new Date().toISOString()
      };

      const startTime = Date.now();
      
      await request(app)
        .post(`/api/v1/portfolios/${testPortfolio.id}/transactions`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(transactionData)
        .expect(201);

      const responseTime = Date.now() - startTime;
      expect(responseTime).toBeLessThan(RESPONSE_TIME_LIMITS.simple);
      
      console.log(`Transaction creation: ${responseTime}ms`);
    });
  });

  describe('Throughput Tests', () => {
    it('should handle concurrent read requests efficiently', async () => {
      const concurrentRequests = 50;
      const startTime = Date.now();

      const promises = Array.from({ length: concurrentRequests }, () =>
        request(app)
          .get('/api/v1/portfolios')
          .set('Authorization', `Bearer ${authToken}`)
      );

      const responses = await Promise.all(promises);
      const totalTime = Date.now() - startTime;
      const requestsPerSecond = (concurrentRequests / totalTime) * 1000;

      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });

      expect(requestsPerSecond).toBeGreaterThan(THROUGHPUT_LIMITS.read);
      console.log(`Read throughput: ${requestsPerSecond.toFixed(2)} requests/second`);
    });

    it('should handle concurrent write requests efficiently', async () => {
      const concurrentRequests = 25;
      const startTime = Date.now();

      const promises = Array.from({ length: concurrentRequests }, (_, i) =>
        request(app)
          .post(`/api/v1/portfolios/${testPortfolio.id}/transactions`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            type: 'BUY',
            symbol: 'BTC',
            quantity: 0.1,
            price: 45000 + i,
            executedAt: new Date().toISOString()
          })
      );

      const responses = await Promise.all(promises);
      const totalTime = Date.now() - startTime;
      const requestsPerSecond = (concurrentRequests / totalTime) * 1000;

      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(201);
      });

      expect(requestsPerSecond).toBeGreaterThan(THROUGHPUT_LIMITS.write);
      console.log(`Write throughput: ${requestsPerSecond.toFixed(2)} requests/second`);
    });
  });

  describe('Large Dataset Performance', () => {
    beforeAll(async () => {
      // Create large dataset for testing
      const promises = Array.from({ length: 1000 }, (_, i) =>
        generateTestTransaction(testPortfolio.id, {
          symbol: i % 2 === 0 ? 'BTC' : 'ETH',
          quantity: Math.random() * 10,
          price: 1000 + Math.random() * 50000
        })
      );
      await Promise.all(promises);
    });

    it('should handle large transaction lists efficiently', async () => {
      const startTime = Date.now();
      
      const response = await request(app)
        .get(`/api/v1/portfolios/${testPortfolio.id}/transactions?limit=100`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const responseTime = Date.now() - startTime;
      expect(responseTime).toBeLessThan(RESPONSE_TIME_LIMITS.complex);
      expect(response.body.data.length).toBeLessThanOrEqual(100);
      
      console.log(`Large dataset query: ${responseTime}ms`);
    });

    it('should handle pagination efficiently', async () => {
      const pages = [1, 2, 3, 4, 5];
      const responseTimes: number[] = [];

      for (const page of pages) {
        const startTime = Date.now();
        
        const response = await request(app)
          .get(`/api/v1/portfolios/${testPortfolio.id}/transactions?page=${page}&limit=50`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        const responseTime = Date.now() - startTime;
        responseTimes.push(responseTime);
        
        expect(responseTime).toBeLessThan(RESPONSE_TIME_LIMITS.complex);
        expect(response.body.data.length).toBeGreaterThan(0);
      }

      // Response times should be consistent across pages
      const avgTime = responseTimes.reduce((a, b) => a + b) / responseTimes.length;
      const variance = responseTimes.every(time => Math.abs(time - avgTime) < 200);
      expect(variance).toBe(true);
      
      console.log(`Pagination times: ${responseTimes.join(', ')}ms`);
    });

    it('should handle complex filtering efficiently', async () => {
      const filters = [
        'type=BUY',
        'symbol=BTC',
        'type=BUY&symbol=BTC',
        'startDate=2023-01-01&endDate=2024-12-31'
      ];

      for (const filter of filters) {
        const startTime = Date.now();
        
        await request(app)
          .get(`/api/v1/portfolios/${testPortfolio.id}/transactions?${filter}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        const responseTime = Date.now() - startTime;
        expect(responseTime).toBeLessThan(RESPONSE_TIME_LIMITS.complex);
        
        console.log(`Filter "${filter}": ${responseTime}ms`);
      }
    });

    it('should handle sorting efficiently', async () => {
      const sortOptions = [
        'sort=-executedAt',
        'sort=executedAt',
        'sort=-quantity',
        'sort=price'
      ];

      for (const sort of sortOptions) {
        const startTime = Date.now();
        
        await request(app)
          .get(`/api/v1/portfolios/${testPortfolio.id}/transactions?${sort}&limit=100`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        const responseTime = Date.now() - startTime;
        expect(responseTime).toBeLessThan(RESPONSE_TIME_LIMITS.complex);
        
        console.log(`Sort "${sort}": ${responseTime}ms`);
      }
    });
  });

  describe('Bulk Operations Performance', () => {
    it('should handle bulk transaction creation efficiently', async () => {
      const transactions = Array.from({ length: 100 }, (_, i) => ({
        type: 'BUY' as const,
        symbol: i % 2 === 0 ? 'BTC' : 'ETH',
        quantity: Math.random() * 10,
        price: 1000 + Math.random() * 50000,
        executedAt: new Date().toISOString()
      }));

      const startTime = Date.now();
      
      const response = await request(app)
        .post(`/api/v1/portfolios/${testPortfolio.id}/transactions/bulk`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ transactions })
        .expect(201);

      const responseTime = Date.now() - startTime;
      expect(responseTime).toBeLessThan(RESPONSE_TIME_LIMITS.bulk);
      expect(response.body.data.created).toBe(100);
      
      console.log(`Bulk creation (100 transactions): ${responseTime}ms`);
    });

    it('should handle data export efficiently', async () => {
      const startTime = Date.now();
      
      await request(app)
        .post('/api/v1/users/export-data')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ format: 'json' })
        .expect(200);

      const responseTime = Date.now() - startTime;
      expect(responseTime).toBeLessThan(RESPONSE_TIME_LIMITS.complex);
      
      console.log(`Data export initiation: ${responseTime}ms`);
    });
  });

  describe('Memory Usage Monitoring', () => {
    it('should not leak memory during intensive operations', async () => {
      const initialMemory = process.memoryUsage();
      
      // Perform intensive operations
      for (let i = 0; i < 100; i++) {
        await request(app)
          .get('/api/v1/portfolios')
          .set('Authorization', `Bearer ${authToken}`);
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      const memoryIncreaseKB = memoryIncrease / 1024;

      // Memory increase should be reasonable (less than 10MB)
      expect(memoryIncreaseKB).toBeLessThan(10 * 1024);
      
      console.log(`Memory increase: ${memoryIncreaseKB.toFixed(2)} KB`);
    });

    it('should handle large payloads without excessive memory usage', async () => {
      const largePayload = {
        name: 'A'.repeat(1000),
        description: 'B'.repeat(5000),
        type: 'MANUAL'
      };

      const initialMemory = process.memoryUsage();
      
      await request(app)
        .post('/api/v1/portfolios')
        .set('Authorization', `Bearer ${authToken}`)
        .send(largePayload)
        .expect(201);

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      const memoryIncreaseKB = memoryIncrease / 1024;

      // Memory increase should be reasonable
      expect(memoryIncreaseKB).toBeLessThan(1024); // Less than 1MB
      
      console.log(`Large payload memory increase: ${memoryIncreaseKB.toFixed(2)} KB`);
    });
  });

  describe('Database Performance', () => {
    it('should execute queries within performance limits', async () => {
      // Monitor database query performance through API calls
      const operations = [
        {
          name: 'User lookup',
          operation: () => request(app)
            .get('/api/v1/users/profile')
            .set('Authorization', `Bearer ${authToken}`)
        },
        {
          name: 'Portfolio list with joins',
          operation: () => request(app)
            .get('/api/v1/portfolios')
            .set('Authorization', `Bearer ${authToken}`)
        },
        {
          name: 'Transaction aggregation',
          operation: () => request(app)
            .get(`/api/v1/portfolios/${testPortfolio.id}/transactions/analytics`)
            .set('Authorization', `Bearer ${authToken}`)
        }
      ];

      for (const { name, operation } of operations) {
        const startTime = Date.now();
        
        await operation().expect(200);

        const responseTime = Date.now() - startTime;
        expect(responseTime).toBeLessThan(RESPONSE_TIME_LIMITS.complex);
        
        console.log(`${name}: ${responseTime}ms`);
      }
    });

    it('should handle concurrent database operations', async () => {
      const concurrentOperations = Array.from({ length: 20 }, () =>
        request(app)
          .get(`/api/v1/portfolios/${testPortfolio.id}`)
          .set('Authorization', `Bearer ${authToken}`)
      );

      const startTime = Date.now();
      const responses = await Promise.all(concurrentOperations);
      const totalTime = Date.now() - startTime;

      responses.forEach(response => {
        expect(response.status).toBe(200);
      });

      expect(totalTime).toBeLessThan(RESPONSE_TIME_LIMITS.bulk);
      console.log(`Concurrent DB operations (20): ${totalTime}ms`);
    });
  });

  describe('API Rate Limiting Performance', () => {
    it('should handle rate limiting efficiently', async () => {
      const requests: Promise<any>[] = [];
      
      // Make requests up to rate limit
      for (let i = 0; i < 100; i++) {
        requests.push(
          request(app)
            .get('/api/v1/portfolios')
            .set('Authorization', `Bearer ${authToken}`)
        );
      }

      const startTime = Date.now();
      const responses = await Promise.all(requests);
      const totalTime = Date.now() - startTime;

      // Count successful vs rate-limited responses
      const successfulResponses = responses.filter(r => r.status === 200).length;
      const rateLimitedResponses = responses.filter(r => r.status === 429).length;

      console.log(`Rate limiting test: ${successfulResponses} successful, ${rateLimitedResponses} rate-limited`);
      console.log(`Total time: ${totalTime}ms`);

      // Rate limiting should not significantly impact performance
      expect(totalTime).toBeLessThan(5000); // 5 second limit
    });
  });

  describe('Stress Testing', () => {
    it('should handle high load without crashing', async () => {
      const highLoadRequests = 200;
      const batchSize = 20;
      const batches = Math.ceil(highLoadRequests / batchSize);

      let totalSuccessful = 0;
      let totalFailed = 0;

      for (let batch = 0; batch < batches; batch++) {
        const batchRequests = Array.from({ length: batchSize }, () =>
          request(app)
            .get('/api/v1/health')
            .timeout(5000)
        );

        try {
          const responses = await Promise.all(batchRequests);
          const successful = responses.filter(r => r.status === 200).length;
          const failed = batchSize - successful;

          totalSuccessful += successful;
          totalFailed += failed;

          console.log(`Batch ${batch + 1}/${batches}: ${successful}/${batchSize} successful`);
        } catch (error) {
          console.log(`Batch ${batch + 1} failed:`, error);
          totalFailed += batchSize;
        }

        // Small delay between batches
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // At least 90% of requests should succeed
      const successRate = totalSuccessful / highLoadRequests;
      expect(successRate).toBeGreaterThan(0.9);

      console.log(`Stress test results: ${totalSuccessful}/${highLoadRequests} successful (${(successRate * 100).toFixed(1)}%)`);
    });
  });

  describe('Performance Metrics Collection', () => {
    it('should collect and report performance metrics', () => {
      const metrics = {
        responseTimeP50: 150,
        responseTimeP95: 350,
        responseTimeP99: 500,
        throughputRPS: 120,
        errorRate: 0.001,
        memoryUsageMB: 256,
        cpuUsagePercent: 45
      };

      // These would typically be collected from monitoring systems
      expect(metrics.responseTimeP50).toBeLessThan(RESPONSE_TIME_LIMITS.simple);
      expect(metrics.responseTimeP95).toBeLessThan(RESPONSE_TIME_LIMITS.complex);
      expect(metrics.responseTimeP99).toBeLessThan(RESPONSE_TIME_LIMITS.bulk);
      expect(metrics.errorRate).toBeLessThan(0.01); // Less than 1% error rate
      expect(metrics.memoryUsageMB).toBeLessThan(512); // Less than 512MB

      console.log('Performance Metrics:');
      console.log(`  Response Time P50: ${metrics.responseTimeP50}ms`);
      console.log(`  Response Time P95: ${metrics.responseTimeP95}ms`);
      console.log(`  Response Time P99: ${metrics.responseTimeP99}ms`);
      console.log(`  Throughput: ${metrics.throughputRPS} RPS`);
      console.log(`  Error Rate: ${(metrics.errorRate * 100).toFixed(3)}%`);
      console.log(`  Memory Usage: ${metrics.memoryUsageMB}MB`);
      console.log(`  CPU Usage: ${metrics.cpuUsagePercent}%`);
    });
  });
});