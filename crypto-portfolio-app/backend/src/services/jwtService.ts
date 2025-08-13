import jwt from 'jsonwebtoken';
import { User } from '@prisma/client';

export interface JWTPayload {
  userId: string;
  email: string;
  role: string;
  isEmailVerified: boolean;
  iat?: number;
  exp?: number;
}

export class JWTService {
  private readonly JWT_SECRET = process.env.JWT_SECRET!;
  private readonly JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET!;
  private readonly ACCESS_TOKEN_EXPIRES = '15m';
  private readonly REFRESH_TOKEN_EXPIRES = '7d';

  async generateAccessToken(user: Pick<User, 'id' | 'email' | 'role' | 'isEmailVerified'>): Promise<string> {
    const payload: JWTPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      isEmailVerified: user.isEmailVerified
    };

    return jwt.sign(payload, this.JWT_SECRET, {
      expiresIn: this.ACCESS_TOKEN_EXPIRES,
      issuer: 'crypto-portfolio-api',
      audience: 'crypto-portfolio-app'
    });
  }

  async generateRefreshToken(userId: string): Promise<string> {
    const payload = {
      userId,
      type: 'refresh'
    };

    return jwt.sign(payload, this.JWT_REFRESH_SECRET, {
      expiresIn: this.REFRESH_TOKEN_EXPIRES,
      issuer: 'crypto-portfolio-api',
      audience: 'crypto-portfolio-app'
    });
  }

  async verifyAccessToken(token: string): Promise<JWTPayload> {
    try {
      const decoded = jwt.verify(token, this.JWT_SECRET, {
        issuer: 'crypto-portfolio-api',
        audience: 'crypto-portfolio-app'
      }) as JWTPayload;

      return decoded;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error('Access token expired');
      } else if (error instanceof jwt.JsonWebTokenError) {
        throw new Error('Invalid access token');
      }
      throw new Error('Token verification failed');
    }
  }

  async verifyRefreshToken(token: string): Promise<{ userId: string; type: string }> {
    try {
      const decoded = jwt.verify(token, this.JWT_REFRESH_SECRET, {
        issuer: 'crypto-portfolio-api',
        audience: 'crypto-portfolio-app'
      }) as { userId: string; type: string };

      if (decoded.type !== 'refresh') {
        throw new Error('Invalid token type');
      }

      return decoded;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error('Refresh token expired');
      } else if (error instanceof jwt.JsonWebTokenError) {
        throw new Error('Invalid refresh token');
      }
      throw new Error('Token verification failed');
    }
  }

  generateTempToken(userId: string, purpose: string, expiresIn: string = '10m'): string {
    const payload = {
      userId,
      type: 'temp',
      purpose
    };

    return jwt.sign(payload, this.JWT_SECRET, {
      expiresIn,
      issuer: 'crypto-portfolio-api',
      audience: 'crypto-portfolio-app'
    });
  }

  verifyTempToken(token: string, expectedPurpose: string): { userId: string } {
    try {
      const decoded = jwt.verify(token, this.JWT_SECRET, {
        issuer: 'crypto-portfolio-api',
        audience: 'crypto-portfolio-app'
      }) as { userId: string; type: string; purpose: string };

      if (decoded.type !== 'temp' || decoded.purpose !== expectedPurpose) {
        throw new Error('Invalid token type or purpose');
      }

      return { userId: decoded.userId };
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error('Temporary token expired');
      } else if (error instanceof jwt.JsonWebTokenError) {
        throw new Error('Invalid temporary token');
      }
      throw new Error('Token verification failed');
    }
  }

  getTokenExpiry(token: string): Date | null {
    try {
      const decoded = jwt.decode(token) as { exp?: number };
      if (decoded?.exp) {
        return new Date(decoded.exp * 1000);
      }
      return null;
    } catch {
      return null;
    }
  }

  isTokenExpired(token: string): boolean {
    const expiry = this.getTokenExpiry(token);
    if (!expiry) return true;
    return expiry.getTime() <= Date.now();
  }
}

export const jwtService = new JWTService();