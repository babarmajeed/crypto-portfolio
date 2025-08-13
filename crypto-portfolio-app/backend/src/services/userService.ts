import { PrismaClient, User, UserProfile, UserPreferences, TrustedDevice, AuditLog } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { 
  UserProfileData, 
  UserPreferencesData, 
  TrustedDeviceData, 
  UserExportData, 
  PaginationOptions, 
  AuditLogFilters,
  SecuritySettings,
  DeviceInfo
} from '../types/user';

const prisma = new PrismaClient();

export class UserService {
  // Profile Management
  async getProfile(userId: string): Promise<UserProfile | null> {
    return await prisma.userProfile.findUnique({
      where: { userId }
    });
  }

  async createProfile(userId: string, data: UserProfileData): Promise<UserProfile> {
    return await prisma.userProfile.create({
      data: {
        userId,
        ...data
      }
    });
  }

  async updateProfile(userId: string, data: UserProfileData): Promise<UserProfile> {
    // First check if profile exists
    const existingProfile = await prisma.userProfile.findUnique({
      where: { userId }
    });

    if (!existingProfile) {
      // Create new profile if it doesn't exist
      return await this.createProfile(userId, data);
    }

    // Update existing profile
    return await prisma.userProfile.update({
      where: { userId },
      data: {
        ...data,
        updatedAt: new Date()
      }
    });
  }

  async updateAvatar(userId: string, avatarUrl: string): Promise<UserProfile> {
    return await this.updateProfile(userId, { avatarUrl });
  }

  async deleteAvatar(userId: string): Promise<UserProfile> {
    return await this.updateProfile(userId, { avatarUrl: null });
  }

  // Preferences Management
  async getPreferences(userId: string): Promise<UserPreferences | null> {
    return await prisma.userPreferences.findUnique({
      where: { userId }
    });
  }

  async createPreferences(userId: string, data: UserPreferencesData): Promise<UserPreferences> {
    const defaultNotifications = {
      email: true,
      push: true,
      sms: false,
      priceAlerts: true,
      portfolioUpdates: true,
      newsUpdates: false,
      marketAlerts: true
    };

    const defaultPrivacySettings = {
      portfolio_public: false,
      show_balances: true,
      data_sharing: false,
      analytics_tracking: true,
      marketing_emails: false
    };

    return await prisma.userPreferences.create({
      data: {
        userId,
        baseCurrency: data.baseCurrency || 'USD',
        theme: data.theme || 'light',
        dashboardLayout: data.dashboardLayout || {},
        notifications: data.notifications || defaultNotifications,
        privacySettings: data.privacySettings || defaultPrivacySettings,
        riskTolerance: data.riskTolerance || 'moderate'
      }
    });
  }

  async updatePreferences(userId: string, data: UserPreferencesData): Promise<UserPreferences> {
    // Check if preferences exist
    const existingPreferences = await prisma.userPreferences.findUnique({
      where: { userId }
    });

    if (!existingPreferences) {
      // Create new preferences if they don't exist
      return await this.createPreferences(userId, data);
    }

    // Merge with existing data
    const updateData: any = { updatedAt: new Date() };
    
    if (data.baseCurrency !== undefined) updateData.baseCurrency = data.baseCurrency;
    if (data.theme !== undefined) updateData.theme = data.theme;
    if (data.dashboardLayout !== undefined) updateData.dashboardLayout = data.dashboardLayout;
    if (data.riskTolerance !== undefined) updateData.riskTolerance = data.riskTolerance;
    
    if (data.notifications !== undefined) {
      updateData.notifications = {
        ...(existingPreferences.notifications as any),
        ...data.notifications
      };
    }
    
    if (data.privacySettings !== undefined) {
      updateData.privacySettings = {
        ...(existingPreferences.privacySettings as any),
        ...data.privacySettings
      };
    }

    return await prisma.userPreferences.update({
      where: { userId },
      data: updateData
    });
  }

