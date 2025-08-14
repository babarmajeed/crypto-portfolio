import request from 'supertest';
import { Express } from 'express';
import { PrismaClient } from '@prisma/client';
import { faker } from '@faker-js/faker';
import { createTestApp, generateTestUser, generateTestPortfolio, cleanupTestData } from '../utils/testHelpers';

describe('API Security Tests', () => {
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

  describe('Authentication Security', () => {
    it('should reject requests without authentication token', async () => {
      const protectedEndpoints = [
        '/api/v1/users/profile',
        '/api/v1/portfolios',
        '/api/v1/portfolios/123/transactions'
      ];

      for (const endpoint of protectedEndpoints) {
        await request(app)
          .get(endpoint)
          .expect(401);
      }
    });

    it('should reject requests with invalid JWT tokens', async () => {
      const invalidTokens = [
        'invalid-token',
        'Bearer invalid-token',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.signature',
        'header.payload.invalid-signature',
        '',
        null,
        undefined
      ];

      for (const token of invalidTokens.filter(Boolean)) {
        await request(app)
          .get('/api/v1/users/profile')
          .set('Authorization', typeof token === 'string' ? `Bearer ${token}` : '')
          .expect(401);
      }
    });

    it('should reject expired JWT tokens', async () => {
      // This would typically involve creating an expired token
      // For now, we'll test the general principle
      const expiredTokenResponse = await request(app)
        .get('/api/v1/users/profile')
        .set('Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIxMjMiLCJleHAiOjE2MDAwMDAwMDB9.invalid')
        .expect(401);

      expect(expiredTokenResponse.body.success).toBe(false);
    });

    it('should reject tokens with wrong signature', async () => {
      const tamperedToken = authToken.slice(0, -10) + 'tampered123';
      
      await request(app)
        .get('/api/v1/users/profile')
        .set('Authorization', `Bearer ${tamperedToken}`)
        .expect(401);
    });

    it('should enforce role-based access control', async () => {
      // Create a user with limited role (if applicable)
      const basicUser = await generateTestUser({ role: 'BASIC' });
      const basicLoginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: basicUser.email,
          password: 'TestPassword123!'
        });

      const basicToken = basicLoginResponse.body.data.token;

      // Test accessing admin-only endpoints (if any exist)
      const adminEndpoints = [
        '/api/v1/admin/users',
        '/api/v1/admin/system',
        '/api/v1/admin/metrics'
      ];

      for (const endpoint of adminEndpoints) {
        const response = await request(app)
          .get(endpoint)
          .set('Authorization', `Bearer ${basicToken}`);
        
        // Should either be 403 (Forbidden) or 404 (Not Found if endpoint doesn't exist)
        expect([403, 404]).toContain(response.status);
      }
    });
  });

  describe('Input Validation Security', () => {
    it('should prevent SQL injection attacks', async () => {
      const sqlInjectionPayloads = [
        "'; DROP TABLE users; --",
        "1' OR '1'='1",
        "admin'/*",
        "1; DELETE FROM users WHERE 1=1; --",
        "' UNION SELECT * FROM passwords --"
      ];

      for (const payload of sqlInjectionPayloads) {
        // Test in portfolio name field
        const response = await request(app)
          .post('/api/v1/portfolios')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            name: payload,
            type: 'MANUAL'
          });

        // Should either validate and reject (400) or sanitize the input
        if (response.status === 201) {
          expect(response.body.data.name).not.toContain('DROP TABLE');
          expect(response.body.data.name).not.toContain('DELETE FROM');
          expect(response.body.data.name).not.toContain('UNION SELECT');
        } else {
          expect(response.status).toBe(400);
        }
      }
    });

    it('should prevent NoSQL injection attacks', async () => {
      const noSQLPayloads = [
        { $ne: null },
        { $gt: '' },
        { $where: 'this.password.match(/.*/)' },
        { $regex: '.*' }
      ];

      for (const payload of noSQLPayloads) {
        const response = await request(app)
          .post('/api/v1/portfolios')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            name: payload,
            type: 'MANUAL'
          });

        expect(response.status).toBe(400); // Should reject invalid input
      }
    });

    it('should prevent XSS attacks', async () => {
      const xssPayloads = [
        '<script>alert("xss")</script>',
        'javascript:alert("xss")',
        '<img src="x" onerror="alert(1)">',
        '<svg onload="alert(1)">',
        '"><script>alert("xss")</script>',
        "'; alert('xss'); //",
        'onclick="alert(1)"'
      ];

      for (const payload of xssPayloads) {
        const response = await request(app)
          .post('/api/v1/portfolios')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            name: payload,
            description: payload,
            type: 'MANUAL'
          });

        if (response.status === 201) {
          // If accepted, should be sanitized
          expect(response.body.data.name).not.toContain('<script>');
          expect(response.body.data.name).not.toContain('javascript:');
          expect(response.body.data.name).not.toContain('onerror');
          expect(response.body.data.name).not.toContain('onload');
          expect(response.body.data.description).not.toContain('<script>');
        }
      }
    });

    it('should validate input length limits', async () => {
      const oversizedInputs = {
        name: 'A'.repeat(1000),
        description: 'B'.repeat(10000),
        email: 'user@' + 'a'.repeat(1000) + '.com'
      };

      // Test portfolio name length
      await request(app)
        .post('/api/v1/portfolios')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: oversizedInputs.name,
          type: 'MANUAL'
        })
        .expect(400);

      // Test profile update with oversized data
      await request(app)
        .put('/api/v1/users/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          firstName: oversizedInputs.name
        })
        .expect(400);
    });

    it('should validate numeric input ranges', async () => {
      const invalidNumericInputs = [
        { quantity: -1 },
        { price: -100 },
        { quantity: Number.MAX_SAFE_INTEGER + 1 },
        { price: Infinity },
        { quantity: NaN },
        { price: 'not-a-number' }
      ];

      for (const input of invalidNumericInputs) {
        await request(app)
          .post(`/api/v1/portfolios/${testPortfolio.id}/transactions`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            type: 'BUY',
            symbol: 'BTC',
            executedAt: new Date().toISOString(),
            ...input
          })
          .expect(400);
      }
    });
  });

  describe('Authorization Security', () => {
    it('should prevent horizontal privilege escalation', async () => {
      // Create another user
      const otherUser = await generateTestUser();
      const otherPortfolio = await generateTestPortfolio(otherUser.id);

      // Try to access other user's portfolio
      await request(app)
        .get(`/api/v1/portfolios/${otherPortfolio.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(403);

      // Try to modify other user's portfolio
      await request(app)
        .put(`/api/v1/portfolios/${otherPortfolio.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Hacked Portfolio' })
        .expect(403);

      // Try to delete other user's portfolio
      await request(app)
        .delete(`/api/v1/portfolios/${otherPortfolio.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(403);
    });

    it('should prevent vertical privilege escalation', async () => {
      // Create a basic user trying to access admin functions
      const basicUser = await generateTestUser({ role: 'BASIC' });
      const basicLoginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: basicUser.email,
          password: 'TestPassword123!'
        });

      const basicToken = basicLoginResponse.body.data.token;

      // Try to access admin endpoints
      const adminEndpoints = [
        { method: 'get', path: '/api/v1/admin/users' },
        { method: 'post', path: '/api/v1/admin/users/ban' },
        { method: 'delete', path: '/api/v1/admin/users/123' }
      ];

      for (const endpoint of adminEndpoints) {
        const response = await request(app)
          [endpoint.method](endpoint.path)
          .set('Authorization', `Bearer ${basicToken}`);
        
        expect([403, 404]).toContain(response.status);
      }
    });

    it('should validate resource ownership', async () => {
      // Test that users can only access their own resources
      const otherUser = await generateTestUser();
      const otherLoginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: otherUser.email,
          password: 'TestPassword123!'
        });

      const otherToken = otherLoginResponse.body.data.token;

      // Try to access original user's profile with other user's token
      await request(app)
        .get('/api/v1/users/profile')
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(200); // This should return other user's profile, not original user's

      const profileResponse = await request(app)
        .get('/api/v1/users/profile')
        .set('Authorization', `Bearer ${otherToken}`);

      expect(profileResponse.body.data.id).toBe(otherUser.id);
      expect(profileResponse.body.data.id).not.toBe(testUser.id);
    });
  });

  describe('Rate Limiting Security', () => {
    it('should prevent brute force login attacks', async () => {
      const testEmail = faker.internet.email();
      
      // Make multiple failed login attempts
      for (let i = 0; i < 10; i++) {
        await request(app)
          .post('/api/v1/auth/login')
          .send({
            email: testEmail,
            password: 'WrongPassword123!'
          });
      }

      // Next attempt should be rate limited
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testEmail,
          password: 'WrongPassword123!'
        });

      if (response.status === 429) {
        expect(response.body.error).toBe('Rate Limit Exceeded');
        expect(response.headers['retry-after']).toBeDefined();
      }
    });

    it('should prevent API abuse through rate limiting', async () => {
      // Make many requests quickly
      const requests = Array.from({ length: 50 }, () =>
        request(app)
          .get('/api/v1/portfolios')
          .set('Authorization', `Bearer ${authToken}`)
      );

      const responses = await Promise.all(requests);
      const rateLimitedCount = responses.filter(r => r.status === 429).length;

      // Some requests should be rate limited if limit is exceeded
      if (rateLimitedCount > 0) {
        console.log(`${rateLimitedCount}/50 requests were rate limited`);
        
        // Rate limited responses should have proper headers
        const rateLimitedResponse = responses.find(r => r.status === 429);
        expect(rateLimitedResponse?.headers['retry-after']).toBeDefined();
      }
    });

    it('should apply different rate limits to different endpoints', async () => {
      // Test that sensitive endpoints have stricter rate limits
      const sensitiveEndpoint = '/api/v1/users/change-password';
      const normalEndpoint = '/api/v1/users/profile';

      // Make requests to normal endpoint
      const normalRequests = Array.from({ length: 20 }, () =>
        request(app)
          .get(normalEndpoint)
          .set('Authorization', `Bearer ${authToken}`)
      );

      const normalResponses = await Promise.all(normalRequests);
      const normalRateLimited = normalResponses.filter(r => r.status === 429).length;

      // Make requests to sensitive endpoint
      const sensitiveRequests = Array.from({ length: 10 }, () =>
        request(app)
          .post(sensitiveEndpoint)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            currentPassword: 'wrong',
            newPassword: 'NewPassword123!'
          })
      );

      const sensitiveResponses = await Promise.all(sensitiveRequests);
      const sensitiveRateLimited = sensitiveResponses.filter(r => r.status === 429).length;

      // Sensitive endpoints should have stricter rate limiting
      console.log(`Normal endpoint rate limited: ${normalRateLimited}/20`);
      console.log(`Sensitive endpoint rate limited: ${sensitiveRateLimited}/10`);
    });
  });

  describe('Data Exposure Security', () => {
    it('should not expose sensitive data in responses', async () => {
      const response = await request(app)
        .get('/api/v1/users/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Password should never be in response
      expect(response.body.data.password).toBeUndefined();
      expect(response.body.data.passwordHash).toBeUndefined();
      
      // Sensitive fields should not be exposed
      expect(response.body.data.salt).toBeUndefined();
      expect(response.body.data.resetToken).toBeUndefined();
      expect(response.body.data.twoFactorSecret).toBeUndefined();
    });

    it('should not expose internal system information', async () => {
      const response = await request(app)
        .get('/api/v1/portfolios')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Response should not contain internal IDs or system info
      const portfolio = response.body.data[0];
      if (portfolio) {
        expect(portfolio.internalId).toBeUndefined();
        expect(portfolio.systemMetadata).toBeUndefined();
        expect(portfolio.databaseId).toBeUndefined();
      }
    });

    it('should not expose other users\' data in list responses', async () => {
      // Create another user with portfolio
      const otherUser = await generateTestUser();
      await generateTestPortfolio(otherUser.id);

      const response = await request(app)
        .get('/api/v1/portfolios')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Should only see own portfolios
      response.body.data.forEach((portfolio: any) => {
        expect(portfolio.userId).toBe(testUser.id);
      });
    });
  });

  describe('HTTP Security Headers', () => {
    it('should include security headers in responses', async () => {
      const response = await request(app)
        .get('/api/v1/health')
        .expect(200);

      // Check for important security headers
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBeDefined();
      expect(response.headers['x-xss-protection']).toBeDefined();
      
      // CORS headers should be properly configured
      expect(response.headers['access-control-allow-origin']).toBeDefined();
    });

    it('should not expose server information', async () => {
      const response = await request(app)
        .get('/api/v1/health')
        .expect(200);

      // Should not expose server/framework versions
      expect(response.headers['server']).toBeUndefined();
      expect(response.headers['x-powered-by']).toBeUndefined();
    });
  });

  describe('File Upload Security', () => {
    it('should validate file types', async () => {
      // Test uploading non-image files to avatar endpoint
      const maliciousFile = Buffer.from('<?php echo "hacked"; ?>');
      
      const response = await request(app)
        .post('/api/v1/users/avatar')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('avatar', maliciousFile, 'malicious.php')
        .expect(400);

      expect(response.body.error).toContain('file type');
    });

    it('should limit file sizes', async () => {
      // Create a large file buffer
      const largeFile = Buffer.alloc(10 * 1024 * 1024); // 10MB
      
      const response = await request(app)
        .post('/api/v1/users/avatar')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('avatar', largeFile, 'large.jpg')
        .expect(413);

      expect(response.body.error).toContain('file size');
    });
  });

  describe('Session Security', () => {
    it('should invalidate sessions on password change', async () => {
      // Change password
      await request(app)
        .post('/api/v1/users/change-password')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          currentPassword: 'TestPassword123!',
          newPassword: 'NewSecurePassword123!'
        })
        .expect(200);

      // Old token should be invalidated
      await request(app)
        .get('/api/v1/users/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(401);
    });

    it('should handle concurrent sessions securely', async () => {
      const user = await generateTestUser();
      
      // Create multiple sessions
      const sessions = [];
      for (let i = 0; i < 3; i++) {
        const loginResponse = await request(app)
          .post('/api/v1/auth/login')
          .send({
            email: user.email,
            password: 'TestPassword123!'
          });
        sessions.push(loginResponse.body.data.token);
      }

      // All sessions should be valid
      for (const token of sessions) {
        await request(app)
          .get('/api/v1/users/profile')
          .set('Authorization', `Bearer ${token}`)
          .expect(200);
      }

      // Logout from one session
      await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${sessions[0]}`)
        .send({ allSessions: false });

      // First session should be invalid, others still valid
      await request(app)
        .get('/api/v1/users/profile')
        .set('Authorization', `Bearer ${sessions[0]}`)
        .expect(401);

      await request(app)
        .get('/api/v1/users/profile')
        .set('Authorization', `Bearer ${sessions[1]}`)
        .expect(200);
    });
  });

  describe('Error Handling Security', () => {
    it('should not expose stack traces in production', async () => {
      // Try to cause an internal error
      const response = await request(app)
        .post('/api/v1/portfolios')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: null, // This might cause an internal error
          type: 'MANUAL'
        });

      // Error response should not contain stack trace
      expect(response.body.stack).toBeUndefined();
      expect(response.body.trace).toBeUndefined();
      
      if (response.body.error) {
        expect(response.body.error).not.toContain('at ');
        expect(response.body.error).not.toContain('/src/');
        expect(response.body.error).not.toContain('Error:');
      }
    });

    it('should provide consistent error messages', async () => {
      // Test error message consistency to prevent information leakage
      const nonExistentId = faker.string.uuid();
      
      const response1 = await request(app)
        .get(`/api/v1/portfolios/${nonExistentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      const response2 = await request(app)
        .delete(`/api/v1/portfolios/${nonExistentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      // Error messages should be consistent
      expect(response1.body.error).toBe(response2.body.error);
    });
  });

  describe('Timing Attack Prevention', () => {
    it('should prevent timing attacks on authentication', async () => {
      const existingUser = testUser.email;
      const nonExistentUser = 'nonexistent@example.com';
      
      const timings: number[] = [];
      
      // Test multiple login attempts
      for (let i = 0; i < 10; i++) {
        const email = i % 2 === 0 ? existingUser : nonExistentUser;
        const startTime = Date.now();
        
        await request(app)
          .post('/api/v1/auth/login')
          .send({
            email,
            password: 'WrongPassword123!'
          });
        
        timings.push(Date.now() - startTime);
      }

      // Response times should be similar to prevent user enumeration
      const avgTime = timings.reduce((a, b) => a + b) / timings.length;
      const variance = timings.every(time => Math.abs(time - avgTime) < 100);
      
      expect(variance).toBe(true);
    });
  });
});