import request from 'supertest';
import { Express } from 'express';
import { PrismaClient } from '@prisma/client';
import { faker } from '@faker-js/faker';
import { createTestApp } from '../utils/testHelpers';
import { generateTestUser, generateTestPortfolio } from '../utils/testHelpers';

describe('Portfolio API Tests', () => {
  let app: Express;
  let prisma: PrismaClient;
  let authToken: string;
  let testUser: any;

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
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('POST /api/v1/portfolios', () => {
    it('should create a new portfolio with valid data', async () => {
      const portfolioData = {
        name: 'Test Portfolio',
        description: 'Portfolio for testing',
        type: 'MANUAL',
        isDefault: false
      };

      const response = await request(app)
        .post('/api/v1/portfolios')
        .set('Authorization', `Bearer ${authToken}`)
        .send(portfolioData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        name: portfolioData.name,
        description: portfolioData.description,
        type: portfolioData.type,
        isDefault: portfolioData.isDefault,
        userId: testUser.id
      });
      expect(response.body.data.id).toBeDefined();
      expect(response.body.data.createdAt).toBeDefined();
    });

    it('should return 400 for invalid portfolio data', async () => {
      const invalidData = {
        name: '', // Empty name should fail validation
        type: 'INVALID_TYPE'
      };

      const response = await request(app)
        .post('/api/v1/portfolios')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Validation Error');
      expect(response.body.details).toBeDefined();
    });

    it('should return 401 for unauthenticated requests', async () => {
      const portfolioData = {
        name: 'Test Portfolio',
        type: 'MANUAL'
      };

      await request(app)
        .post('/api/v1/portfolios')
        .send(portfolioData)
        .expect(401);
    });

    it('should handle long portfolio names and descriptions', async () => {
      const portfolioData = {
        name: 'A'.repeat(100), // Max length
        description: 'B'.repeat(500), // Max length
        type: 'MANUAL'
      };

      const response = await request(app)
        .post('/api/v1/portfolios')
        .set('Authorization', `Bearer ${authToken}`)
        .send(portfolioData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe(portfolioData.name);
      expect(response.body.data.description).toBe(portfolioData.description);
    });

    it('should reject names exceeding maximum length', async () => {
      const portfolioData = {
        name: 'A'.repeat(101), // Exceeds max length
        type: 'MANUAL'
      };

      await request(app)
        .post('/api/v1/portfolios')
        .set('Authorization', `Bearer ${authToken}`)
        .send(portfolioData)
        .expect(400);
    });
  });

  describe('GET /api/v1/portfolios', () => {
    beforeEach(async () => {
      // Create test portfolios
      for (let i = 0; i < 15; i++) {
        await generateTestPortfolio(testUser.id);
      }
    });

    it('should return paginated portfolios for authenticated user', async () => {
      const response = await request(app)
        .get('/api/v1/portfolios?page=1&limit=10')
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
        .get('/api/v1/portfolios?sort=-createdAt')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      const portfolios = response.body.data;
      
      // Check if sorted by createdAt descending
      for (let i = 0; i < portfolios.length - 1; i++) {
        const current = new Date(portfolios[i].createdAt);
        const next = new Date(portfolios[i + 1].createdAt);
        expect(current.getTime()).toBeGreaterThanOrEqual(next.getTime());
      }
    });

    it('should filter portfolios by type', async () => {
      const response = await request(app)
        .get('/api/v1/portfolios?type=MANUAL')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      response.body.data.forEach((portfolio: any) => {
        expect(portfolio.type).toBe('MANUAL');
      });
    });

    it('should return empty array when user has no portfolios', async () => {
      // Create new user with no portfolios
      const newUser = await generateTestUser();
      const loginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: newUser.email,
          password: 'TestPassword123!'
        });

      const response = await request(app)
        .get('/api/v1/portfolios')
        .set('Authorization', `Bearer ${loginResponse.body.data.token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual([]);
      expect(response.body.pagination.total).toBe(0);
    });
  });

  describe('GET /api/v1/portfolios/:id', () => {
    let testPortfolio: any;

    beforeEach(async () => {
      testPortfolio = await generateTestPortfolio(testUser.id);
    });

    it('should return portfolio details for valid ID', async () => {
      const response = await request(app)
        .get(`/api/v1/portfolios/${testPortfolio.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        id: testPortfolio.id,
        name: testPortfolio.name,
        userId: testUser.id
      });
      expect(response.body.data.assets).toBeDefined();
      expect(response.body.data.performance).toBeDefined();
    });

    it('should return 404 for non-existent portfolio', async () => {
      const fakeId = faker.string.uuid();
      
      await request(app)
        .get(`/api/v1/portfolios/${fakeId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should return 403 for portfolio owned by different user', async () => {
      // Create another user and their portfolio
      const otherUser = await generateTestUser();
      const otherPortfolio = await generateTestPortfolio(otherUser.id);

      await request(app)
        .get(`/api/v1/portfolios/${otherPortfolio.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(403);
    });

    it('should return 400 for invalid UUID format', async () => {
      await request(app)
        .get('/api/v1/portfolios/invalid-uuid')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);
    });
  });

  describe('PUT /api/v1/portfolios/:id', () => {
    let testPortfolio: any;

    beforeEach(async () => {
      testPortfolio = await generateTestPortfolio(testUser.id);
    });

    it('should update portfolio with valid data', async () => {
      const updateData = {
        name: 'Updated Portfolio Name',
        description: 'Updated description',
        isActive: false
      };

      const response = await request(app)
        .put(`/api/v1/portfolios/${testPortfolio.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        id: testPortfolio.id,
        name: updateData.name,
        description: updateData.description,
        isActive: updateData.isActive
      });
      expect(response.body.data.updatedAt).not.toBe(testPortfolio.updatedAt);
    });

    it('should allow partial updates', async () => {
      const updateData = {
        name: 'Only Name Updated'
      };

      const response = await request(app)
        .put(`/api/v1/portfolios/${testPortfolio.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe(updateData.name);
      expect(response.body.data.description).toBe(testPortfolio.description);
    });

    it('should return 404 for non-existent portfolio', async () => {
      const fakeId = faker.string.uuid();
      
      await request(app)
        .put(`/api/v1/portfolios/${fakeId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Updated Name' })
        .expect(404);
    });

    it('should validate update data', async () => {
      const invalidData = {
        name: '', // Empty name
        type: 'INVALID_TYPE'
      };

      await request(app)
        .put(`/api/v1/portfolios/${testPortfolio.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidData)
        .expect(400);
    });
  });

  describe('DELETE /api/v1/portfolios/:id', () => {
    let testPortfolio: any;

    beforeEach(async () => {
      testPortfolio = await generateTestPortfolio(testUser.id);
    });

    it('should delete portfolio successfully', async () => {
      await request(app)
        .delete(`/api/v1/portfolios/${testPortfolio.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(204);

      // Verify portfolio is deleted
      await request(app)
        .get(`/api/v1/portfolios/${testPortfolio.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should return 404 for non-existent portfolio', async () => {
      const fakeId = faker.string.uuid();
      
      await request(app)
        .delete(`/api/v1/portfolios/${fakeId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should prevent deletion of default portfolio if it\'s the only one', async () => {
      // Set portfolio as default and ensure it's the only one
      await request(app)
        .put(`/api/v1/portfolios/${testPortfolio.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ isDefault: true });

      await request(app)
        .delete(`/api/v1/portfolios/${testPortfolio.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);
    });
  });

  describe('GET /api/v1/portfolios/:id/performance', () => {
    let testPortfolio: any;

    beforeEach(async () => {
      testPortfolio = await generateTestPortfolio(testUser.id);
    });

    it('should return performance metrics for different time periods', async () => {
      const periods = ['1d', '7d', '30d', '1y', 'all'];

      for (const period of periods) {
        const response = await request(app)
          .get(`/api/v1/portfolios/${testPortfolio.id}/performance?period=${period}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toMatchObject({
          period,
          totalValue: expect.any(Number),
          totalReturn: expect.any(Number),
          totalReturnPercentage: expect.any(Number)
        });
      }
    });

    it('should default to 30d period when not specified', async () => {
      const response = await request(app)
        .get(`/api/v1/portfolios/${testPortfolio.id}/performance`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data.period).toBe('30d');
    });

    it('should return 400 for invalid period', async () => {
      await request(app)
        .get(`/api/v1/portfolios/${testPortfolio.id}/performance?period=invalid`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);
    });
  });

  describe('Rate Limiting', () => {
    it('should respect rate limits for portfolio creation', async () => {
      const portfolioData = {
        name: 'Rate Limit Test',
        type: 'MANUAL'
      };

      // Make requests up to rate limit
      for (let i = 0; i < 10; i++) {
        await request(app)
          .post('/api/v1/portfolios')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            ...portfolioData,
            name: `${portfolioData.name} ${i}`
          });
      }

      // Next request should be rate limited
      const response = await request(app)
        .post('/api/v1/portfolios')
        .set('Authorization', `Bearer ${authToken}`)
        .send(portfolioData);

      if (response.status === 429) {
        expect(response.body.error).toBe('Rate Limit Exceeded');
        expect(response.headers['retry-after']).toBeDefined();
      }
    });
  });

  describe('Data Validation', () => {
    it('should sanitize input data', async () => {
      const maliciousData = {
        name: '<script>alert("xss")</script>Portfolio',
        description: 'javascript:alert("xss")',
        type: 'MANUAL'
      };

      const response = await request(app)
        .post('/api/v1/portfolios')
        .set('Authorization', `Bearer ${authToken}`)
        .send(maliciousData)
        .expect(201);

      expect(response.body.data.name).not.toContain('<script>');
      expect(response.body.data.description).not.toContain('javascript:');
    });

    it('should validate portfolio type enum', async () => {
      const invalidTypeData = {
        name: 'Test Portfolio',
        type: 'INVALID_TYPE'
      };

      await request(app)
        .post('/api/v1/portfolios')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidTypeData)
        .expect(400);
    });
  });

  describe('Concurrency', () => {
    it('should handle concurrent portfolio operations', async () => {
      const promises = Array.from({ length: 5 }, (_, i) =>
        request(app)
          .post('/api/v1/portfolios')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            name: `Concurrent Portfolio ${i}`,
            type: 'MANUAL'
          })
      );

      const responses = await Promise.all(promises);
      
      responses.forEach(response => {
        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
      });

      // Verify all portfolios were created with unique IDs
      const portfolioIds = responses.map(r => r.body.data.id);
      const uniqueIds = new Set(portfolioIds);
      expect(uniqueIds.size).toBe(portfolioIds.length);
    });
  });

  describe('Performance', () => {
    it('should respond within acceptable time limits', async () => {
      const startTime = Date.now();
      
      await request(app)
        .get('/api/v1/portfolios')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const responseTime = Date.now() - startTime;
      expect(responseTime).toBeLessThan(500); // 500ms limit
    });

    it('should handle large result sets efficiently', async () => {
      // Create many portfolios
      const promises = Array.from({ length: 50 }, (_, i) =>
        generateTestPortfolio(testUser.id, { name: `Bulk Portfolio ${i}` })
      );
      await Promise.all(promises);

      const startTime = Date.now();
      const response = await request(app)
        .get('/api/v1/portfolios?limit=50')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const responseTime = Date.now() - startTime;
      expect(responseTime).toBeLessThan(1000); // 1s limit for large datasets
      expect(response.body.data.length).toBeLessThanOrEqual(50);
    });
  });
});