  // Device Management
  async getTrustedDevices(userId: string): Promise<TrustedDevice[]> {
    return await prisma.trustedDevice.findMany({
      where: { userId },
      orderBy: { lastSeen: 'desc' }
    });
  }

  async addTrustedDevice(userId: string, deviceData: TrustedDeviceData): Promise<TrustedDevice> {
    return await prisma.trustedDevice.upsert({
      where: {
        userId_deviceFingerprint: {
          userId,
          deviceFingerprint: deviceData.deviceFingerprint
        }
      },
      update: {
        deviceName: deviceData.deviceName,
        lastSeen: new Date()
      },
      create: {
        userId,
        deviceFingerprint: deviceData.deviceFingerprint,
        deviceName: deviceData.deviceName,
        lastSeen: new Date(),
        trustedAt: new Date()
      }
    });
  }

  async removeTrustedDevice(userId: string, deviceFingerprint: string): Promise<boolean> {
    const result = await prisma.trustedDevice.deleteMany({
      where: {
        userId,
        deviceFingerprint
      }
    });
    return result.count > 0;
  }

  async updateDeviceLastSeen(userId: string, deviceFingerprint: string): Promise<void> {
    await prisma.trustedDevice.updateMany({
      where: {
        userId,
        deviceFingerprint
      },
      data: {
        lastSeen: new Date()
      }
    });
  }

  async isDeviceTrusted(userId: string, deviceFingerprint: string): Promise<boolean> {
    const device = await prisma.trustedDevice.findFirst({
      where: {
        userId,
        deviceFingerprint
      }
    });
    return !!device;
  }

