import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/authMiddleware';
import { userService } from '../services/userService';
import { 
  auditLogFiltersSchema,
  paginationSchema,
  deviceManagementSchema,
  trustedDeviceSchema,
  twoFactorSetupSchema,
  twoFactorDisableSchema
} from '../utils/validation';
import { generateDeviceFingerprint } from '../utils/validation';

export class SecurityController {
  // Get security overview
  static getSecurityOverview = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user!.userId;
      
      const [securitySettings, trustedDevices, recentActivity] = await Promise.all([
        userService.getSecuritySettings(userId),
        userService.getTrustedDevices(userId),
        userService.getRecentActivity(userId, 5)
      ]);

      res.json({
        success: true,
        data: {
          security: securitySettings,
          trustedDevices: trustedDevices.map(device => ({
            id: device.id,
            deviceFingerprint: device.deviceFingerprint,
            deviceName: device.deviceName,
            lastSeen: device.lastSeen,
            trustedAt: device.trustedAt,
            isCurrentDevice: this.isCurrentDevice(req, device.deviceFingerprint)
          })),
          recentActivity: recentActivity.map(activity => ({
            id: activity.id,
            action: activity.action,
            resource: activity.resource,
            createdAt: activity.createdAt,
            ipAddress: activity.ipAddress
          }))
        }
      });
    } catch (error) {
      console.error('Get security overview error:', error);
      res.status(500).json({ error: 'Failed to fetch security overview' });
    }
  };

  // Get audit logs with filtering and pagination
  static getAuditLogs = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user!.userId;
      
      // Validate filters
      const filtersResult = auditLogFiltersSchema.safeParse(req.query);
      if (!filtersResult.success) {
        res.status(400).json({ 
          error: 'Invalid filter parameters',
          details: filtersResult.error.errors 
        });
        return;
      }

      // Validate pagination
      const paginationResult = paginationSchema.safeParse(req.query);
      if (!paginationResult.success) {
        res.status(400).json({ 
          error: 'Invalid pagination parameters',
          details: paginationResult.error.errors 
        });
        return;
      }

      const filters = filtersResult.data;
      const pagination = paginationResult.data;

      // Convert date strings to Date objects if provided
      if (filters.dateFrom) filters.dateFrom = new Date(filters.dateFrom);
      if (filters.dateTo) filters.dateTo = new Date(filters.dateTo);

      const { logs, total } = await userService.getAuditLogs(userId, filters, pagination);

      res.json({
        success: true,
        data: {
          logs: logs.map(log => ({
            id: log.id,
            action: log.action,
            resource: log.resource,
            resourceId: log.resourceId,
            ipAddress: log.ipAddress,
            userAgent: log.userAgent,
            createdAt: log.createdAt,
            changes: {
              old: log.oldValues,
              new: log.newValues
            }
          })),
          pagination: {
            page: pagination.page || 1,
            limit: pagination.limit || 50,
            total,
            totalPages: Math.ceil(total / (pagination.limit || 50))
          }
        }
      });
    } catch (error) {
      console.error('Get audit logs error:', error);
      res.status(500).json({ error: 'Failed to fetch audit logs' });
    }
  };

  // Manage trusted devices
  static manageTrustedDevices = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user!.userId;
      
      // Validate device management request
      const validationResult = deviceManagementSchema.safeParse(req.body);
      if (!validationResult.success) {
        res.status(400).json({ 
          error: 'Validation failed',
          details: validationResult.error.errors 
        });
        return;
      }

      const { action, deviceFingerprint, deviceName } = validationResult.data;

      switch (action) {
        case 'list':
          const devices = await userService.getTrustedDevices(userId);
          res.json({
            success: true,
            data: { 
              devices: devices.map(device => ({
                id: device.id,
                deviceFingerprint: device.deviceFingerprint,
                deviceName: device.deviceName,
                lastSeen: device.lastSeen,
                trustedAt: device.trustedAt,
                isCurrentDevice: this.isCurrentDevice(req, device.deviceFingerprint)
              }))
            }
          });
          break;

        case 'trust':
          if (!deviceFingerprint) {
            res.status(400).json({ error: 'Device fingerprint is required' });
            return;
          }

          const trustedDevice = await userService.addTrustedDevice(userId, {
            deviceFingerprint,
            deviceName: deviceName || this.generateDeviceName(req)
          });

          res.json({
            success: true,
            message: 'Device trusted successfully',
            data: { device: trustedDevice }
          });
          break;

        case 'remove':
          if (!deviceFingerprint) {
            res.status(400).json({ error: 'Device fingerprint is required' });
            return;
          }

          const removed = await userService.removeTrustedDevice(userId, deviceFingerprint);
          
          if (!removed) {
            res.status(404).json({ error: 'Device not found' });
            return;
          }

          res.json({
            success: true,
            message: 'Device removed successfully'
          });
          break;

        default:
          res.status(400).json({ error: 'Invalid action' });
      }
    } catch (error) {
      console.error('Manage trusted devices error:', error);
      res.status(500).json({ error: 'Failed to manage trusted devices' });
    }
  };

  // Trust current device
  static trustCurrentDevice = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const { deviceName } = req.body;
      
      // Generate device fingerprint from current request
      const deviceFingerprint = this.generateCurrentDeviceFingerprint(req);
      
      const trustedDevice = await userService.addTrustedDevice(userId, {
        deviceFingerprint,
        deviceName: deviceName || this.generateDeviceName(req)
      });

      res.json({
        success: true,
        message: 'Current device trusted successfully',
        data: { device: trustedDevice }
      });
    } catch (error) {
      console.error('Trust current device error:', error);
      res.status(500).json({ error: 'Failed to trust current device' });
    }
  };

  // Remove trusted device by ID
  static removeTrustedDevice = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const { deviceId } = req.params;
      
      if (!deviceId) {
        res.status(400).json({ error: 'Device ID is required' });
        return;
      }

      // Get device to find fingerprint
      const devices = await userService.getTrustedDevices(userId);
      const device = devices.find(d => d.id === deviceId);
      
      if (!device) {
        res.status(404).json({ error: 'Device not found' });
        return;
      }

      const removed = await userService.removeTrustedDevice(userId, device.deviceFingerprint);
      
      if (!removed) {
        res.status(404).json({ error: 'Failed to remove device' });
        return;
      }

      res.json({
        success: true,
        message: 'Device removed successfully'
      });
    } catch (error) {
      console.error('Remove trusted device error:', error);
      res.status(500).json({ error: 'Failed to remove trusted device' });
    }
  };

  // Cleanup inactive devices
  static cleanupInactiveDevices = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const { days = 30 } = req.query;
      
      const daysInactive = parseInt(days as string);
      if (isNaN(daysInactive) || daysInactive < 1 || daysInactive > 365) {
        res.status(400).json({ error: 'Invalid days parameter (1-365)' });
        return;
      }

      const removedCount = await userService.cleanupInactiveDevices(userId, daysInactive);

      res.json({
        success: true,
        message: `Cleaned up ${removedCount} inactive devices`,
        data: { removedCount }
      });
    } catch (error) {
      console.error('Cleanup inactive devices error:', error);
      res.status(500).json({ error: 'Failed to cleanup inactive devices' });
    }
  };

  // Get security events (filtered audit logs)
  static getSecurityEvents = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user!.userId;
      
      // Get security-related events
      const securityActions = [
        'LOGIN', 'LOGOUT', 'PASSWORD_CHANGE', 'EMAIL_CHANGE',
        '2FA_ENABLE', '2FA_DISABLE', 'DEVICE_TRUST', 'DEVICE_REMOVE',
        'UNAUTHORIZED_ACCESS_ATTEMPT', 'INVALID_SESSION_DETECTED',
        'SESSION_IP_MISMATCH', 'SECURITY'
      ];

      const paginationResult = paginationSchema.safeParse(req.query);
      const pagination = paginationResult.success ? paginationResult.data : {};

      const { logs, total } = await userService.getAuditLogs(
        userId, 
        { action: securityActions.join('|') }, 
        pagination
      );

      res.json({
        success: true,
        data: {
          events: logs.map(log => ({
            id: log.id,
            action: log.action,
            resource: log.resource,
            ipAddress: log.ipAddress,
            userAgent: log.userAgent,
            createdAt: log.createdAt,
            severity: this.getEventSeverity(log.action),
            description: this.getEventDescription(log.action, log.newValues)
          })),
          pagination: {
            page: pagination.page || 1,
            limit: pagination.limit || 50,
            total,
            totalPages: Math.ceil(total / (pagination.limit || 50))
          }
        }
      });
    } catch (error) {
      console.error('Get security events error:', error);
      res.status(500).json({ error: 'Failed to fetch security events' });
    }
  };

  // Check device trust status
  static checkDeviceTrust = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const deviceFingerprint = this.generateCurrentDeviceFingerprint(req);
      
      const isTrusted = await userService.isDeviceTrusted(userId, deviceFingerprint);

      res.json({
        success: true,
        data: {
          deviceFingerprint,
          isTrusted,
          deviceName: this.generateDeviceName(req)
        }
      });
    } catch (error) {
      console.error('Check device trust error:', error);
      res.status(500).json({ error: 'Failed to check device trust status' });
    }
  };

  // Helper methods
  private static generateCurrentDeviceFingerprint(req: AuthenticatedRequest): string {
    const userAgent = req.headers['user-agent'] || '';
    const ip = this.getClientIP(req);
    const acceptLanguage = req.headers['accept-language'] || '';
    const acceptEncoding = req.headers['accept-encoding'] || '';
    
    return generateDeviceFingerprint(userAgent, ip, {
      acceptLanguage,
      acceptEncoding
    });
  }

  private static generateDeviceName(req: AuthenticatedRequest): string {
    const userAgent = req.headers['user-agent'] || '';
    
    // Simple device name generation from user agent
    if (userAgent.includes('Chrome')) return 'Chrome Browser';
    if (userAgent.includes('Firefox')) return 'Firefox Browser';
    if (userAgent.includes('Safari')) return 'Safari Browser';
    if (userAgent.includes('Edge')) return 'Edge Browser';
    if (userAgent.includes('Mobile')) return 'Mobile Device';
    if (userAgent.includes('Android')) return 'Android Device';
    if (userAgent.includes('iPhone')) return 'iPhone';
    if (userAgent.includes('iPad')) return 'iPad';
    if (userAgent.includes('Mac')) return 'Mac Computer';
    if (userAgent.includes('Windows')) return 'Windows Computer';
    if (userAgent.includes('Linux')) return 'Linux Computer';
    
    return 'Unknown Device';
  }

  private static isCurrentDevice(req: AuthenticatedRequest, deviceFingerprint: string): boolean {
    const currentFingerprint = this.generateCurrentDeviceFingerprint(req);
    return currentFingerprint === deviceFingerprint;
  }

  private static getClientIP(req: AuthenticatedRequest): string {
    return (
      req.headers['x-forwarded-for'] as string ||
      req.headers['x-real-ip'] as string ||
      req.connection.remoteAddress ||
      'unknown'
    ).split(',')[0].trim();
  }

  private static getEventSeverity(action: string): 'low' | 'medium' | 'high' | 'critical' {
    const criticalEvents = ['UNAUTHORIZED_ACCESS_ATTEMPT', 'INVALID_SESSION_DETECTED'];
    const highEvents = ['PASSWORD_CHANGE', 'EMAIL_CHANGE', '2FA_DISABLE', 'ACCOUNT_DELETE'];
    const mediumEvents = ['LOGIN', '2FA_ENABLE', 'DEVICE_TRUST', 'SESSION_IP_MISMATCH'];
    
    if (criticalEvents.some(event => action.includes(event))) return 'critical';
    if (highEvents.some(event => action.includes(event))) return 'high';
    if (mediumEvents.some(event => action.includes(event))) return 'medium';
    return 'low';
  }

  private static getEventDescription(action: string, details?: any): string {
    const descriptions: Record<string, string> = {
      'LOGIN': 'User logged in',
      'LOGOUT': 'User logged out',
      'PASSWORD_CHANGE': 'Password was changed',
      'EMAIL_CHANGE': 'Email address was changed',
      '2FA_ENABLE': 'Two-factor authentication enabled',
      '2FA_DISABLE': 'Two-factor authentication disabled',
      'DEVICE_TRUST': 'Device was added to trusted devices',
      'DEVICE_REMOVE': 'Device was removed from trusted devices',
      'UNAUTHORIZED_ACCESS_ATTEMPT': 'Unauthorized access attempt detected',
      'INVALID_SESSION_DETECTED': 'Invalid session detected',
      'SESSION_IP_MISMATCH': 'Session IP address mismatch detected',
      'ACCOUNT_DELETE': 'Account was deleted'
    };
    
    return descriptions[action] || `Security event: ${action}`;
  }
}

export const securityController = SecurityController;