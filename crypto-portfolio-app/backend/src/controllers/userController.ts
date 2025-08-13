import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { authService } from '../services/authService';
import { totpService } from '../services/totpService';
import { auditService } from '../services/auditService';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// Validation schemas
export const updateProfileSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(50, 'First name too long'),
  lastName: z.string().min(1, 'Last name is required').max(50, 'Last name too long')
});

export const updatePreferencesSchema = z.object({
  currency: z.string().min(3).max(3).optional(),
  timezone: z.string().optional(),
  emailNotifications: z.boolean().optional(),
  pushNotifications: z.boolean().optional(),
  priceAlerts: z.boolean().optional(),
  portfolioUpdates: z.boolean().optional(),
  hideBalances: z.boolean().optional(),
  sharePortfolio: z.boolean().optional()
});

export const changeEmailSchema = z.object({
  newEmail: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required')
});

export const deleteAccountSchema = z.object({
  password: z.string().min(1, 'Password is required'),
  confirmation: z.literal('DELETE', {
    errorMap: () => ({ message: 'Please type DELETE to confirm account deletion' })
  })
});

// Helper functions
const getClientInfo = (req: Request) => ({
  ipAddress: req.ip || req.connection.remoteAddress || 'unknown',
  userAgent: req.headers['user-agent']
});