  // Security Settings
  async getSecuritySettings(userId: string): Promise<SecuritySettings> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        isTwoFactorEnabled: true,
        updatedAt: true,
        failedLoginAttempts: true
      }
    });

    const trustedDevicesCount = await prisma.trustedDevice.count({
      where: { userId }
    });

    if (!user) {
      throw new Error('User not found');
    }

    return {
      twoFactorEnabled: user.isTwoFactorEnabled,
      trustedDevicesCount,
      recentLoginAttempts: user.failedLoginAttempts,
      passwordLastChanged: user.updatedAt
    };
  }

  // Password Management
  async updatePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { password: true }
    });

    if (!user) {
      throw new Error('User not found');
    }

    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isCurrentPasswordValid) {
      throw new Error('Current password is incorrect');
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, 12);
    
    await prisma.user.update({
      where: { id: userId },
      data: {
        password: hashedNewPassword,
        updatedAt: new Date()
      }
    });
  }

  // Email Management
  async updateEmail(userId: string, newEmail: string, password: string): Promise<void> {
    // Verify password first
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { password: true, email: true }
    });

    if (!user) {
      throw new Error('User not found');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new Error('Password is incorrect');
    }

    // Check if email is already taken
    const existingUser = await prisma.user.findUnique({
      where: { email: newEmail }
    });

    if (existingUser) {
      throw new Error('Email is already in use');
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        email: newEmail,
        isEmailVerified: false, // Require re-verification
        updatedAt: new Date()
      }
    });
  }

  // Account Deletion
  async deleteAccount(userId: string, password: string): Promise<void> {
    // Verify password first
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { password: true }
    });

    if (!user) {
      throw new Error('User not found');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new Error('Password is incorrect');
    }

    // Soft delete - deactivate account
    await prisma.user.update({
      where: { id: userId },
      data: {
        isActive: false,
        email: `deleted_${Date.now()}_${user.password.slice(0, 8)}@deleted.local`,
        updatedAt: new Date()
      }
    });
  }

  // GDPR Data Export
  async exportUserData(userId: string, options?: {
    includePortfolios?: boolean;
    includeTransactions?: boolean;
    dateFrom?: Date;
    dateTo?: Date;
  }): Promise<UserExportData> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
        preferences: true,
        trustedDevices: true
      }
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Get audit logs
    let auditLogWhere: any = { userId };
    if (options?.dateFrom || options?.dateTo) {
      auditLogWhere.createdAt = {};
      if (options.dateFrom) auditLogWhere.createdAt.gte = options.dateFrom;
      if (options.dateTo) auditLogWhere.createdAt.lte = options.dateTo;
    }

    const auditLogs = await prisma.auditLog.findMany({
      where: auditLogWhere,
      orderBy: { createdAt: 'desc' }
    });

    const exportData: UserExportData = {
      profile: user.profile ? {
        firstName: user.profile.firstName,
        lastName: user.profile.lastName,
        avatarUrl: user.profile.avatarUrl,
        timezone: user.profile.timezone,
        language: user.profile.language,
        country: user.profile.country
      } : {},
      preferences: user.preferences ? {
        baseCurrency: user.preferences.baseCurrency,
        theme: user.preferences.theme,
        dashboardLayout: user.preferences.dashboardLayout as any,
        notifications: user.preferences.notifications as any,
        privacySettings: user.preferences.privacySettings as any,
        riskTolerance: user.preferences.riskTolerance as any
      } : {},
      auditLogs: auditLogs.map(log => ({
        userId: log.userId,
        action: log.action,
        resource: log.resource,
        resourceId: log.resourceId,
        oldValues: log.oldValues as any,
        newValues: log.newValues as any,
        ipAddress: log.ipAddress,
        userAgent: log.userAgent
      })),
      trustedDevices: user.trustedDevices.map(device => ({
        deviceFingerprint: device.deviceFingerprint,
        deviceName: device.deviceName
      }))
    };

    // Optionally include portfolios and transactions
    if (options?.includePortfolios) {
      const portfolios = await prisma.portfolio.findMany({
        where: { userId },
        include: {
          holdings: {
            include: {
              asset: true
            }
          }
        }
      });
      exportData.portfolios = portfolios;
    }

    if (options?.includeTransactions) {
      const transactions = await prisma.transaction.findMany({
        where: {
          portfolio: {
            userId
          }
        },
        include: {
          asset: true,
          portfolio: true
        }
      });
      exportData.transactions = transactions;
    }

    return exportData;
  }

  // User Information
  async getUserWithDetails(userId: string) {
    return await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        isEmailVerified: true,
        isTwoFactorEnabled: true,
        lastLogin: true,
        createdAt: true,
        updatedAt: true,
        profile: true,
        preferences: true
      }
    });
  }

  // Activity Tracking
  async getRecentActivity(userId: string, limit: number = 10): Promise<AuditLog[]> {
    return await prisma.auditLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit
    });
  }

  // Cleanup utilities
  async cleanupInactiveDevices(userId: string, daysInactive: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysInactive);

    const result = await prisma.trustedDevice.deleteMany({
      where: {
        userId,
        lastSeen: {
          lt: cutoffDate
        }
      }
    });

    return result.count;
  }

  async getAuditLogs(
    userId: string, 
    filters: AuditLogFilters = {}, 
    pagination: PaginationOptions = {}
  ): Promise<{ logs: AuditLog[], total: number }> {
    const { page = 1, limit = 50, sortBy = 'createdAt', sortOrder = 'desc' } = pagination;
    const skip = (page - 1) * limit;

    let where: any = { userId };

    if (filters.action) where.action = { contains: filters.action, mode: 'insensitive' };
    if (filters.resource) where.resource = { contains: filters.resource, mode: 'insensitive' };
    if (filters.dateFrom || filters.dateTo) {
      where.createdAt = {};
      if (filters.dateFrom) where.createdAt.gte = filters.dateFrom;
      if (filters.dateTo) where.createdAt.lte = filters.dateTo;
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: limit
      }),
      prisma.auditLog.count({ where })
    ]);

    return { logs, total };
  }
}

export const userService = new UserService();