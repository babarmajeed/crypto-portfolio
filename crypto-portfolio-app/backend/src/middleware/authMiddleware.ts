import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { PrismaClient, UserRole } from '@prisma/client';
import { auditService } from '../services/auditService';

const prisma = new PrismaClient();

interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    email: string;
    role: UserRole;
  };
}

interface JWTPayload {
  userId: string;
  email: string;
  role: UserRole;
  iat: number;
  exp: number;
}

class AuthMiddleware {
  private readonly JWT_SECRET = process.env.JWT_SECRET!;

  // Verify JWT token and add user to request
  authenticate = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Access token required' });
        return;
      }

      const token = authHeader.substring(7);

      try {
        const decoded = jwt.verify(token, this.JWT_SECRET) as JWTPayload;

        // Verify user still exists and is active
        const user = await prisma.user.findUnique({
          where: { id: decoded.userId },
          select: {
            id: true,
            email: true,
            role: true,
            isActive: true,
            isEmailVerified: true
          }
        });

        if (!user) {
          res.status(401).json({ error: 'User not found' });
          return;
        }

        if (!user.isActive) {
          res.status(401).json({ error: 'Account deactivated' });
          return;
        }

        if (!user.isEmailVerified) {
          res.status(401).json({ error: 'Email not verified' });
          return;
        }

        // Add user info to request
        req.user = {
          userId: user.id,
          email: user.email,
          role: user.role
        };

        next();
      } catch (jwtError) {
        if (jwtError instanceof jwt.TokenExpiredError) {
          res.status(401).json({ error: 'Token expired' });
        } else if (jwtError instanceof jwt.JsonWebTokenError) {
          res.status(401).json({ error: 'Invalid token' });
        } else {
          res.status(401).json({ error: 'Authentication failed' });
        }
        return;
      }
    } catch (error) {
      console.error('Authentication middleware error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };

  // Optional authentication - doesn't fail if no token
  optionalAuthenticate = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      next();
      return;
    }

    try {
      await this.authenticate(req, res, next);
    } catch (error) {
      // Continue without authentication on error
      next();
    }
  };

  // Role-based authorization
  authorize = (allowedRoles: UserRole[]) => {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      if (!allowedRoles.includes(req.user.role)) {
        // Log unauthorized access attempt
        auditService.log({
          userId: req.user.userId,
          action: 'UNAUTHORIZED_ACCESS_ATTEMPT',
          resource: req.originalUrl,
          details: { 
            userRole: req.user.role, 
            requiredRoles: allowedRoles 
          },
          ipAddress: this.getClientIP(req),
          userAgent: req.headers['user-agent']
        });

        res.status(403).json({ error: 'Insufficient permissions' });
        return;
      }

      next();
    };
  };

  // Admin only access
  requireAdmin = this.authorize([UserRole.ADMIN]);

  // Premium or Admin access
  requirePremium = this.authorize([UserRole.PREMIUM, UserRole.ADMIN]);

  // Any authenticated user
  requireAuth = this.authenticate;

  // Validate 2FA token for sensitive operations
  requireTwoFactor = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const user = await prisma.user.findUnique({
        where: { id: req.user.userId },
        select: { isTwoFactorEnabled: true }
      });

      if (!user) {
        res.status(401).json({ error: 'User not found' });
        return;
      }

      if (user.isTwoFactorEnabled) {
        const twoFactorToken = req.headers['x-2fa-token'] as string;
        
        if (!twoFactorToken) {
          res.status(400).json({ 
            error: 'Two-factor authentication required',
            requiresTwoFactor: true
          });
          return;
        }

        // Note: This would typically verify the 2FA token
        // For now, we'll assume it's handled by the auth service
      }

      next();
    } catch (error) {
      console.error('Two-factor middleware error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };

  // Check if user owns the resource
  requireOwnership = (resourceIdParam: string = 'id') => {
    return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
      try {
        if (!req.user) {
          res.status(401).json({ error: 'Authentication required' });
          return;
        }

        const resourceId = req.params[resourceIdParam];
        if (!resourceId) {
          res.status(400).json({ error: 'Resource ID required' });
          return;
        }

        // Determine resource type from URL
        let isOwner = false;
        const path = req.route.path;

        if (path.includes('/portfolio')) {
          const portfolio = await prisma.portfolio.findUnique({
            where: { id: resourceId },
            select: { userId: true }
          });
          isOwner = portfolio?.userId === req.user.userId;
        } else if (path.includes('/transaction')) {
          const transaction = await prisma.transaction.findUnique({
            where: { id: resourceId },
            include: { portfolio: { select: { userId: true } } }
          });
          isOwner = transaction?.portfolio.userId === req.user.userId;
        } else if (path.includes('/alert')) {
          const alert = await prisma.priceAlert.findUnique({
            where: { id: resourceId },
            select: { userId: true }
          });
          isOwner = alert?.userId === req.user.userId;
        }

        // Admins can access any resource
        if (!isOwner && req.user.role !== UserRole.ADMIN) {
          // Log unauthorized access attempt
          await auditService.log({
            userId: req.user.userId,
            action: 'UNAUTHORIZED_RESOURCE_ACCESS',
            resource: `${req.method} ${req.originalUrl}`,
            details: { resourceId },
            ipAddress: this.getClientIP(req),
            userAgent: req.headers['user-agent']
          });

          res.status(403).json({ error: 'Access denied' });
          return;
        }

        next();
      } catch (error) {
        console.error('Ownership middleware error:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    };
  };

  // Session validation
  validateSession = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        next();
        return;
      }

      const sessionToken = req.headers['x-session-id'] as string;
      const ipAddress = this.getClientIP(req);

      if (sessionToken) {
        const session = await prisma.loginSession.findUnique({
          where: { sessionId: sessionToken },
          select: {
            id: true,
            userId: true,
            isActive: true,
            expiresAt: true,
            ipAddress: true
          }
        });

        if (!session || 
            !session.isActive || 
            session.expiresAt < new Date() ||
            session.userId !== req.user.userId) {
          
          // Log suspicious session activity
          await auditService.log({
            userId: req.user.userId,
            action: 'INVALID_SESSION_DETECTED',
            resource: 'LoginSession',
            details: { sessionToken, ipAddress },
            ipAddress,
            userAgent: req.headers['user-agent']
          });

          res.status(401).json({ error: 'Invalid session' });
          return;
        }

        // Check for IP address changes (potential session hijacking)
        if (session.ipAddress !== ipAddress) {
          await auditService.log({
            userId: req.user.userId,
            action: 'SESSION_IP_MISMATCH',
            resource: 'LoginSession',
            details: { 
              sessionIp: session.ipAddress, 
              requestIp: ipAddress 
            },
            ipAddress,
            userAgent: req.headers['user-agent']
          });

          // Optional: Force re-authentication on IP mismatch
          // res.status(401).json({ error: 'Session security check failed' });
          // return;
        }
      }

      next();
    } catch (error) {
      console.error('Session validation error:', error);
      next(); // Continue on error to avoid breaking the flow
    }
  };

  private getClientIP(req: Request): string {
    return (
      req.headers['x-forwarded-for'] as string ||
      req.headers['x-real-ip'] as string ||
      req.connection.remoteAddress ||
      'unknown'
    ).split(',')[0].trim();
  }
}

export const authMiddleware = new AuthMiddleware();
export type { AuthenticatedRequest };