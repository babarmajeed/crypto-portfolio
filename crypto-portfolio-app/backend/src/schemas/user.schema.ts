import { z } from 'zod'
import { emailSchema, phoneSchema, urlSchema, currencyCodeSchema, timePeriodSchema } from './common.schema'

/**
 * User profile update schema
 */
export const updateProfileSchema = z.object({
  firstName: z
    .string()
    .min(1, 'First name is required')
    .max(50, 'First name must be less than 50 characters')
    .trim()
    .optional(),
  
  lastName: z
    .string()
    .min(1, 'Last name is required')
    .max(50, 'Last name must be less than 50 characters')
    .trim()
    .optional(),
  
  phone: phoneSchema,
  
  bio: z
    .string()
    .max(500, 'Bio must be less than 500 characters')
    .optional(),
  
  website: urlSchema,
  
  location: z
    .string()
    .max(100, 'Location must be less than 100 characters')
    .optional(),
  
  timezone: z
    .string()
    .refine((tz) => {
      if (!tz) return true
      // Basic timezone validation (IANA format)
      return /^[A-Za-z_]+\/[A-Za-z_]+$/.test(tz)
    }, { message: 'Invalid timezone format' })
    .optional(),
  
  language: z
    .string()
    .length(2, 'Language code must be 2 characters')
    .toLowerCase()
    .optional(),
  
  dateOfBirth: z
    .string()
    .refine((date) => {
      if (!date) return true
      const parsedDate = new Date(date)
      const now = new Date()
      const age = now.getFullYear() - parsedDate.getFullYear()
      return !isNaN(parsedDate.getTime()) && age >= 13 && age <= 120
    }, { message: 'Invalid date of birth or user must be at least 13 years old' })
    .optional(),
  
  avatar: z
    .string()
    .url('Invalid avatar URL')
    .optional()
})

/**
 * User preferences schema
 */
export const userPreferencesSchema = z.object({
  // Display preferences
  theme: z.enum(['light', 'dark', 'auto']).default('auto'),
  
  currency: currencyCodeSchema.default('USD'),
  
  dateFormat: z
    .enum(['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD'])
    .default('MM/DD/YYYY'),
  
  timeFormat: z
    .enum(['12h', '24h'])
    .default('12h'),
  
  numberFormat: z
    .enum(['1,234.56', '1.234,56', '1 234.56'])
    .default('1,234.56'),
  
  // Dashboard preferences
  defaultPortfolio: z
    .string()
    .uuid()
    .optional(),
  
  dashboardLayout: z
    .enum(['compact', 'comfortable', 'spacious'])
    .default('comfortable'),
  
  chartType: z
    .enum(['line', 'candle', 'area'])
    .default('line'),
  
  chartPeriod: timePeriodSchema.default('1d'),
  
  showPortfolioValue: z.boolean().default(true),
  showPercentages: z.boolean().default(true),
  showProfitLoss: z.boolean().default(true),
  
  // Notification preferences
  emailNotifications: z.object({
    portfolioAlerts: z.boolean().default(true),
    priceAlerts: z.boolean().default(true),
    news: z.boolean().default(false),
    marketing: z.boolean().default(false),
    security: z.boolean().default(true),
    reports: z.boolean().default(true)
  }).default({}),
  
  pushNotifications: z.object({
    portfolioAlerts: z.boolean().default(true),
    priceAlerts: z.boolean().default(true),
    news: z.boolean().default(false),
    security: z.boolean().default(true)
  }).default({}),
  
  // Privacy preferences
  profileVisibility: z
    .enum(['public', 'private', 'friends'])
    .default('private'),
  
  portfolioVisibility: z
    .enum(['public', 'private', 'anonymous'])
    .default('private'),
  
  shareAnalytics: z.boolean().default(false),
  
  // Trading preferences
  confirmTransactions: z.boolean().default(true),
  autoSync: z.boolean().default(true),
  syncInterval: z
    .enum(['1m', '5m', '15m', '30m', '1h'])
    .default('15m'),
  
  riskTolerance: z
    .enum(['conservative', 'moderate', 'aggressive'])
    .default('moderate'),
  
  // Advanced preferences
  enableBetaFeatures: z.boolean().default(false),
  enableAPIAccess: z.boolean().default(false),
  sessionTimeout: z
    .number()
    .min(15, 'Session timeout must be at least 15 minutes')
    .max(1440, 'Session timeout cannot exceed 24 hours')
    .default(60) // minutes
})

/**
 * User avatar upload schema
 */
