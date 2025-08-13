import { z } from 'zod'
import { uuidSchema, listQuerySchema } from './common.schema'

/**
 * API key creation schema
 */
export const createApiKeySchema = z.object({
  name: z
    .string()
    .min(1, 'API key name is required')
    .max(100, 'Name must be less than 100 characters')
    .trim(),
  
  description: z
    .string()
    .max(500, 'Description must be less than 500 characters')
    .optional(),
  
  permissions: z
    .array(z.enum([
      'read:portfolio',
      'read:transactions',
      'read:market_data',
      'write:portfolio',
      'write:transactions',
      'admin:users',
      'admin:system'
    ]))
    .min(1, 'At least one permission is required')
    .max(10, 'Maximum 10 permissions allowed'),
  
  scopes: z
    .array(z.string().min(1).max(50))
    .max(20, 'Maximum 20 scopes allowed')
    .default([]),
  
  expiresAt: z
    .string()
    .transform((val) => new Date(val))
    .refine((date) => {
      if (isNaN(date.getTime())) return false
      const now = new Date()
      const maxExpiry = new Date(now.getTime() + (365 * 24 * 60 * 60 * 1000)) // 1 year
      return date > now && date <= maxExpiry
    }, { message: 'Expiry date must be between now and 1 year from now' })
    .optional(),
  
  ipWhitelist: z
    .array(z.string().ip())
    .max(10, 'Maximum 10 IP addresses allowed')
    .optional(),
  
  rateLimit: z.object({
    requestsPerMinute: z
      .number()
      .min(1)
      .max(1000)
      .default(60),
    burstLimit: z
      .number()
      .min(1)
      .max(100)
      .default(10)
  }).default({}),
  
  isActive: z.boolean().default(true)
})

/**
 * API key update schema
 */
export const updateApiKeySchema = z.object({
  id: uuidSchema,
  
  name: z
    .string()
    .min(1)
    .max(100)
    .trim()
    .optional(),
  
  description: z
    .string()
    .max(500)
    .optional(),
  
  permissions: z
    .array(z.enum([
      'read:portfolio',
      'read:transactions',
      'read:market_data',
      'write:portfolio',
      'write:transactions',
      'admin:users',
      'admin:system'
    ]))
    .min(1)
    .max(10)
    .optional(),
  
  scopes: z
    .array(z.string().min(1).max(50))
    .max(20)
    .optional(),
  
  expiresAt: z
    .string()
    .transform((val) => new Date(val))
    .refine((date) => {
      if (isNaN(date.getTime())) return false
      const now = new Date()
      const maxExpiry = new Date(now.getTime() + (365 * 24 * 60 * 60 * 1000))
      return date > now && date <= maxExpiry
    }, { message: 'Expiry date must be between now and 1 year from now' })
    .optional(),
  
  ipWhitelist: z
    .array(z.string().ip())
    .max(10)
    .optional(),
  
  rateLimit: z.object({
    requestsPerMinute: z.number().min(1).max(1000).optional(),
    burstLimit: z.number().min(1).max(100).optional()
  }).optional(),
  
  isActive: z.boolean().optional()
})

/**
 * API key rotation schema
 */
export const rotateApiKeySchema = z.object({
  id: uuidSchema,
  
  gracePeriodHours: z
    .number()
    .min(1, 'Grace period must be at least 1 hour')
    .max(168, 'Grace period cannot exceed 1 week (168 hours)')
    .default(24),
  
  notifyRotation: z.boolean().default(true),
  
  reason: z
    .string()
    .max(500, 'Reason must be less than 500 characters')
    .optional()
})

/**
 * Exchange API key schema (for integrations)
 */
