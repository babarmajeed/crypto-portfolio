import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface AuditLogData {
  userId?: string;
  action: string;
  resource?: string;
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

class AuditService {
  async log(data: AuditLogData): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          userId: data.userId,
          action: data.action,
          resource: data.resource,
          details: data.details,
          ipAddress: data.ipAddress,
          userAgent: data.userAgent,
          timestamp: new Date()
        }
      });
    } catch (error) {
      console.error('Failed to write audit log:', error);
      // Don't throw error to avoid breaking the main flow
    }
  }

  async getUserAuditLogs(userId: string, limit: number = 50, offset: number = 0) {
    return prisma.auditLog.findMany({
      where: { userId },
      orderBy: { timestamp: 'desc' },
      take: limit,
      skip: offset
    });
  }

  async getSecurityEvents(hours: number = 24) {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    
    return prisma.auditLog.findMany({
      where: {
        timestamp: { gte: since },
        action: {
          in: [
            'FAILED_LOGIN_ATTEMPT',
            'ACCOUNT_LOCKED',
            'PASSWORD_RESET_REQUESTED',
            'PASSWORD_RESET_COMPLETED',
            'TWO_FACTOR_ENABLED',
            'TWO_FACTOR_DISABLED',
            'SUSPICIOUS_ACTIVITY'
          ]
        }
      },
      orderBy: { timestamp: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true
          }
        }
      }
    });
  }

  async getFailedLoginAttempts(ipAddress: string, hours: number = 1) {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    
    return prisma.auditLog.count({
      where: {
        action: 'FAILED_LOGIN_ATTEMPT',
        ipAddress,
        timestamp: { gte: since }
      }
    });
  }

  async getSuspiciousActivity(hours: number = 24) {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    
    // Find IPs with multiple failed login attempts
    const suspiciousIPs = await prisma.auditLog.groupBy({
      by: ['ipAddress'],
      where: {
        action: 'FAILED_LOGIN_ATTEMPT',
        timestamp: { gte: since },
        ipAddress: { not: null }
      },
      _count: {
        ipAddress: true
      },
      having: {
        ipAddress: {
          _count: {
            gte: 10 // 10+ failed attempts from same IP
          }
        }
      }
    });

    // Find users with multiple failed attempts
    const suspiciousUsers = await prisma.auditLog.groupBy({
      by: ['userId'],
      where: {
        action: 'FAILED_LOGIN_ATTEMPT',
        timestamp: { gte: since },
        userId: { not: null }
      },
      _count: {
        userId: true
      },
      having: {
        userId: {
          _count: {
            gte: 5 // 5+ failed attempts for same user
          }
        }
      }
    });

    return {
      suspiciousIPs,
      suspiciousUsers
    };
  }

  async cleanOldLogs(daysToKeep: number = 90): Promise<number> {
    const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);
    
    const result = await prisma.auditLog.deleteMany({
      where: {
        timestamp: { lt: cutoffDate }
      }
    });

    return result.count;
  }
}

export const auditService = new AuditService();