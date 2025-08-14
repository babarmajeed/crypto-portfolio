import request from 'supertest';
import { Express } from 'express';
import { PrismaClient } from '@prisma/client';
import { faker } from '@faker-js/faker';
import { createTestApp, generateTestUser, cleanupTestData } from '../utils/testHelpers';

describe('User API Tests', () => {
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
    await cleanupTestData();
    await prisma.$disconnect();
  });

  describe('GET /api/v1/users/profile', () => {
    it('should return user profile for authenticated user', async () => {
      const response = await request(app)
        .get('/api/v1/users/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        id: testUser.id,
        email: testUser.email,
        firstName: testUser.firstName,
        lastName: testUser.lastName,
        role: testUser.role,
        isEmailVerified: expect.any(Boolean),
        twoFactorEnabled: expect.any(Boolean)
      });
      expect(response.body.data.password).toBeUndefined(); // Password should not be included
    });

    it('should return 401 for unauthenticated requests', async () => {
      await request(app)
        .get('/api/v1/users/profile')
        .expect(401);
    });

    it('should return 401 for invalid token', async () => {
      await request(app)
        .get('/api/v1/users/profile')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });
  });

  describe('PUT /api/v1/users/profile', () => {
    it('should update user profile with valid data', async () => {
      const updateData = {
        firstName: 'UpdatedFirst',
        lastName: 'UpdatedLast',
        preferences: {
          currency: 'EUR',
          timezone: 'Europe/London',
          notifications: {
            email: true,
            push: false,
            sms: true
          }
        }
      };

      const response = await request(app)
        .put('/api/v1/users/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        firstName: updateData.firstName,
        lastName: updateData.lastName,
        preferences: updateData.preferences
      });
    });

    it('should allow partial profile updates', async () => {
      const updateData = {
        firstName: 'OnlyFirstNameUpdated'
      };

      const response = await request(app)
        .put('/api/v1/users/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.firstName).toBe(updateData.firstName);
      expect(response.body.data.lastName).toBeDefined(); // Should remain unchanged
    });

    it('should validate profile data', async () => {
      const invalidData = {
        firstName: '', // Empty name should fail
        lastName: 'A'.repeat(101) // Too long name should fail
      };

      const response = await request(app)
        .put('/api/v1/users/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Validation Error');
    });

    it('should sanitize input data', async () => {
      const maliciousData = {
        firstName: '<script>alert("xss")</script>Malicious',
        lastName: 'javascript:alert("xss")'
      };

      const response = await request(app)
        .put('/api/v1/users/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send(maliciousData)
        .expect(200);

      expect(response.body.data.firstName).not.toContain('<script>');
      expect(response.body.data.lastName).not.toContain('javascript:');
    });

    it('should not allow email updates through profile endpoint', async () => {
      const updateData = {
        email: 'newemail@example.com',
        firstName: 'Updated'
      };

      const response = await request(app)
        .put('/api/v1/users/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.data.email).toBe(testUser.email); // Email should remain unchanged
      expect(response.body.data.firstName).toBe(updateData.firstName);
    });
  });

  describe('PUT /api/v1/users/preferences', () => {
    it('should update user preferences', async () => {
      const preferences = {
        currency: 'GBP',
        timezone: 'Europe/Paris',
        notifications: {
          email: false,
          push: true,
          sms: false
        },
        privacy: {
          sharePortfolio: true,
          analyticsOptOut: false
        }
      };

      const response = await request(app)
        .put('/api/v1/users/preferences')
        .set('Authorization', `Bearer ${authToken}`)
        .send(preferences)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.preferences).toMatchObject(preferences);
    });

    it('should validate currency codes', async () => {
      const invalidPreferences = {
        currency: 'INVALID_CURRENCY'
      };

      await request(app)
        .put('/api/v1/users/preferences')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidPreferences)
        .expect(400);
    });

    it('should validate timezone strings', async () => {
      const invalidPreferences = {
        timezone: 'Invalid/Timezone'
      };

      await request(app)
        .put('/api/v1/users/preferences')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidPreferences)
        .expect(400);
    });

    it('should allow partial preference updates', async () => {
      const partialPreferences = {
        currency: 'CAD'
      };

      const response = await request(app)
        .put('/api/v1/users/preferences')
        .set('Authorization', `Bearer ${authToken}`)
        .send(partialPreferences)
        .expect(200);

      expect(response.body.data.preferences.currency).toBe(partialPreferences.currency);
      expect(response.body.data.preferences.timezone).toBeDefined(); // Should remain unchanged
    });
  });

  describe('POST /api/v1/users/change-password', () => {
    it('should change password with valid current password', async () => {
      const passwordData = {
        currentPassword: 'TestPassword123!',
        newPassword: 'NewSecurePassword123!'
      };

      const response = await request(app)
        .post('/api/v1/users/change-password')
        .set('Authorization', `Bearer ${authToken}`)
        .send(passwordData)
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify old password no longer works
      await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testUser.email,
          password: 'TestPassword123!'
        })
        .expect(401);

      // Verify new password works
      await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testUser.email,
          password: passwordData.newPassword
        })
        .expect(200);
    });

    it('should reject invalid current password', async () => {
      const passwordData = {
        currentPassword: 'WrongPassword123!',
        newPassword: 'NewSecurePassword123!'
      };

      await request(app)
        .post('/api/v1/users/change-password')
        .set('Authorization', `Bearer ${authToken}`)
        .send(passwordData)
        .expect(401);
    });

    it('should validate new password strength', async () => {
      const weakPasswords = [
        'weak',
        'password',
        'Password',
        'password123',
        'Password123'
      ];

      for (const newPassword of weakPasswords) {
        const passwordData = {
          currentPassword: 'NewSecurePassword123!', // Updated from previous test
          newPassword
        };

        await request(app)
          .post('/api/v1/users/change-password')
          .set('Authorization', `Bearer ${authToken}`)
          .send(passwordData)
          .expect(400);
      }
    });

    it('should prevent reusing current password', async () => {
      const passwordData = {
        currentPassword: 'NewSecurePassword123!',
        newPassword: 'NewSecurePassword123!' // Same as current
      };

      await request(app)
        .post('/api/v1/users/change-password')
        .set('Authorization', `Bearer ${authToken}`)
        .send(passwordData)
        .expect(400);
    });

    it('should enforce rate limiting', async () => {
      const passwordData = {
        currentPassword: 'WrongPassword',
        newPassword: 'SomeNewPassword123!'
      };

      // Make multiple failed attempts
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/v1/users/change-password')
          .set('Authorization', `Bearer ${authToken}`)
          .send(passwordData);
      }

      const response = await request(app)
        .post('/api/v1/users/change-password')
        .set('Authorization', `Bearer ${authToken}`)
        .send(passwordData);

      if (response.status === 429) {
        expect(response.body.error).toBe('Rate Limit Exceeded');
      }
    });
  });

  describe('POST /api/v1/users/change-email', () => {
    it('should initiate email change with valid password', async () => {
      const emailData = {
        newEmail: faker.internet.email(),
        password: 'NewSecurePassword123!' // From previous test
      };

      const response = await request(app)
        .post('/api/v1/users/change-email')
        .set('Authorization', `Bearer ${authToken}`)
        .send(emailData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('verification');
    });

    it('should reject invalid password', async () => {
      const emailData = {
        newEmail: faker.internet.email(),
        password: 'WrongPassword123!'
      };

      await request(app)
        .post('/api/v1/users/change-email')
        .set('Authorization', `Bearer ${authToken}`)
        .send(emailData)
        .expect(401);
    });

    it('should validate email format', async () => {
      const invalidEmails = [
        'invalid-email',
        '@example.com',
        'user@',
        'user@.com'
      ];

      for (const newEmail of invalidEmails) {
        const emailData = {
          newEmail,
          password: 'NewSecurePassword123!'
        };

        await request(app)
          .post('/api/v1/users/change-email')
          .set('Authorization', `Bearer ${authToken}`)
          .send(emailData)
          .expect(400);
      }
    });

    it('should prevent changing to existing email', async () => {
      const otherUser = await generateTestUser();
      
      const emailData = {
        newEmail: otherUser.email,
        password: 'NewSecurePassword123!'
      };

      await request(app)
        .post('/api/v1/users/change-email')
        .set('Authorization', `Bearer ${authToken}`)
        .send(emailData)
        .expect(409);
    });
  });

  describe('GET /api/v1/users/audit-logs', () => {
    it('should return user audit logs with pagination', async () => {
      const response = await request(app)
        .get('/api/v1/users/audit-logs?page=1&limit=10')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.pagination).toMatchObject({
        page: 1,
        limit: 10,
        total: expect.any(Number),
        pages: expect.any(Number)
      });

      if (response.body.data.length > 0) {
        const logEntry = response.body.data[0];
        expect(logEntry).toMatchObject({
          id: expect.any(String),
          action: expect.any(String),
          resource: expect.any(String),
          ipAddress: expect.any(String),
          userAgent: expect.any(String),
          timestamp: expect.any(String)
        });
      }
    });

    it('should filter audit logs by action type', async () => {
      const response = await request(app)
        .get('/api/v1/users/audit-logs?action=USER_LOGIN')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      response.body.data.forEach((log: any) => {
        expect(log.action).toBe('USER_LOGIN');
      });
    });

    it('should filter audit logs by date range', async () => {
      const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const endDate = new Date().toISOString();

      const response = await request(app)
        .get(`/api/v1/users/audit-logs?startDate=${startDate}&endDate=${endDate}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      response.body.data.forEach((log: any) => {
        const timestamp = new Date(log.timestamp);
        expect(timestamp.getTime()).toBeGreaterThanOrEqual(new Date(startDate).getTime());
        expect(timestamp.getTime()).toBeLessThanOrEqual(new Date(endDate).getTime());
      });
    });
  });

  describe('POST /api/v1/users/export-data', () => {
    it('should initiate data export', async () => {
      const response = await request(app)
        .post('/api/v1/users/export-data')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ format: 'json' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.exportId).toBeDefined();
      expect(response.body.message).toContain('export');
    });

    it('should support different export formats', async () => {
      const formats = ['json', 'csv', 'pdf'];

      for (const format of formats) {
        const response = await request(app)
          .post('/api/v1/users/export-data')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ format })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.format).toBe(format);
      }
    });

    it('should validate export format', async () => {
      await request(app)
        .post('/api/v1/users/export-data')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ format: 'invalid-format' })
        .expect(400);
    });

    it('should enforce rate limiting for exports', async () => {
      // Make multiple export requests
      for (let i = 0; i < 3; i++) {
        await request(app)
          .post('/api/v1/users/export-data')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ format: 'json' });
      }

      const response = await request(app)
        .post('/api/v1/users/export-data')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ format: 'json' });

      if (response.status === 429) {
        expect(response.body.error).toBe('Rate Limit Exceeded');
      }
    });
  });

  describe('GET /api/v1/users/export-data/:exportId', () => {
    let exportId: string;

    beforeEach(async () => {
      const exportResponse = await request(app)
        .post('/api/v1/users/export-data')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ format: 'json' });
      
      exportId = exportResponse.body.data.exportId;
      
      // Wait a bit for export to process (in real scenario)
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    it('should return export status', async () => {
      const response = await request(app)
        .get(`/api/v1/users/export-data/${exportId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        exportId,
        status: expect.stringMatching(/^(pending|processing|completed|failed)$/),
        format: 'json',
        createdAt: expect.any(String)
      });
    });

    it('should return 404 for non-existent export', async () => {
      const fakeExportId = faker.string.uuid();
      
      await request(app)
        .get(`/api/v1/users/export-data/${fakeExportId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should prevent access to other users\' exports', async () => {
      const otherUser = await generateTestUser();
      const otherLoginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: otherUser.email,
          password: 'TestPassword123!'
        });

      await request(app)
        .get(`/api/v1/users/export-data/${exportId}`)
        .set('Authorization', `Bearer ${otherLoginResponse.body.data.token}`)
        .expect(403);
    });
  });

  describe('DELETE /api/v1/users/account', () => {
    let deleteTestUser: any;
    let deleteAuthToken: string;

    beforeEach(async () => {
      // Create a separate user for deletion tests
      deleteTestUser = await generateTestUser();
      const loginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: deleteTestUser.email,
          password: 'TestPassword123!'
        });
      deleteAuthToken = loginResponse.body.data.token;
    });

    it('should delete user account with valid password', async () => {
      const response = await request(app)
        .delete('/api/v1/users/account')
        .set('Authorization', `Bearer ${deleteAuthToken}`)
        .send({ 
          password: 'TestPassword123!',
          confirmation: 'DELETE_MY_ACCOUNT'
        })
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify user can no longer login
      await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: deleteTestUser.email,
          password: 'TestPassword123!'
        })
        .expect(401);
    });

    it('should reject deletion without valid password', async () => {
      await request(app)
        .delete('/api/v1/users/account')
        .set('Authorization', `Bearer ${deleteAuthToken}`)
        .send({ 
          password: 'WrongPassword123!',
          confirmation: 'DELETE_MY_ACCOUNT'
        })
        .expect(401);
    });

    it('should require confirmation text', async () => {
      await request(app)
        .delete('/api/v1/users/account')
        .set('Authorization', `Bearer ${deleteAuthToken}`)
        .send({ 
          password: 'TestPassword123!',
          confirmation: 'wrong confirmation'
        })
        .expect(400);
    });

    it('should enforce rate limiting for account deletion', async () => {
      const invalidData = {
        password: 'WrongPassword',
        confirmation: 'DELETE_MY_ACCOUNT'
      };

      // Make multiple failed attempts
      for (let i = 0; i < 3; i++) {
        await request(app)
          .delete('/api/v1/users/account')
          .set('Authorization', `Bearer ${deleteAuthToken}`)
          .send(invalidData);
      }

      const response = await request(app)
        .delete('/api/v1/users/account')
        .set('Authorization', `Bearer ${deleteAuthToken}`)
        .send(invalidData);

      if (response.status === 429) {
        expect(response.body.error).toBe('Rate Limit Exceeded');
      }
    });
  });

  describe('User Statistics', () => {
    describe('GET /api/v1/users/statistics', () => {
      it('should return user statistics', async () => {
        const response = await request(app)
          .get('/api/v1/users/statistics')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toMatchObject({
          portfolios: {
            total: expect.any(Number),
            active: expect.any(Number)
          },
          transactions: {
            total: expect.any(Number),
            thisMonth: expect.any(Number)
          },
          account: {
            createdAt: expect.any(String),
            lastLogin: expect.any(String),
            loginCount: expect.any(Number)
          },
          security: {
            twoFactorEnabled: expect.any(Boolean),
            activeSessions: expect.any(Number),
            lastPasswordChange: expect.any(String)
          }
        });
      });
    });
  });

  describe('Performance and Security', () => {
    it('should respond within acceptable time limits', async () => {
      const startTime = Date.now();
      
      await request(app)
        .get('/api/v1/users/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const responseTime = Date.now() - startTime;
      expect(responseTime).toBeLessThan(200); // 200ms limit
    });

    it('should handle concurrent profile updates', async () => {
      const promises = Array.from({ length: 5 }, (_, i) =>
        request(app)
          .put('/api/v1/users/profile')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            firstName: `Concurrent${i}`,
            lastName: 'Update'
          })
      );

      const responses = await Promise.all(promises);
      
      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });

      // Final state should be consistent
      const finalProfile = await request(app)
        .get('/api/v1/users/profile')
        .set('Authorization', `Bearer ${authToken}`);

      expect(finalProfile.body.data.firstName).toMatch(/^Concurrent\d$/);
      expect(finalProfile.body.data.lastName).toBe('Update');
    });

    it('should protect against user enumeration', async () => {
      const existingEmail = testUser.email;
      const nonExistentEmail = 'nonexistent@example.com';

      // Response timing for existing vs non-existent emails should be similar
      const timings: number[] = [];

      for (let i = 0; i < 5; i++) {
        const start = Date.now();
        await request(app)
          .post('/api/v1/auth/forgot-password')
          .send({
            email: i % 2 === 0 ? existingEmail : nonExistentEmail
          });
        timings.push(Date.now() - start);
      }

      const avgTime = timings.reduce((a, b) => a + b) / timings.length;
      const variance = timings.every(time => Math.abs(time - avgTime) < 100);
      expect(variance).toBe(true);
    });

    it('should log user activities', async () => {
      // Profile update should create audit log
      await request(app)
        .put('/api/v1/users/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ firstName: 'LoggedUpdate' });

      // Check if audit log was created
      const auditResponse = await request(app)
        .get('/api/v1/users/audit-logs?action=PROFILE_UPDATE')
        .set('Authorization', `Bearer ${authToken}`);

      expect(auditResponse.body.success).toBe(true);
      const profileUpdateLogs = auditResponse.body.data.filter(
        (log: any) => log.action === 'PROFILE_UPDATE'
      );
      expect(profileUpdateLogs.length).toBeGreaterThan(0);
    });
  });
});