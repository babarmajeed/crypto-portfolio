import { Request, Response, NextFunction } from 'express';
import { UserRole, PrismaClient } from '@prisma/client';
import { auditService } from '../services/auditService';

const prisma = new PrismaClient();

interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    email: string;
    role: UserRole;
  };
}

// Permission definitions
export interface Permission {
  resource: string;
  action: string;
  conditions?: Record<string, any>;
}

// Role-based permissions mapping
const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  [UserRole.BASIC]: [
    // Portfolio permissions
    { resource: 'portfolio', action: 'create' },
    { resource: 'portfolio', action: 'read', conditions: { ownerOnly: true } },
    { resource: 'portfolio', action: 'update', conditions: { ownerOnly: true } },
    { resource: 'portfolio', action: 'delete', conditions: { ownerOnly: true } },
    
    // Transaction permissions
    { resource: 'transaction', action: 'create', conditions: { ownerOnly: true } },
    { resource: 'transaction', action: 'read', conditions: { ownerOnly: true } },
    { resource: 'transaction', action: 'update', conditions: { ownerOnly: true } },
    { resource: 'transaction', action: 'delete', conditions: { ownerOnly: true } },
    
    // Price alert permissions
    { resource: 'priceAlert', action: 'create' },
    { resource: 'priceAlert', action: 'read', conditions: { ownerOnly: true } },
    { resource: 'priceAlert', action: 'update', conditions: { ownerOnly: true } },
    { resource: 'priceAlert', action: 'delete', conditions: { ownerOnly: true } },
    
    // Asset permissions (read-only)
    { resource: 'asset', action: 'read' },
    
    // User profile permissions
    { resource: 'user', action: 'read', conditions: { selfOnly: true } },
    { resource: 'user', action: 'update', conditions: { selfOnly: true } },
    
    // Limitations for basic users
    { resource: 'portfolio', action: 'create', conditions: { maxCount: 3 } },
    { resource: 'priceAlert', action: 'create', conditions: { maxCount: 10 } }
  ],

  [UserRole.PREMIUM]: [
    // Inherit all basic permissions
    ...ROLE_PERMISSIONS[UserRole.BASIC].filter(p => !p.conditions?.maxCount),
    
    // Enhanced permissions for premium users
    { resource: 'portfolio', action: 'create', conditions: { maxCount: 10 } },
    { resource: 'priceAlert', action: 'create', conditions: { maxCount: 100 } },
    { resource: 'portfolio', action: 'share' }, // Premium feature
    { resource: 'analytics', action: 'read' }, // Premium analytics
    { resource: 'export', action: 'create' }, // Data export
    { resource: 'api', action: 'access' }, // API access
    
    // Advanced features
    { resource: 'webhook', action: 'create' },
    { resource: 'webhook', action: 'read', conditions: { ownerOnly: true } },
    { resource: 'webhook', action: 'update', conditions: { ownerOnly: true } },
    { resource: 'webhook', action: 'delete', conditions: { ownerOnly: true } }
  ],

  [UserRole.ADMIN]: [
    // Full access to all resources
    { resource: '*', action: '*' },
    
    // Admin-specific permissions
    { resource: 'user', action: 'create' },
    { resource: 'user', action: 'read' },
    { resource: 'user', action: 'update' },
    { resource: 'user', action: 'delete' },
    { resource: 'user', action: 'suspend' },
    { resource: 'user', action: 'activate' },
    
    { resource: 'asset', action: 'create' },
    { resource: 'asset', action: 'update' },
    { resource: 'asset', action: 'delete' },
    
    { resource: 'system', action: 'read' },
    { resource: 'system', action: 'update' },
    { resource: 'audit', action: 'read' },
    
    { resource: 'rate-limit', action: 'bypass' }
  ]
};

export class RBACMiddleware {
  // Check if user has specific permission
  hasPermission(userRole: UserRole, resource: string, action: string): boolean {
    const permissions = ROLE_PERMISSIONS[userRole] || [];
    
    // Check for wildcard permissions (admin)
    if (permissions.some(p => p.resource === '*' && p.action === '*')) {
      return true;
    }
    
    // Check for specific resource and action
    return permissions.some(p => 
      (p.resource === resource || p.resource === '*') && 
      (p.action === action || p.action === '*')
    );
  }

