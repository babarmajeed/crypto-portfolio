import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthenticatedRequest } from './authMiddleware';

const prisma = new PrismaClient();

interface AuditableRequest extends AuthenticatedRequest {
  auditInfo?: {
    action: string;
    resource?: string;
    resourceId?: string;
    oldValues?: Record<string, any>;
    skipAudit?: boolean;
  };
}

export class AuditMiddleware {
  // Set audit information for the request
  static setAuditInfo(action: string, resource?: string, resourceId?: string) {
    return (req: AuditableRequest, res: Response, next: NextFunction) => {
      req.auditInfo = {
        action,
        resource,
        resourceId,
        skipAudit: false
      };
      next();
    };
  }

  // Skip audit logging for this request
  static skipAudit(req: AuditableRequest, res: Response, next: NextFunction) {
    if (!req.auditInfo) {
      req.auditInfo = {
        action: 'UNKNOWN',
        skipAudit: true
      };
    } else {
      req.auditInfo.skipAudit = true;
    }
    next();
  }

  // Capture old values before modification (for PUT/PATCH requests)
  static captureOldValues(resourceType: string, idParam: string = 'id') {
    return async (req: AuditableRequest, res: Response, next: NextFunction) => {
      if (!req.user || !req.params[idParam]) {
        next();
        return;
      }

      try {
        let oldValues: Record<string, any> | null = null;
        const resourceId = req.params[idParam];

        switch (resourceType.toLowerCase()) {
          case 'profile':
            oldValues = await prisma.userProfile.findUnique({
              where: { userId: req.user.userId }
            });
            break;
          case 'preferences':
            oldValues = await prisma.userPreferences.findUnique({
              where: { userId: req.user.userId }
            });
            break;
          case 'user':
            oldValues = await prisma.user.findUnique({
              where: { id: req.user.userId },
              select: {
                email: true,
                firstName: true,
                lastName: true,
                isTwoFactorEnabled: true,
                isActive: true
              }
            });
            break;
          case 'portfolio':
            oldValues = await prisma.portfolio.findUnique({
              where: { id: resourceId }
            });
            break;
          case 'transaction':
            oldValues = await prisma.transaction.findUnique({
              where: { id: resourceId }
            });
            break;
        }

        if (req.auditInfo && oldValues) {
          req.auditInfo.oldValues = oldValues;
          req.auditInfo.resourceId = req.auditInfo.resourceId || resourceId;
        }
      } catch (error) {
        console.error('Error capturing old values for audit:', error);
      }

      next();
    };
  }

  // Main audit logging middleware (should be used after the actual operation)
  static logActivity = async (req: AuditableRequest, res: Response, next: NextFunction) => {
    // Skip if audit is disabled or user is not authenticated
    if (!req.user || !req.auditInfo || req.auditInfo.skipAudit) {
      next();
      return;
    }

    try {
      const { action, resource, resourceId, oldValues } = req.auditInfo;
      
      // Determine new values from request body for modification operations
      let newValues: Record<string, any> | null = null;
      if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body) {
        newValues = { ...req.body };
        // Remove sensitive fields
        delete newValues.password;
        delete newValues.currentPassword;
        delete newValues.newPassword;
        delete newValues.confirmPassword;
      }

      // Get client information
      const ipAddress = this.getClientIP(req);
      const userAgent = req.headers['user-agent'];

      // Log the audit entry
      await prisma.auditLog.create({
        data: {
          userId: req.user.userId,
          action,
          resource: resource || this.extractResourceFromPath(req.originalUrl),
          resourceId: resourceId || req.params.id,
          oldValues: oldValues || null,
          newValues: newValues,
          ipAddress,
          userAgent
        }
      });

    } catch (error) {
      console.error('Audit logging error:', error);
      // Don't fail the request if audit logging fails
    }