export const exchangeApiKeySchema = z.object({
  exchangeName: z.enum([
    'binance',
    'coinbase_pro',
    'kraken',
    'bitfinex',
    'huobi',
    'kucoin',
    'okex',
    'bybit',
    'gate_io',
    'crypto_com'
  ]),
  
  keyName: z
    .string()
    .min(1)
    .max(100)
    .trim(),
  
  credentials: z.object({
    apiKey: z
      .string()
      .min(10, 'API key too short')
      .max(200, 'API key too long'),
    
    apiSecret: z
      .string()
      .min(10, 'API secret too short')
      .max(500, 'API secret too long'),
    
    passphrase: z
      .string()
      .max(100)
      .optional(), // For exchanges like Coinbase Pro
    
    testnet: z.boolean().default(false),
    
    subAccountId: z
      .string()
      .max(100)
      .optional()
  }),
  
  permissions: z.object({
    read: z.boolean().default(true),
    trade: z.boolean().default(false),
    withdraw: z.boolean().default(false),
    futures: z.boolean().default(false),
    margin: z.boolean().default(false)
  }).default({}),
  
  encryptionSettings: z.object({
    useHardwareEncryption: z.boolean().default(true),
    keyDerivationRounds: z
      .number()
      .min(100000)
      .max(1000000)
      .default(600000),
    additionalEntropy: z.boolean().default(true)
  }).default({})
})

/**
 * Exchange API key update schema
 */
export const updateExchangeApiKeySchema = z.object({
  id: uuidSchema,
  
  keyName: z
    .string()
    .min(1)
    .max(100)
    .trim()
    .optional(),
  
  credentials: z.object({
    apiKey: z.string().min(10).max(200).optional(),
    apiSecret: z.string().min(10).max(500).optional(),
    passphrase: z.string().max(100).optional(),
    testnet: z.boolean().optional(),
    subAccountId: z.string().max(100).optional()
  }).optional(),
  
  permissions: z.object({
    read: z.boolean().optional(),
    trade: z.boolean().optional(),
    withdraw: z.boolean().optional(),
    futures: z.boolean().optional(),
    margin: z.boolean().optional()
  }).optional(),
  
  isActive: z.boolean().optional(),
  
  rotateCredentials: z.boolean().default(false)
})

/**
 * API key validation schema
 */
export const validateApiKeySchema = z.object({
  keyId: uuidSchema.optional(),
  apiKey: z.string().min(32).max(128).optional(),
  
  requiredPermissions: z
    .array(z.string())
    .optional(),
  
  requiredScopes: z
    .array(z.string())
    .optional(),
  
  checkRateLimit: z.boolean().default(true),
  
  checkExpiry: z.boolean().default(true),
  
  checkIPWhitelist: z.boolean().default(true)
}).refine((data) => data.keyId || data.apiKey, {
  message: 'Either keyId or apiKey must be provided'
})

/**
 * API key usage analytics schema
 */
export const apiKeyUsageSchema = z.object({
  keyId: uuidSchema,
  
  period: z
    .enum(['1h', '6h', '24h', '7d', '30d', '90d'])
    .default('24h'),
  
  groupBy: z
    .enum(['hour', 'day', 'week'])
    .default('hour'),
  
  includeFailures: z.boolean().default(true),
  
  includeIPBreakdown: z.boolean().default(false),
  
  includeEndpointBreakdown: z.boolean().default(false)
})

/**
 * API key security audit schema
 */
export const apiKeySecurityAuditSchema = z.object({
  keyId: uuidSchema.optional(), // If not provided, audit all keys
  
  auditType: z
    .enum(['permissions', 'usage_patterns', 'security_violations', 'comprehensive'])
    .default('comprehensive'),
  
  includeRecommendations: z.boolean().default(true),
  
  timeRange: z.object({
    start: z
      .string()
      .transform((val) => new Date(val))
      .refine((date) => !isNaN(date.getTime()), { message: 'Invalid start date' })
      .optional(),
    
    end: z
      .string()
      .transform((val) => new Date(val))
      .refine((date) => !isNaN(date.getTime()), { message: 'Invalid end date' })
      .optional()
  }).optional()
})

/**
 * Bulk API key operations schema
 */
