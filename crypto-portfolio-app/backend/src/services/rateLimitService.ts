import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxAttempts: number; // Maximum attempts allowed in the window
}

class RateLimitService {
  private readonly configs = {
    login: { windowMs: 60 * 1000, maxAttempts: 10 }, // 10 attempts per minute
    registration: { windowMs: 60 * 60 * 1000, maxAttempts: 5 }, // 5 registrations per hour
    passwordReset: { windowMs: 60 * 60 * 1000, maxAttempts: 3 }, // 3 reset requests per hour
    twoFactor: { windowMs: 60 * 1000, maxAttempts: 5 }, // 5 2FA attempts per minute
    api: { windowMs: 60 * 1000, maxAttempts: 100 } // 100 API calls per minute
  };

  async checkRate(key: string, type: keyof typeof this.configs): Promise<boolean> {
    const config = this.configs[type];
    const now = new Date();
    const windowStart = new Date(now.getTime() - config.windowMs);

    // Clean up expired entries
    await this.cleanupExpiredEntries();

    // Find existing entry
    const existing = await prisma.rateLimitEntry.findUnique({
      where: { key: `${type}:${key}` }
    });

    if (!existing) {
      // Create new entry
      await prisma.rateLimitEntry.create({
        data: {
          key: `${type}:${key}`,
          attempts: 1,
          expiresAt: new Date(now.getTime() + config.windowMs)
        }
      });
      return true;
    }

    // Check if entry is still valid
    if (existing.expiresAt < now) {
      // Reset expired entry
      await prisma.rateLimitEntry.update({
        where: { id: existing.id },
        data: {
          attempts: 1,
          expiresAt: new Date(now.getTime() + config.windowMs)
        }
      });
      return true;
    }

    // Check if limit exceeded
    if (existing.attempts >= config.maxAttempts) {
      return false;
    }

    // Increment attempts
    await prisma.rateLimitEntry.update({
      where: { id: existing.id },
      data: {
        attempts: existing.attempts + 1
      }
    });

    return true;
  }

  async checkLoginRate(ipAddress: string): Promise<void> {
    const allowed = await this.checkRate(ipAddress, 'login');
    if (!allowed) {
      throw new Error('Too many login attempts. Please try again later.');
    }
  }

  async checkRegistrationRate(ipAddress: string): Promise<void> {
    const allowed = await this.checkRate(ipAddress, 'registration');
    if (!allowed) {
      throw new Error('Too many registration attempts. Please try again later.');
    }
  }

  async checkPasswordResetRate(ipAddress: string): Promise<void> {
    const allowed = await this.checkRate(ipAddress, 'passwordReset');
    if (!allowed) {
      throw new Error('Too many password reset requests. Please try again later.');
    }
  }

  async checkTwoFactorRate(userId: string): Promise<void> {
    const allowed = await this.checkRate(userId, 'twoFactor');
    if (!allowed) {
      throw new Error('Too many two-factor authentication attempts. Please try again later.');
    }
  }

  async checkApiRate(identifier: string): Promise<void> {
    const allowed = await this.checkRate(identifier, 'api');
    if (!allowed) {
      throw new Error('API rate limit exceeded. Please try again later.');
    }
  }

  async recordFailedLogin(ipAddress: string): Promise<void> {
    // This is handled by checkLoginRate, but we can add additional tracking here
    const key = `failed_login:${ipAddress}`;
    const now = new Date();
    
    try {
      const existing = await prisma.rateLimitEntry.findUnique({
        where: { key }
      });

      if (existing && existing.expiresAt > now) {
        await prisma.rateLimitEntry.update({
          where: { id: existing.id },
          data: { attempts: existing.attempts + 1 }
        });
      } else {
        await prisma.rateLimitEntry.upsert({
          where: { key },
          create: {
            key,
            attempts: 1,
            expiresAt: new Date(now.getTime() + 60 * 60 * 1000) // 1 hour
          },
          update: {
            attempts: 1,
            expiresAt: new Date(now.getTime() + 60 * 60 * 1000)
          }
        });
      }
    } catch (error) {
      console.error('Error recording failed login:', error);
    }
  }

  async getFailedLoginCount(ipAddress: string): Promise<number> {
    const key = `failed_login:${ipAddress}`;
    const entry = await prisma.rateLimitEntry.findUnique({
      where: { key }
    });

    if (!entry || entry.expiresAt < new Date()) {
      return 0;
    }

    return entry.attempts;
  }

  async resetRate(key: string, type: keyof typeof this.configs): Promise<void> {
    await prisma.rateLimitEntry.delete({
      where: { key: `${type}:${key}` }
    }).catch(() => {
      // Ignore if entry doesn't exist
    });
  }

  async getRemainingAttempts(key: string, type: keyof typeof this.configs): Promise<number> {
    const config = this.configs[type];
    const entry = await prisma.rateLimitEntry.findUnique({
      where: { key: `${type}:${key}` }
    });

    if (!entry || entry.expiresAt < new Date()) {
      return config.maxAttempts;
    }

    return Math.max(0, config.maxAttempts - entry.attempts);
  }

  async getTimeUntilReset(key: string, type: keyof typeof this.configs): Promise<number> {
    const entry = await prisma.rateLimitEntry.findUnique({
      where: { key: `${type}:${key}` }
    });

    if (!entry || entry.expiresAt < new Date()) {
      return 0;
    }

    return Math.max(0, entry.expiresAt.getTime() - Date.now());
  }

  private async cleanupExpiredEntries(): Promise<void> {
    try {
      await prisma.rateLimitEntry.deleteMany({
        where: {
          expiresAt: { lt: new Date() }
        }
      });
    } catch (error) {
      console.error('Error cleaning up expired rate limit entries:', error);
    }
  }

  // Middleware function for Express
  createMiddleware(type: keyof typeof this.configs, keyExtractor: (req: any) => string) {
    return async (req: any, res: any, next: any) => {
      try {
        const key = keyExtractor(req);
        const allowed = await this.checkRate(key, type);
        
        if (!allowed) {
          const remaining = await this.getRemainingAttempts(key, type);
          const timeUntilReset = await this.getTimeUntilReset(key, type);
          
          return res.status(429).json({
            error: 'Rate limit exceeded',
            retryAfter: Math.ceil(timeUntilReset / 1000),
            remaining: remaining
          });
        }
        
        next();
      } catch (error) {
        console.error('Rate limiting error:', error);
        next(); // Allow request to proceed on rate limiting errors
      }
    };
  }
}

export const rateLimitService = new RateLimitService();