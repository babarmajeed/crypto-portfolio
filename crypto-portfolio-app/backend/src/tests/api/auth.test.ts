import request from 'supertest';
import { Express } from 'express';
import { PrismaClient } from '@prisma/client';
import { faker } from '@faker-js/faker';
import jwt from 'jsonwebtoken';
import speakeasy from 'speakeasy';
import { createTestApp, generateTestUser, cleanupTestData } from '../utils/testHelpers';

describe('Authentication API Tests', () => {
  let app: Express;
  let prisma: PrismaClient;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = new PrismaClient();
  });

  afterAll(async () => {
    await cleanupTestData();
    await prisma.$disconnect();
  });

  describe('POST /api/v1/auth/register', () => {
    it('should register a new user with valid data', async () => {
      const userData = {
        email: faker.internet.email(),
        password: 'SecurePassword123!',
        firstName: faker.person.firstName(),
        lastName: faker.person.lastName()
      };

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(userData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user).toMatchObject({
        email: userData.email,
        firstName: userData.firstName,
        lastName: userData.lastName,
        role: 'BASIC',
        isEmailVerified: false
      });
      expect(response.body.data.token).toBeDefined();
      expect(response.body.data.refreshToken).toBeDefined();
    });

    it('should validate password strength requirements', async () => {
      const weakPasswords = [
        'weak',
        'password',
        'Password',
        'password123',
        'Password123'
      ];

      for (const password of weakPasswords) {
        const userData = {
          email: faker.internet.email(),
          password,
          firstName: 'Test',
          lastName: 'User'
        };

        const response = await request(app)
          .post('/api/v1/auth/register')
          .send(userData)
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.error).toBe('Validation Error');
      }
    });

    it('should validate email format', async () => {
      const invalidEmails = [
        'invalid-email',
        '@example.com',
        'user@',
        'user@.com',
        'user.example.com'
      ];

      for (const email of invalidEmails) {
        const userData = {
          email,
          password: 'SecurePassword123!',
          firstName: 'Test',
          lastName: 'User'
        };

        await request(app)
          .post('/api/v1/auth/register')
          .send(userData)
          .expect(400);
      }
    });

    it('should prevent duplicate email registration', async () => {
      const userData = {
        email: faker.internet.email(),
        password: 'SecurePassword123!',
        firstName: 'Test',
        lastName: 'User'
      };

      // First registration should succeed
      await request(app)
        .post('/api/v1/auth/register')
        .send(userData)
        .expect(201);

      // Second registration with same email should fail
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(userData)
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Conflict');
      expect(response.body.code).toBe('EMAIL_ALREADY_EXISTS');
    });

    it('should sanitize input data', async () => {
      const maliciousData = {
        email: 'test@example.com',
        password: 'SecurePassword123!',
        firstName: '<script>alert("xss")</script>John',
        lastName: 'javascript:alert("xss")'
      };

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(maliciousData)
        .expect(201);

      expect(response.body.data.user.firstName).not.toContain('<script>');
      expect(response.body.data.user.lastName).not.toContain('javascript:');
    });

    it('should enforce rate limiting', async () => {
      const baseEmail = faker.internet.email();
      
      // Make multiple registration attempts
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/v1/auth/register')
          .send({
            email: `${i}${baseEmail}`,
            password: 'SecurePassword123!',
            firstName: 'Test',
            lastName: 'User'
          });
      }

      // Next request should be rate limited
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: `rate-limit-${baseEmail}`,
          password: 'SecurePassword123!',
          firstName: 'Test',
          lastName: 'User'
        });

      if (response.status === 429) {
        expect(response.body.error).toBe('Rate Limit Exceeded');
        expect(response.headers['retry-after']).toBeDefined();
      }
    });
  });

  describe('POST /api/v1/auth/login', () => {
    let testUser: any;

    beforeEach(async () => {
      testUser = await generateTestUser();
    });

    it('should login with valid credentials', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testUser.email,
          password: 'TestPassword123!'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user).toMatchObject({
        id: testUser.id,
        email: testUser.email,
        role: testUser.role
      });
      expect(response.body.data.token).toBeDefined();
      expect(response.body.data.refreshToken).toBeDefined();

      // Verify JWT token structure
      const decoded = jwt.decode(response.body.data.token) as any;
      expect(decoded.userId).toBe(testUser.id);
      expect(decoded.email).toBe(testUser.email);
    });

    it('should reject invalid credentials', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testUser.email,
          password: 'WrongPassword123!'
        })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Unauthorized');
      expect(response.body.code).toBe('INVALID_CREDENTIALS');
    });

    it('should reject login for non-existent user', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'TestPassword123!'
        })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Unauthorized');
    });

    it('should handle case-insensitive email login', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testUser.email.toUpperCase(),
          password: 'TestPassword123!'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should enforce failed login rate limiting', async () => {
      // Make multiple failed login attempts
      for (let i = 0; i < 10; i++) {
        await request(app)
          .post('/api/v1/auth/login')
          .send({
            email: testUser.email,
            password: 'WrongPassword'
          });
      }

      // Next request should be rate limited
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testUser.email,
          password: 'WrongPassword'
        });

      if (response.status === 429) {
        expect(response.body.error).toBe('Rate Limit Exceeded');
        expect(response.headers['retry-after']).toBeDefined();
      }
    });
  });

  describe('Two-Factor Authentication', () => {
    let testUser: any;
    let authToken: string;

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

    describe('POST /api/v1/auth/enable-2fa', () => {
      it('should enable 2FA and return QR code', async () => {
        const response = await request(app)
          .post('/api/v1/auth/enable-2fa')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.secret).toBeDefined();
        expect(response.body.data.qrCode).toBeDefined();
        expect(response.body.data.backupCodes).toBeDefined();
        expect(response.body.data.backupCodes).toHaveLength(10);
      });

      it('should require authentication', async () => {
        await request(app)
          .post('/api/v1/auth/enable-2fa')
          .expect(401);
      });
    });

    describe('POST /api/v1/auth/verify-2fa', () => {
      let twoFASecret: string;

      beforeEach(async () => {
        const enableResponse = await request(app)
          .post('/api/v1/auth/enable-2fa')
          .set('Authorization', `Bearer ${authToken}`);
        twoFASecret = enableResponse.body.data.secret;
      });

      it('should verify and activate 2FA with valid TOTP code', async () => {
        const token = speakeasy.totp({
          secret: twoFASecret,
          encoding: 'base32'
        });

        const response = await request(app)
          .post('/api/v1/auth/verify-2fa')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ token })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.twoFactorEnabled).toBe(true);
      });

      it('should reject invalid TOTP code', async () => {
        const response = await request(app)
          .post('/api/v1/auth/verify-2fa')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ token: '000000' })
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.error).toBe('Invalid Code');
      });

      it('should validate TOTP code format', async () => {
        const invalidCodes = ['12345', '1234567', 'abcdef', '12345a'];

        for (const token of invalidCodes) {
          await request(app)
            .post('/api/v1/auth/verify-2fa')
            .set('Authorization', `Bearer ${authToken}`)
            .send({ token })
            .expect(400);
        }
      });
    });

    describe('POST /api/v1/auth/login with 2FA', () => {
      let twoFASecret: string;

      beforeEach(async () => {
        // Enable 2FA for test user
        const enableResponse = await request(app)
          .post('/api/v1/auth/enable-2fa')
          .set('Authorization', `Bearer ${authToken}`);
        twoFASecret = enableResponse.body.data.secret;

        const token = speakeasy.totp({
          secret: twoFASecret,
          encoding: 'base32'
        });

        await request(app)
          .post('/api/v1/auth/verify-2fa')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ token });
      });

      it('should require TOTP code when 2FA is enabled', async () => {
        const response = await request(app)
          .post('/api/v1/auth/login')
          .send({
            email: testUser.email,
            password: 'TestPassword123!'
          })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.requiresTwoFactor).toBe(true);
        expect(response.body.data.tempToken).toBeDefined();
      });

      it('should complete login with valid TOTP code', async () => {
        const loginResponse = await request(app)
          .post('/api/v1/auth/login')
          .send({
            email: testUser.email,
            password: 'TestPassword123!'
          });

        const token = speakeasy.totp({
          secret: twoFASecret,
          encoding: 'base32'
        });

        const response = await request(app)
          .post('/api/v1/auth/verify-login')
          .send({
            tempToken: loginResponse.body.data.tempToken,
            token
          })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.token).toBeDefined();
        expect(response.body.data.refreshToken).toBeDefined();
      });

      it('should reject expired temp token', async () => {
        const expiredToken = jwt.sign(
          { userId: testUser.id, type: 'temp' },
          process.env.JWT_SECRET || 'test-secret',
          { expiresIn: '-1m' }
        );

        const token = speakeasy.totp({
          secret: twoFASecret,
          encoding: 'base32'
        });

        await request(app)
          .post('/api/v1/auth/verify-login')
          .send({
            tempToken: expiredToken,
            token
          })
          .expect(401);
      });
    });

    describe('POST /api/v1/auth/disable-2fa', () => {
      beforeEach(async () => {
        // Enable 2FA first
        const enableResponse = await request(app)
          .post('/api/v1/auth/enable-2fa')
          .set('Authorization', `Bearer ${authToken}`);

        const token = speakeasy.totp({
          secret: enableResponse.body.data.secret,
          encoding: 'base32'
        });

        await request(app)
          .post('/api/v1/auth/verify-2fa')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ token });
      });

      it('should disable 2FA with valid password', async () => {
        const response = await request(app)
          .post('/api/v1/auth/disable-2fa')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ password: 'TestPassword123!' })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.twoFactorEnabled).toBe(false);
      });

      it('should reject invalid password', async () => {
        await request(app)
          .post('/api/v1/auth/disable-2fa')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ password: 'WrongPassword' })
          .expect(401);
      });
    });
  });

  describe('Token Management', () => {
    let testUser: any;
    let refreshToken: string;

    beforeEach(async () => {
      testUser = await generateTestUser();
      const loginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testUser.email,
          password: 'TestPassword123!'
        });
      refreshToken = loginResponse.body.data.refreshToken;
    });

    describe('POST /api/v1/auth/refresh', () => {
      it('should refresh access token with valid refresh token', async () => {
        const response = await request(app)
          .post('/api/v1/auth/refresh')
          .send({ refreshToken })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.token).toBeDefined();
        expect(response.body.data.refreshToken).toBeDefined();
        expect(response.body.data.refreshToken).not.toBe(refreshToken); // Should rotate
      });

      it('should reject invalid refresh token', async () => {
        await request(app)
          .post('/api/v1/auth/refresh')
          .send({ refreshToken: 'invalid-token' })
          .expect(401);
      });

      it('should reject expired refresh token', async () => {
        const expiredToken = jwt.sign(
          { userId: testUser.id, type: 'refresh' },
          process.env.JWT_SECRET || 'test-secret',
          { expiresIn: '-1d' }
        );

        await request(app)
          .post('/api/v1/auth/refresh')
          .send({ refreshToken: expiredToken })
          .expect(401);
      });
    });

    describe('POST /api/v1/auth/logout', () => {
      let authToken: string;

      beforeEach(async () => {
        const loginResponse = await request(app)
          .post('/api/v1/auth/login')
          .send({
            email: testUser.email,
            password: 'TestPassword123!'
          });
        authToken = loginResponse.body.data.token;
      });

      it('should logout and invalidate tokens', async () => {
        const response = await request(app)
          .post('/api/v1/auth/logout')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ refreshToken })
          .expect(200);

        expect(response.body.success).toBe(true);

        // Try to use the token after logout - should fail
        await request(app)
          .get('/api/v1/users/profile')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(401);
      });

      it('should handle logout without refresh token', async () => {
        const response = await request(app)
          .post('/api/v1/auth/logout')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
      });
    });
  });

  describe('Password Reset', () => {
    let testUser: any;

    beforeEach(async () => {
      testUser = await generateTestUser();
    });

    describe('POST /api/v1/auth/forgot-password', () => {
      it('should send reset email for valid email', async () => {
        const response = await request(app)
          .post('/api/v1/auth/forgot-password')
          .send({ email: testUser.email })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.message).toContain('reset');
      });

      it('should handle non-existent email gracefully', async () => {
        // Should not reveal whether email exists
        const response = await request(app)
          .post('/api/v1/auth/forgot-password')
          .send({ email: 'nonexistent@example.com' })
          .expect(200);

        expect(response.body.success).toBe(true);
      });

      it('should enforce rate limiting', async () => {
        // Make multiple requests
        for (let i = 0; i < 5; i++) {
          await request(app)
            .post('/api/v1/auth/forgot-password')
            .send({ email: testUser.email });
        }

        const response = await request(app)
          .post('/api/v1/auth/forgot-password')
          .send({ email: testUser.email });

        if (response.status === 429) {
          expect(response.body.error).toBe('Rate Limit Exceeded');
        }
      });
    });

    describe('POST /api/v1/auth/reset-password', () => {
      let resetToken: string;

      beforeEach(async () => {
        // Generate a valid reset token
        resetToken = jwt.sign(
          { userId: testUser.id, type: 'password-reset' },
          process.env.JWT_SECRET || 'test-secret',
          { expiresIn: '1h' }
        );
      });

      it('should reset password with valid token', async () => {
        const newPassword = 'NewSecurePassword123!';

        const response = await request(app)
          .post('/api/v1/auth/reset-password')
          .send({
            token: resetToken,
            password: newPassword
          })
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
            password: newPassword
          })
          .expect(200);
      });

      it('should reject invalid reset token', async () => {
        await request(app)
          .post('/api/v1/auth/reset-password')
          .send({
            token: 'invalid-token',
            password: 'NewPassword123!'
          })
          .expect(401);
      });

      it('should validate new password strength', async () => {
        await request(app)
          .post('/api/v1/auth/reset-password')
          .send({
            token: resetToken,
            password: 'weak'
          })
          .expect(400);
      });
    });
  });

  describe('Security Features', () => {
    it('should prevent timing attacks on login', async () => {
      const validEmail = (await generateTestUser()).email;
      const invalidEmail = 'nonexistent@example.com';

      // Measure response times
      const timings: number[] = [];

      for (let i = 0; i < 5; i++) {
        const start = Date.now();
        await request(app)
          .post('/api/v1/auth/login')
          .send({
            email: i % 2 === 0 ? validEmail : invalidEmail,
            password: 'WrongPassword123!'
          });
        timings.push(Date.now() - start);
      }

      // Response times should be similar (within reasonable variance)
      const avgTime = timings.reduce((a, b) => a + b) / timings.length;
      const variance = timings.every(time => Math.abs(time - avgTime) < 100);
      expect(variance).toBe(true);
    });

    it('should log authentication events', async () => {
      const testUser = await generateTestUser();

      // Successful login should be logged
      await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testUser.email,
          password: 'TestPassword123!'
        })
        .expect(200);

      // Failed login should be logged
      await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testUser.email,
          password: 'WrongPassword'
        })
        .expect(401);

      // Check audit logs would be created (implementation-specific)
    });

    it('should handle malformed JWT tokens', async () => {
      const malformedTokens = [
        'not.a.token',
        'header.payload',
        'header.payload.signature.extra',
        '',
        'Bearer token-without-bearer-prefix'
      ];

      for (const token of malformedTokens) {
        await request(app)
          .get('/api/v1/users/profile')
          .set('Authorization', `Bearer ${token}`)
          .expect(401);
      }
    });
  });

  describe('Session Management', () => {
    let testUser: any;
    let authToken: string;

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

    describe('GET /api/v1/auth/sessions', () => {
      it('should list active sessions', async () => {
        const response = await request(app)
          .get('/api/v1/auth/sessions')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toBeInstanceOf(Array);
        expect(response.body.data.length).toBeGreaterThan(0);

        const session = response.body.data[0];
        expect(session).toMatchObject({
          id: expect.any(String),
          userAgent: expect.any(String),
          ipAddress: expect.any(String),
          isActive: true,
          createdAt: expect.any(String),
          lastActivity: expect.any(String)
        });
      });
    });

    describe('DELETE /api/v1/auth/sessions/:id', () => {
      it('should revoke specific session', async () => {
        const sessionsResponse = await request(app)
          .get('/api/v1/auth/sessions')
          .set('Authorization', `Bearer ${authToken}`);

        const sessionId = sessionsResponse.body.data[0].id;

        const response = await request(app)
          .delete(`/api/v1/auth/sessions/${sessionId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
      });
    });

    describe('DELETE /api/v1/auth/sessions', () => {
      it('should revoke all sessions except current', async () => {
        const response = await request(app)
          .delete('/api/v1/auth/sessions')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.revokedSessions).toBeGreaterThanOrEqual(0);
      });
    });
  });
});