export const avatarUploadSchema = z.object({
  file: z.object({
    mimetype: z
      .string()
      .refine((type) => ['image/jpeg', 'image/png', 'image/webp'].includes(type), {
        message: 'Avatar must be JPEG, PNG, or WebP format'
      }),
    size: z
      .number()
      .max(5 * 1024 * 1024, 'Avatar file size must be less than 5MB'),
    buffer: z.instanceof(Buffer)
  })
})

/**
 * User security settings schema
 */
export const securitySettingsSchema = z.object({
  twoFactorEnabled: z.boolean().optional(),
  
  trustedDevices: z
    .array(z.object({
      deviceId: z.string().uuid(),
      name: z.string().max(100),
      lastUsed: z.date().optional(),
      trusted: z.boolean()
    }))
    .optional(),
  
  loginNotifications: z.boolean().default(true),
  
  ipWhitelist: z
    .array(z.string().ip())
    .max(10, 'Maximum 10 IP addresses allowed')
    .optional(),
  
  sessionManagement: z.object({
    maxConcurrentSessions: z
      .number()
      .min(1)
      .max(10)
      .default(3),
    autoLogoutInactive: z
      .number()
      .min(15)
      .max(1440)
      .default(60), // minutes
    requireMfaForSensitive: z.boolean().default(true)
  }).default({})
})

/**
 * User activity log query schema
 */
export const activityLogQuerySchema = z.object({
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(20),
  
  type: z
    .enum(['login', 'logout', 'profile_update', 'password_change', 'portfolio_action', 'security', 'api_access'])
    .optional(),
  
  startDate: z
    .string()
    .transform((val) => new Date(val))
    .refine((date) => !isNaN(date.getTime()), { message: 'Invalid start date' })
    .optional(),
  
  endDate: z
    .string()
    .transform((val) => new Date(val))
    .refine((date) => !isNaN(date.getTime()), { message: 'Invalid end date' })
    .optional(),
  
  ipAddress: z.string().ip().optional(),
  
  success: z.boolean().optional()
}).refine((data) => {
  if (data.startDate && data.endDate) {
    return data.startDate <= data.endDate
  }
  return true
}, { message: 'Start date must be before end date' })

/**
 * User export data schema
 */
export const exportDataSchema = z.object({
  format: z.enum(['json', 'csv', 'pdf']).default('json'),
  
  includePortfolios: z.boolean().default(true),
  includeTransactions: z.boolean().default(true),
  includePreferences: z.boolean().default(false),
  includeActivityLog: z.boolean().default(false),
  
  dateRange: z.object({
    start: z.date().optional(),
    end: z.date().optional()
  }).optional(),
  
  password: z
    .string()
    .min(1, 'Password required for data export')
})

/**
 * Account verification schema
 */
export const accountVerificationSchema = z.object({
  verificationType: z.enum(['identity', 'address', 'phone'], {
    errorMap: () => ({ message: 'Invalid verification type' })
  }),
  
  documents: z
    .array(z.object({
      type: z.enum(['passport', 'drivers_license', 'national_id', 'utility_bill', 'bank_statement']),
      file: z.instanceof(Buffer),
      filename: z.string(),
      mimetype: z.string().refine(
        (type) => ['image/jpeg', 'image/png', 'application/pdf'].includes(type),
        { message: 'Document must be JPEG, PNG, or PDF format' }
      )
    }))
    .min(1, 'At least one document is required')
    .max(5, 'Maximum 5 documents allowed'),
  
  additionalInfo: z
    .string()
    .max(1000, 'Additional information must be less than 1000 characters')
    .optional()
})

/**
 * User search schema (admin use)
 */
export const userSearchSchema = z.object({
  query: z.string().min(1).max(200),
  
  field: z
    .enum(['email', 'name', 'id', 'phone'])
    .default('email'),
  
  status: z
    .enum(['active', 'inactive', 'banned', 'pending_verification'])
    .optional(),
  
  verified: z.boolean().optional(),
  
  createdAfter: z.date().optional(),
  createdBefore: z.date().optional(),
  
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(20)
})

// Export TypeScript types
export type UpdateProfile = z.infer<typeof updateProfileSchema>
export type UserPreferences = z.infer<typeof userPreferencesSchema>
export type AvatarUpload = z.infer<typeof avatarUploadSchema>
export type SecuritySettings = z.infer<typeof securitySettingsSchema>
export type ActivityLogQuery = z.infer<typeof activityLogQuerySchema>
export type ExportData = z.infer<typeof exportDataSchema>
export type AccountVerification = z.infer<typeof accountVerificationSchema>
export type UserSearch = z.infer<typeof userSearchSchema>

export default {
  updateProfileSchema,
  userPreferencesSchema,
  avatarUploadSchema,
  securitySettingsSchema,
  activityLogQuerySchema,
  exportDataSchema,
  accountVerificationSchema,
  userSearchSchema
}