    next();
  };

  // Automatic audit middleware that infers action from HTTP method and path
  static autoAudit = (req: AuditableRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      next();
      return;
    }

    const action = this.inferActionFromRequest(req);
    const resource = this.extractResourceFromPath(req.originalUrl);
    
    req.auditInfo = {
      action,
      resource,
      resourceId: req.params.id,
      skipAudit: false
    };

    next();
  };

  // Sensitive operations middleware - always audit these actions
  static auditSensitiveOperation(action: string) {
    return async (req: AuditableRequest, res: Response, next: NextFunction) => {
      if (!req.user) {
        next();
        return;
      }

      try {
        const ipAddress = this.getClientIP(req);
        const userAgent = req.headers['user-agent'];

        await prisma.auditLog.create({
          data: {
            userId: req.user.userId,
            action,
            resource: this.extractResourceFromPath(req.originalUrl),
            resourceId: req.params.id || null,
            newValues: req.body ? { ...req.body, password: undefined } : null,
            ipAddress,
            userAgent
          }
        });
      } catch (error) {
        console.error('Sensitive operation audit error:', error);
      }

      next();
    };
  }

  // Security event logging
  static logSecurityEvent(event: string, details?: Record<string, any>) {
    return async (req: AuditableRequest, res: Response, next: NextFunction) => {
      try {
        const ipAddress = this.getClientIP(req);
        const userAgent = req.headers['user-agent'];

        await prisma.auditLog.create({
          data: {
            userId: req.user?.userId || '',
            action: `SECURITY_${event}`,
            resource: 'Security',
            newValues: details || null,
            ipAddress,
            userAgent
          }
        });
      } catch (error) {
        console.error('Security event logging error:', error);
      }

      next();
    };
  }

  // Utility methods
  private static getClientIP(req: Request): string {
    return (
      req.headers['x-forwarded-for'] as string ||
      req.headers['x-real-ip'] as string ||
      req.connection.remoteAddress ||
      'unknown'
    ).split(',')[0].trim();
  }

  private static extractResourceFromPath(path: string): string {
    const pathParts = path.split('/').filter(part => part && !part.match(/^\d+$/));
    return pathParts[pathParts.length - 1] || 'unknown';
  }

  private static inferActionFromRequest(req: Request): string {
    const method = req.method.toUpperCase();
    const path = req.originalUrl.toLowerCase();

    // Specific actions based on path patterns
    if (path.includes('/login')) return 'LOGIN';
    if (path.includes('/logout')) return 'LOGOUT';
    if (path.includes('/register')) return 'REGISTER';
    if (path.includes('/verify')) return 'EMAIL_VERIFY';
    if (path.includes('/reset-password')) return 'PASSWORD_RESET';
    if (path.includes('/2fa')) return '2FA_SETUP';
    if (path.includes('/avatar')) return 'AVATAR_UPDATE';
    if (path.includes('/export')) return 'DATA_EXPORT';
    if (path.includes('/delete-account')) return 'ACCOUNT_DELETE';

    // Generic CRUD actions
    switch (method) {
      case 'GET': return 'READ';
      case 'POST': return 'CREATE';
      case 'PUT': 
      case 'PATCH': return 'UPDATE';
      case 'DELETE': return 'DELETE';
      default: return 'UNKNOWN';
    }
  }
}

// Convenience methods for common audit scenarios
export const auditMiddleware = {
  // Profile operations
  profileUpdate: AuditMiddleware.setAuditInfo('PROFILE_UPDATE', 'UserProfile'),
  avatarUpdate: AuditMiddleware.setAuditInfo('AVATAR_UPDATE', 'UserProfile'),
  
  // Preferences operations
  preferencesUpdate: AuditMiddleware.setAuditInfo('PREFERENCES_UPDATE', 'UserPreferences'),
  
  // Security operations
  passwordChange: AuditMiddleware.auditSensitiveOperation('PASSWORD_CHANGE'),
  emailChange: AuditMiddleware.auditSensitiveOperation('EMAIL_CHANGE'),
  twoFactorEnable: AuditMiddleware.auditSensitiveOperation('2FA_ENABLE'),
  twoFactorDisable: AuditMiddleware.auditSensitiveOperation('2FA_DISABLE'),
  
  // Device operations
  deviceTrust: AuditMiddleware.setAuditInfo('DEVICE_TRUST', 'TrustedDevice'),
  deviceRemove: AuditMiddleware.setAuditInfo('DEVICE_REMOVE', 'TrustedDevice'),
  
  // Account operations
  accountDelete: AuditMiddleware.auditSensitiveOperation('ACCOUNT_DELETE'),
  dataExport: AuditMiddleware.auditSensitiveOperation('DATA_EXPORT'),
  
  // General middleware
  auto: AuditMiddleware.autoAudit,
  log: AuditMiddleware.logActivity,
  capture: AuditMiddleware.captureOldValues,
  skip: AuditMiddleware.skipAudit,
  security: AuditMiddleware.logSecurityEvent
};

export { AuditMiddleware };