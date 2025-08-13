import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authService } from '../services/authService';
import { totpService } from '../services/totpService';
import { rateLimitService } from '../services/rateLimitService';

// Validation schemas
export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, 
      'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
  firstName: z.string().min(1, 'First name is required').max(50, 'First name too long'),
  lastName: z.string().min(1, 'Last name is required').max(50, 'Last name too long'),
  confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword']
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().optional().default(false),
  totpCode: z.string().optional()
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, 
      'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
  confirmPassword: z.string()
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword']
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address')
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, 
      'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
  confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword']
});

export const verifyTotpSchema = z.object({
  code: z.string().regex(/^\d{6}$/, 'TOTP code must be 6 digits')
});

export const enableTotpSchema = z.object({
  code: z.string().regex(/^\d{6}$/, 'TOTP code must be 6 digits')
});

export const disableTotpSchema = z.object({
  password: z.string().min(1, 'Password is required'),
  code: z.string().optional()
});

// Helper functions
const getClientInfo = (req: Request) => ({
  ipAddress: req.ip || req.connection.remoteAddress || 'unknown',
  userAgent: req.headers['user-agent'],
  deviceInfo: req.headers['x-device-info'] as string || undefined
});

export class AuthController {
  async register(req: Request, res: Response, next: NextFunction) {
    try {
      const validatedData = registerSchema.parse(req.body);
      const { ipAddress, userAgent } = getClientInfo(req);

      // Check registration rate limit
      await rateLimitService.checkRateLimit(`register:${ipAddress}`, 3, 15 * 60); // 3 attempts per 15 minutes

      const result = await authService.register(
        validatedData,
        ipAddress,
        userAgent
      );

      res.status(201).json({
        success: true,
        message: result.message,
        data: {
          user: result.user
        }
      });
    } catch (error) {
      next(error);
    }
  }

  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const validatedData = loginSchema.parse(req.body);
      const { ipAddress, userAgent, deviceInfo } = getClientInfo(req);

      const result = await authService.login(
        validatedData,
        ipAddress,
        userAgent,
        deviceInfo
      );

      // If two-factor authentication is required
      if (result.requiresTwoFactor) {
        return res.status(200).json({
          success: true,
          requiresTwoFactor: true,
          message: result.message
        });
      }