  // Middleware to require specific permission
  requirePermission(resource: string, action: string) {
    return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        if (!req.user) {
          return res.status(401).json({
            success: false,
            message: 'Authentication required'
          });
        }

        if (!this.hasPermission(req.user.role, resource, action)) {
          // Log unauthorized access attempt
          await auditService.log(
            'PERMISSION_DENIED',
            req.user.userId,
            `Access denied for ${resource}:${action}`,
            this.getClientIP(req),
            req.headers['user-agent']
          );

          return res.status(403).json({
            success: false,
            message: 'Insufficient permissions',
            required: `${resource}:${action}`
          });
        }

        next();
      } catch (error) {
        console.error('RBAC middleware error:', error);
        res.status(500).json({
          success: false,
          message: 'Internal server error'
        });
      }
    };
  }

  // Check resource ownership
  requireOwnership(resourceType: string, resourceIdParam: string = 'id') {
    return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        if (!req.user) {
          return res.status(401).json({
            success: false,
            message: 'Authentication required'
          });
        }

        // Admins can access any resource
        if (req.user.role === UserRole.ADMIN) {
          return next();
        }

        const resourceId = req.params[resourceIdParam];
        if (!resourceId) {
          return res.status(400).json({
            success: false,
            message: 'Resource ID required'
          });
        }

        let isOwner = false;

        switch (resourceType) {
          case 'portfolio':
            const portfolio = await prisma.portfolio.findUnique({
              where: { id: resourceId },
              select: { userId: true }
            });
            isOwner = portfolio?.userId === req.user.userId;
            break;

          case 'transaction':
            const transaction = await prisma.transaction.findUnique({
              where: { id: resourceId },
              include: { portfolio: { select: { userId: true } } }
            });
            isOwner = transaction?.portfolio.userId === req.user.userId;
            break;

          case 'priceAlert':
            const alert = await prisma.priceAlert.findUnique({
              where: { id: resourceId },
              select: { userId: true }
            });
            isOwner = alert?.userId === req.user.userId;
            break;

          case 'user':
            isOwner = resourceId === req.user.userId;
            break;

          default:
            return res.status(400).json({
              success: false,
              message: 'Unknown resource type'
            });
        }

        if (!isOwner) {
          await auditService.log(
            'OWNERSHIP_VIOLATION',
            req.user.userId,
            `Attempted to access ${resourceType}:${resourceId} without ownership`,
            this.getClientIP(req),
            req.headers['user-agent']
          );

          return res.status(403).json({
            success: false,
            message: 'Access denied - resource ownership required'
          });
        }

        next();
      } catch (error) {
        console.error('Ownership middleware error:', error);
        res.status(500).json({
          success: false,
          message: 'Internal server error'
        });
      }
    };
  }

  // Check resource limits for user role
  checkResourceLimits(resourceType: string) {
    return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        if (!req.user) {
          return res.status(401).json({
            success: false,
            message: 'Authentication required'
          });
        }

        // Admins have no limits
        if (req.user.role === UserRole.ADMIN) {
          return next();
        }

        const permissions = ROLE_PERMISSIONS[req.user.role] || [];
        const resourcePermission = permissions.find(p => 
          p.resource === resourceType && p.action === 'create'
        );

        if (resourcePermission?.conditions?.maxCount) {
          let currentCount = 0;

          switch (resourceType) {
            case 'portfolio':
              currentCount = await prisma.portfolio.count({
                where: { userId: req.user.userId }
              });
              break;

            case 'priceAlert':
              currentCount = await prisma.priceAlert.count({
                where: { userId: req.user.userId, isActive: true }
              });
              break;

            default:
              return next(); // No limits defined for this resource
          }

          if (currentCount >= resourcePermission.conditions.maxCount) {
            return res.status(429).json({
              success: false,
              message: `Resource limit exceeded`,
              limit: resourcePermission.conditions.maxCount,
              current: currentCount,
              upgrade: req.user.role === UserRole.BASIC ? 'premium' : null
            });
          }
        }

        next();
      } catch (error) {
        console.error('Resource limit middleware error:', error);
        res.status(500).json({
          success: false,
          message: 'Internal server error'
        });
      }
    };
  }

  // Premium feature guard
  requirePremium() {
    return this.requirePermission('premium', 'access');
  }

  // Admin only access
  requireAdmin() {
    return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      if (!req.user || req.user.role !== UserRole.ADMIN) {
        return res.status(403).json({
          success: false,
          message: 'Administrator access required'
        });
      }
      next();
    };
  }

  // Get user's effective permissions
  getUserPermissions(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const permissions = ROLE_PERMISSIONS[req.user.role] || [];
    const effectivePermissions = permissions.map(p => ({
      resource: p.resource,
      action: p.action,
      conditions: p.conditions
    }));

    res.status(200).json({
      success: true,
      data: {
        role: req.user.role,
        permissions: effectivePermissions
      }
    });
  }

  // Check if user can perform action on specific resource instance
  async canAccessResource(
    userId: string, 
    userRole: UserRole, 
    resourceType: string, 
    resourceId: string, 
    action: string
  ): Promise<boolean> {
    // Check basic permission first
    if (!this.hasPermission(userRole, resourceType, action)) {
      return false;
    }

    // Admins can access everything
    if (userRole === UserRole.ADMIN) {
      return true;
    }

    // Check ownership for resources that require it
    const permissions = ROLE_PERMISSIONS[userRole] || [];
    const permission = permissions.find(p => 
      p.resource === resourceType && p.action === action
    );

    if (permission?.conditions?.ownerOnly || permission?.conditions?.selfOnly) {
      switch (resourceType) {
        case 'portfolio':
          const portfolio = await prisma.portfolio.findUnique({
            where: { id: resourceId },
            select: { userId: true }
          });
          return portfolio?.userId === userId;

        case 'transaction':
          const transaction = await prisma.transaction.findUnique({
            where: { id: resourceId },
            include: { portfolio: { select: { userId: true } } }
          });
          return transaction?.portfolio.userId === userId;

        case 'priceAlert':
          const alert = await prisma.priceAlert.findUnique({
            where: { id: resourceId },
            select: { userId: true }
          });
          return alert?.userId === userId;

        case 'user':
          return resourceId === userId;

        default:
          return false;
      }
    }

    return true;
  }

  private getClientIP(req: Request): string {
    return (
      req.headers['x-forwarded-for'] as string ||
      req.headers['x-real-ip'] as string ||
      req.connection.remoteAddress ||
      'unknown'
    ).split(',')[0].trim();
  }
}

export const rbacMiddleware = new RBACMiddleware();