export const bulkApiKeyOperationSchema = z.object({
  keyIds: z
    .array(uuidSchema)
    .min(1, 'At least one key ID is required')
    .max(100, 'Maximum 100 keys can be operated on at once'),
  
  operation: z.enum(['activate', 'deactivate', 'rotate', 'delete', 'update_permissions']),
  
  parameters: z.object({
    permissions: z
      .array(z.string())
      .optional(), // For update_permissions operation
    
    gracePeriodHours: z
      .number()
      .min(1)
      .max(168)
      .optional(), // For rotate operation
    
    reason: z
      .string()
      .max(500)
      .optional() // Operation reason
  }).optional(),
  
  confirmOperation: z
    .boolean()
    .refine((val) => val === true, {
      message: 'Operation must be confirmed'
    })
})

/**
 * API key list query schema
 */
export const apiKeyListQuerySchema = listQuerySchema.extend({
  status: z.enum(['active', 'inactive', 'expired', 'all']).default('all'),
  
  exchange: z
    .string()
    .max(50)
    .optional(), // Filter by exchange
  
  permissions: z
    .string()
    .transform((str) => str.split(',').map(p => p.trim()))
    .optional(), // Filter by permissions
  
  expiryRange: z.object({
    start: z.string().transform((val) => new Date(val)).optional(),
    end: z.string().transform((val) => new Date(val)).optional()
  }).optional(),
  
  lastUsedRange: z.object({
    start: z.string().transform((val) => new Date(val)).optional(),
    end: z.string().transform((val) => new Date(val)).optional()
  }).optional()
})

/**
 * Master key operations schema (for key encryption keys)
 */
export const masterKeyOperationSchema = z.object({
  operation: z.enum(['generate', 'rotate', 'backup', 'restore']),
  
  parameters: z.object({
    keyDerivationFunction: z
      .enum(['argon2id', 'pbkdf2', 'scrypt'])
      .default('argon2id'),
    
    keyLength: z
      .enum([256, 384, 512])
      .default(256),
    
    backupLocation: z
      .string()
      .max(500)
      .optional(), // For backup operation
    
    password: z
      .string()
      .min(12, 'Master key password must be at least 12 characters')
      .optional(), // Required for certain operations
    
    confirmPassword: z.string().optional()
  }).optional().refine((params) => {
    if (params?.password && params?.confirmPassword) {
      return params.password === params.confirmPassword
    }
    return true
  }, { message: 'Passwords do not match' }),
  
  confirmOperation: z
    .boolean()
    .refine((val) => val === true, {
      message: 'Master key operation must be confirmed'
    })
})

// Export TypeScript types
export type CreateApiKey = z.infer<typeof createApiKeySchema>
export type UpdateApiKey = z.infer<typeof updateApiKeySchema>
export type RotateApiKey = z.infer<typeof rotateApiKeySchema>
export type ExchangeApiKey = z.infer<typeof exchangeApiKeySchema>
export type UpdateExchangeApiKey = z.infer<typeof updateExchangeApiKeySchema>
export type ValidateApiKey = z.infer<typeof validateApiKeySchema>
export type ApiKeyUsage = z.infer<typeof apiKeyUsageSchema>
export type ApiKeySecurityAudit = z.infer<typeof apiKeySecurityAuditSchema>
export type BulkApiKeyOperation = z.infer<typeof bulkApiKeyOperationSchema>
export type ApiKeyListQuery = z.infer<typeof apiKeyListQuerySchema>
export type MasterKeyOperation = z.infer<typeof masterKeyOperationSchema>

export default {
  createApiKeySchema,
  updateApiKeySchema,
  rotateApiKeySchema,
  exchangeApiKeySchema,
  updateExchangeApiKeySchema,
  validateApiKeySchema,
  apiKeyUsageSchema,
  apiKeySecurityAuditSchema,
  bulkApiKeyOperationSchema,
  apiKeyListQuerySchema,
  masterKeyOperationSchema
}