      // Set refresh token as httpOnly cookie
      res.cookie('refreshToken', result.tokens.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
      });

      res.status(200).json({
        success: true,
        message: 'Login successful',
        data: {
          user: result.user,
          accessToken: result.tokens.accessToken,
          sessionId: result.sessionId
        }
      });
    } catch (error) {
      next(error);
    }
  }

  async refreshToken(req: Request, res: Response, next: NextFunction) {
    try {
      const refreshToken = req.cookies.refreshToken;
      
      if (!refreshToken) {
        return res.status(401).json({
          success: false,
          message: 'Refresh token not provided'
        });
      }

      const result = await authService.refreshAccessToken(refreshToken);

      res.status(200).json({
        success: true,
        message: 'Token refreshed successfully',
        data: {
          accessToken: result.accessToken
        }
      });
    } catch (error) {
      next(error);
    }
  }

  async logout(req: Request, res: Response, next: NextFunction) {
    try {
      const refreshToken = req.cookies.refreshToken;
      const sessionId = req.headers['x-session-id'] as string;
      const { ipAddress, userAgent } = getClientInfo(req);

      if (refreshToken) {
        await authService.logout(refreshToken, sessionId);
      }

      // Clear refresh token cookie
      res.clearCookie('refreshToken');

      res.status(200).json({
        success: true,
        message: 'Logged out successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  async verifyEmail(req: Request, res: Response, next: NextFunction) {
    try {
      const { token } = req.params;
      
      if (!token) {
        return res.status(400).json({
          success: false,
          message: 'Verification token is required'
        });
      }

      const result = await authService.verifyEmail(token);

      res.status(200).json({
        success: true,
        message: result.message
      });
    } catch (error) {
      next(error);
    }
  }

  async resendVerificationEmail(req: Request, res: Response, next: NextFunction) {
    try {
      const { email } = req.body;
      const { ipAddress } = getClientInfo(req);
      
      if (!email) {
        return res.status(400).json({
          success: false,
          message: 'Email is required'
        });
      }

      const result = await authService.resendVerificationEmail(email, ipAddress);

      res.status(200).json({
        success: true,
        message: result.message
      });
    } catch (error) {
      next(error);
    }
  }

  async forgotPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const validatedData = forgotPasswordSchema.parse(req.body);
      const { ipAddress, userAgent } = getClientInfo(req);

      const result = await authService.forgotPassword(validatedData, ipAddress, userAgent);

      res.status(200).json({
        success: true,
        message: result.message
      });
    } catch (error) {
      next(error);
    }
  }

  async resetPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const validatedData = resetPasswordSchema.parse(req.body);
      const { ipAddress, userAgent } = getClientInfo(req);

      const result = await authService.resetPassword(validatedData, ipAddress, userAgent);

      res.status(200).json({
        success: true,
        message: result.message
      });
    } catch (error) {
      next(error);
    }
  }

  async changePassword(req: Request, res: Response, next: NextFunction) {
    try {
      const validatedData = changePasswordSchema.parse(req.body);
      const userId = req.user?.userId;
      const { ipAddress, userAgent } = getClientInfo(req);

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
      }

      const result = await authService.changePassword(userId, validatedData, ipAddress, userAgent);

      res.status(200).json({
        success: true,
        message: result.message
      });
    } catch (error) {
      next(error);
    }
  }

  async setupTwoFactor(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.userId;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
      }

      const result = await authService.setupTwoFactor(userId);

      res.status(200).json({
        success: true,
        message: result.message,
        data: {
          secret: result.secret,
          qrCode: result.qrCode,
          backupCodes: result.backupCodes
        }
      });
    } catch (error) {
      next(error);
    }
  }

  async enableTwoFactor(req: Request, res: Response, next: NextFunction) {
    try {
      const validatedData = enableTotpSchema.parse(req.body);
      const userId = req.user?.userId;
      const { ipAddress, userAgent } = getClientInfo(req);

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
      }

      const result = await authService.enableTwoFactor(userId, validatedData.code, ipAddress, userAgent);

      res.status(200).json({
        success: true,
        message: result.message
      });
    } catch (error) {
      next(error);
    }
  }

  async disableTwoFactor(req: Request, res: Response, next: NextFunction) {
    try {
      const validatedData = disableTotpSchema.parse(req.body);
      const userId = req.user?.userId;
      const { ipAddress, userAgent } = getClientInfo(req);

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
      }

      const result = await authService.disableTwoFactor(
        userId, 
        validatedData.password, 
        ipAddress, 
        userAgent
      );

      res.status(200).json({
        success: true,
        message: result.message
      });
    } catch (error) {
      next(error);
    }
  }

  async getUserSessions(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.userId;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
      }

      const sessions = await authService.getUserSessions(userId);
      const currentSessionId = req.headers['x-session-id'] as string;

      // Mark current session
      const sessionsWithCurrent = sessions.map(session => ({
        ...session,
        current: session.sessionId === currentSessionId
      }));

      res.status(200).json({
        success: true,
        data: {
          sessions: sessionsWithCurrent
        }
      });
    } catch (error) {
      next(error);
    }
  }

  async terminateSession(req: Request, res: Response, next: NextFunction) {
    try {
      const { sessionId } = req.params;
      const userId = req.user?.userId;
      const { ipAddress, userAgent } = getClientInfo(req);

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
      }

      if (!sessionId) {
        return res.status(400).json({
          success: false,
          message: 'Session ID is required'
        });
      }

      const result = await authService.terminateSession(userId, sessionId, ipAddress, userAgent);

      res.status(200).json({
        success: true,
        message: result.message
      });
    } catch (error) {
      next(error);
    }
  }

  async getProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.userId;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
      }

      // This would typically fetch user profile from database
      // For now, return the user data from the token
      res.status(200).json({
        success: true,
        data: {
          user: req.user
        }
      });
    } catch (error) {
      next(error);
    }
  }
}

export const authController = new AuthController();