export class UserController {
  async getProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.userId;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          isEmailVerified: true,
          isTwoFactorEnabled: true,
          lastLogin: true,
          createdAt: true,
          updatedAt: true,
          preferences: true,
          oauthAccounts: {
            select: {
              provider: true,
              createdAt: true
            }
          }
        }
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      res.status(200).json({
        success: true,
        data: { user }
      });
    } catch (error) {
      next(error);
    }
  }

  async updateProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const validatedData = updateProfileSchema.parse(req.body);
      const userId = req.user?.userId;
      const { ipAddress, userAgent } = getClientInfo(req);

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
      }

      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
          firstName: validatedData.firstName,
          lastName: validatedData.lastName,
          updatedAt: new Date()
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          isEmailVerified: true,
          isTwoFactorEnabled: true,
          lastLogin: true,
          createdAt: true,
          updatedAt: true
        }
      });

      // Log audit event
      await auditService.log(
        'PROFILE_UPDATED',
        userId,
        'User profile updated',
        ipAddress,
        userAgent
      );

      res.status(200).json({
        success: true,
        message: 'Profile updated successfully',
        data: { user: updatedUser }
      });
    } catch (error) {
      next(error);
    }
  }

  async getPreferences(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.userId;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
      }

      let preferences = await prisma.userPreferences.findUnique({
        where: { userId }
      });

      // Create default preferences if they don't exist
      if (!preferences) {
        preferences = await prisma.userPreferences.create({
          data: { userId }
        });
      }

      res.status(200).json({
        success: true,
        data: { preferences }
      });
    } catch (error) {
      next(error);
    }
  }

  async updatePreferences(req: Request, res: Response, next: NextFunction) {
    try {
      const validatedData = updatePreferencesSchema.parse(req.body);
      const userId = req.user?.userId;
      const { ipAddress, userAgent } = getClientInfo(req);

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
      }

      const preferences = await prisma.userPreferences.upsert({
        where: { userId },
        update: {
          ...validatedData,
          updatedAt: new Date()
        },
        create: {
          userId,
          ...validatedData
        }
      });

      // Log audit event
      await auditService.log(
        'PREFERENCES_UPDATED',
        userId,
        'User preferences updated',
        ipAddress,
        userAgent
      );

      res.status(200).json({
        success: true,
        message: 'Preferences updated successfully',
        data: { preferences }
      });
    } catch (error) {
      next(error);
    }
  }

  async changeEmail(req: Request, res: Response, next: NextFunction) {
    try {
      const validatedData = changeEmailSchema.parse(req.body);
      const userId = req.user?.userId;
      const { ipAddress, userAgent } = getClientInfo(req);

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
      }

      const user = await prisma.user.findUnique({
        where: { id: userId }
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(validatedData.password, user.password);
      if (!isPasswordValid) {
        return res.status(400).json({
          success: false,
          message: 'Invalid password'
        });
      }

      // Check if new email is already taken
      const existingUser = await prisma.user.findUnique({
        where: { email: validatedData.newEmail.toLowerCase() }
      });

      if (existingUser && existingUser.id !== userId) {
        return res.status(400).json({
          success: false,
          message: 'Email address is already in use'
        });
      }

      // Update email and mark as unverified
      await prisma.user.update({
        where: { id: userId },
        data: {
          email: validatedData.newEmail.toLowerCase(),
          isEmailVerified: false,
          emailVerificationToken: null,
          emailVerificationExpires: null
        }
      });

      // Trigger email verification for new email
      await authService.resendVerificationEmail(validatedData.newEmail, ipAddress);

      // Log audit event
      await auditService.log(
        'EMAIL_CHANGED',
        userId,
        `Email changed from ${user.email} to ${validatedData.newEmail}`,
        ipAddress,
        userAgent
      );

      res.status(200).json({
        success: true,
        message: 'Email updated successfully. Please check your new email for verification.'
      });
    } catch (error) {
      next(error);
    }
  }

  async getSecuritySettings(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.userId;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          isTwoFactorEnabled: true,
          lastLogin: true,
          failedLoginAttempts: true,
          accountLockedUntil: true,
          oauthAccounts: {
            select: {
              provider: true,
              createdAt: true
            }
          }
        }
      });

      // Get recent login sessions
      const recentSessions = await prisma.loginSession.findMany({
        where: { userId },
        orderBy: { loginAt: 'desc' },
        take: 10,
        select: {
          id: true,
          sessionId: true,
          ipAddress: true,
          userAgent: true,
          deviceInfo: true,
          loginAt: true,
          logoutAt: true,
          isActive: true
        }
      });

      res.status(200).json({
        success: true,
        data: {
          security: user,
          recentSessions
        }
      });
    } catch (error) {
      next(error);
    }
  }

  async getAuditLog(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.userId;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const skip = (page - 1) * limit;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
      }

      const [auditLogs, total] = await Promise.all([
        prisma.auditLog.findMany({
          where: { userId },
          orderBy: { timestamp: 'desc' },
          skip,
          take: limit,
          select: {
            id: true,
            action: true,
            resource: true,
            details: true,
            ipAddress: true,
            timestamp: true
          }
        }),
        prisma.auditLog.count({
          where: { userId }
        })
      ]);

      res.status(200).json({
        success: true,
        data: {
          auditLogs,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }

  async terminateAllSessions(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.userId;
      const currentSessionId = req.headers['x-session-id'] as string;
      const { ipAddress, userAgent } = getClientInfo(req);

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
      }

      // End all login sessions except current one
      const terminatedSessions = await prisma.loginSession.updateMany({
        where: {
          userId,
          isActive: true,
          ...(currentSessionId && { sessionId: { not: currentSessionId } })
        },
        data: {
          isActive: false,
          logoutAt: new Date()
        }
      });

      // Revoke all refresh tokens except current one
      await prisma.refreshToken.updateMany({
        where: { userId },
        data: { isRevoked: true }
      });

      // Log audit event
      await auditService.log(
        'ALL_SESSIONS_TERMINATED',
        userId,
        `Terminated ${terminatedSessions.count} active sessions`,
        ipAddress,
        userAgent
      );

      res.status(200).json({
        success: true,
        message: `Successfully terminated ${terminatedSessions.count} active sessions`
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteAccount(req: Request, res: Response, next: NextFunction) {
    try {
      const validatedData = deleteAccountSchema.parse(req.body);
      const userId = req.user?.userId;
      const { ipAddress, userAgent } = getClientInfo(req);

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
      }

      const user = await prisma.user.findUnique({
        where: { id: userId }
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Verify password (only if user has a password)
      if (user.password) {
        const isPasswordValid = await bcrypt.compare(validatedData.password, user.password);
        if (!isPasswordValid) {
          return res.status(400).json({
            success: false,
            message: 'Invalid password'
          });
        }
      }

      // Log audit event before deletion
      await auditService.log(
        'ACCOUNT_DELETED',
        userId,
        'User account deleted',
        ipAddress,
        userAgent
      );

      // Soft delete or hard delete based on business requirements
      // For this implementation, we'll do a hard delete
      await prisma.$transaction(async (tx) => {
        // Delete related records first
        await tx.refreshToken.deleteMany({ where: { userId } });
        await tx.loginSession.deleteMany({ where: { userId } });
        await tx.oAuthAccount.deleteMany({ where: { userId } });
        await tx.userPreferences.deleteMany({ where: { userId } });
        await tx.priceAlert.deleteMany({ where: { userId } });
        await tx.transaction.deleteMany({ 
          where: { 
            portfolio: { userId } 
          } 
        });
        await tx.holding.deleteMany({ 
          where: { 
            portfolio: { userId } 
          } 
        });
        await tx.portfolio.deleteMany({ where: { userId } });
        
        // Finally delete the user
        await tx.user.delete({ where: { id: userId } });
      });

      res.status(200).json({
        success: true,
        message: 'Account deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  async exportData(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.userId;
      const { ipAddress, userAgent } = getClientInfo(req);

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
      }

      // Fetch all user data
      const userData = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          preferences: true,
          portfolios: {
            include: {
              holdings: {
                include: {
                  asset: true
                }
              },
              transactions: {
                include: {
                  asset: true
                }
              }
            }
          },
          priceAlerts: {
            include: {
              asset: true
            }
          },
          oauthAccounts: {
            select: {
              provider: true,
              createdAt: true
            }
          },
          auditLogs: {
            orderBy: { timestamp: 'desc' },
            take: 1000 // Limit to last 1000 entries
          }
        }
      });

      if (!userData) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Remove sensitive data
      const { password, twoFactorSecret, emailVerificationToken, passwordResetToken, ...safeUserData } = userData;

      // Log audit event
      await auditService.log(
        'DATA_EXPORT_REQUESTED',
        userId,
        'User data export requested',
        ipAddress,
        userAgent
      );

      res.status(200).json({
        success: true,
        data: {
          exportedAt: new Date().toISOString(),
          userData: safeUserData
        }
      });
    } catch (error) {
      next(error);
    }
  }

  async getStats(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.userId;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
      }

      const [
        portfoliosCount,
        transactionsCount,
        priceAlertsCount,
        activeSessions,
        lastLogin,
        accountAge
      ] = await Promise.all([
        prisma.portfolio.count({ where: { userId } }),
        prisma.transaction.count({ 
          where: { 
            portfolio: { userId } 
          } 
        }),
        prisma.priceAlert.count({ where: { userId, isActive: true } }),
        prisma.loginSession.count({ 
          where: { 
            userId, 
            isActive: true,
            expiresAt: { gt: new Date() }
          } 
        }),
        prisma.loginSession.findFirst({ 
          where: { userId },
          orderBy: { loginAt: 'desc' }
        }),
        prisma.user.findUnique({ 
          where: { id: userId },
          select: { createdAt: true }
        })
      ]);

      const stats = {
        portfolios: portfoliosCount,
        transactions: transactionsCount,
        activePriceAlerts: priceAlertsCount,
        activeSessions,
        lastLogin: lastLogin?.loginAt || null,
        accountCreated: accountAge?.createdAt || null,
        accountAgeInDays: accountAge 
          ? Math.floor((Date.now() - accountAge.createdAt.getTime()) / (1000 * 60 * 60 * 24))
          : 0
      };

      res.status(200).json({
        success: true,
        data: { stats }
      });
    } catch (error) {
      next(error);
    }
  }
}

export const userController = new UserController();