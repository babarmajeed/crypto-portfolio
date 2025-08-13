import { z } from 'zod';

// User Profile Validation Schemas
export const userProfileUpdateSchema = z.object({
  firstName: z.string().min(1).max(100).optional().nullable(),
  lastName: z.string().min(1).max(100).optional().nullable(),
  timezone: z.string().max(50).optional(),
  language: z.string().max(10).optional(),
  country: z.string().max(5).optional().nullable(),
});

export const avatarUploadSchema = z.object({
  fieldname: z.string(),
  originalname: z.string(),
  encoding: z.string(),
  mimetype: z.enum(['image/jpeg', 'image/png', 'image/webp']),
  size: z.number().max(5 * 1024 * 1024), // 5MB max
});

// User Preferences Validation Schemas
export const userPreferencesUpdateSchema = z.object({
  baseCurrency: z.string().max(10).optional(),
  theme: z.enum(['light', 'dark', 'auto']).optional(),
  dashboardLayout: z.record(z.any()).optional(),
  notifications: z.object({
    email: z.boolean().optional(),
    push: z.boolean().optional(),
    sms: z.boolean().optional(),
    priceAlerts: z.boolean().optional(),
    portfolioUpdates: z.boolean().optional(),
    newsUpdates: z.boolean().optional(),
    marketAlerts: z.boolean().optional(),
  }).optional(),
  privacySettings: z.object({
    portfolio_public: z.boolean().optional(),
    show_balances: z.boolean().optional(),
    data_sharing: z.boolean().optional(),
    analytics_tracking: z.boolean().optional(),
    marketing_emails: z.boolean().optional(),
  }).optional(),
  riskTolerance: z.enum(['conservative', 'moderate', 'aggressive']).optional(),
});

// Dashboard Layout Validation
export const dashboardLayoutSchema = z.object({
  widgets: z.array(z.object({
    id: z.string(),
    type: z.string(),
    position: z.object({
      x: z.number(),
      y: z.number(),
    }),
    size: z.object({
      width: z.number(),
      height: z.number(),
    }),
    config: z.record(z.any()).optional(),
  })),
  theme_customization: z.object({
    primary_color: z.string().optional(),
    sidebar_collapsed: z.boolean().optional(),
    chart_preferences: z.record(z.any()).optional(),
  }).optional(),
});

// Trusted Device Validation
export const trustedDeviceSchema = z.object({
  deviceFingerprint: z.string().min(1).max(500),
  deviceName: z.string().min(1).max(200).optional(),
});

// Audit Log Filters Validation
export const auditLogFiltersSchema = z.object({
  action: z.string().optional(),
  resource: z.string().optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
});

// Pagination Validation
export const paginationSchema = z.object({
  page: z.string().transform(val => parseInt(val, 10)).refine(val => val > 0, 'Page must be positive').optional(),
  limit: z.string().transform(val => parseInt(val, 10)).refine(val => val > 0 && val <= 100, 'Limit must be between 1 and 100').optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

// Security Settings Validation
export const deviceManagementSchema = z.object({
  action: z.enum(['trust', 'remove', 'list']),
  deviceFingerprint: z.string().min(1).max(500).optional(),
  deviceName: z.string().min(1).max(200).optional(),
});

// Data Export Validation
export const dataExportSchema = z.object({
  format: z.enum(['json', 'csv']).default('json'),
  includePortfolios: z.boolean().default(false),
  includeTransactions: z.boolean().default(false),
  includeAuditLogs: z.boolean().default(true),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
});

// Password Update Validation
export const passwordUpdateSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, 'Password must contain uppercase, lowercase, number and special character'),
  confirmPassword: z.string().min(1, 'Password confirmation is required'),
}).refine(data => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

// Email Update Validation
export const emailUpdateSchema = z.object({
  newEmail: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required for email update'),
});

// Account Deletion Validation
export const accountDeletionSchema = z.object({
  password: z.string().min(1, 'Password is required'),
  confirmPhrase: z.string().refine(val => val === 'DELETE MY ACCOUNT', 'Must type exactly "DELETE MY ACCOUNT"'),
  reason: z.string().min(1).max(500).optional(),
});

// Two-Factor Authentication Validation
export const twoFactorSetupSchema = z.object({
  token: z.string().length(6, 'Token must be 6 digits'),
});

export const twoFactorDisableSchema = z.object({
  token: z.string().length(6, 'Token must be 6 digits'),
  password: z.string().min(1, 'Password is required'),
});

// Notification Settings Validation
export const notificationSettingsSchema = z.object({
  email: z.boolean(),
  push: z.boolean(),
  sms: z.boolean(),
  priceAlerts: z.boolean().optional(),
  portfolioUpdates: z.boolean().optional(),
  newsUpdates: z.boolean().optional(),
  marketAlerts: z.boolean().optional(),
});

// Privacy Settings Validation
export const privacySettingsSchema = z.object({
  portfolio_public: z.boolean(),
  show_balances: z.boolean(),
  data_sharing: z.boolean(),
  analytics_tracking: z.boolean().optional(),
  marketing_emails: z.boolean().optional(),
});

// File upload validation helper
export const validateImageFile = (file: Express.Multer.File) => {
  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
  const maxSize = 5 * 1024 * 1024; // 5MB
  
  if (!allowedMimeTypes.includes(file.mimetype)) {
    throw new Error('Invalid file type. Only JPEG, PNG, and WebP are allowed.');
  }
  
  if (file.size > maxSize) {
    throw new Error('File size too large. Maximum size is 5MB.');
  }
  
  return true;
};

// Device fingerprint validation
export const generateDeviceFingerprint = (userAgent: string, ip: string, additionalData?: Record<string, any>) => {
  const crypto = require('crypto');
  const data = JSON.stringify({
    userAgent,
    ip,
    ...additionalData
  });
  return crypto.createHash('sha256').update(data).digest('hex');
};

// Sanitization helpers
export const sanitizeHtml = (input: string): string => {
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
};

export const sanitizeFilename = (filename: string): string => {
  return filename
    .replace(/[^a-zA-Z0-9.-]/g, '_')
    .replace(/_{2,}/g, '_')
    .toLowerCase();
};

export type UserProfileUpdateInput = z.infer<typeof userProfileUpdateSchema>;
export type UserPreferencesUpdateInput = z.infer<typeof userPreferencesUpdateSchema>;
export type TrustedDeviceInput = z.infer<typeof trustedDeviceSchema>;
export type AuditLogFiltersInput = z.infer<typeof auditLogFiltersSchema>;
export type PaginationInput = z.infer<typeof paginationSchema>;
export type DataExportInput = z.infer<typeof dataExportSchema>;
export type PasswordUpdateInput = z.infer<typeof passwordUpdateSchema>;
export type EmailUpdateInput = z.infer<typeof emailUpdateSchema>;
export type AccountDeletionInput = z.infer<typeof accountDeletionSchema>;