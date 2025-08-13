import { z } from 'zod'

/**
 * Common pagination schema for list endpoints
 */
export const paginationSchema = z.object({
  page: z
    .string()
    .optional()
    .default('1')
    .transform((val) => parseInt(val, 10))
    .refine((val) => val >= 1, { message: 'Page must be >= 1' }),
  
  limit: z
    .string()
    .optional()
    .default('10')
    .transform((val) => parseInt(val, 10))
    .refine((val) => val >= 1 && val <= 100, { 
      message: 'Limit must be between 1 and 100' 
    }),
  
  sort: z
    .string()
    .optional()
    .refine((val) => {
      if (!val) return true
      // Allow sorting by field with optional - prefix for descending
      return /^-?[a-zA-Z_][a-zA-Z0-9_.]*$/.test(val)
    }, { message: 'Invalid sort format. Use field or -field for descending' })
})

/**
 * Common search schema
 */
export const searchSchema = z.object({
  q: z
    .string()
    .min(1, 'Search query cannot be empty')
    .max(200, 'Search query too long')
    .optional(),
  
  fields: z
    .string()
    .optional()
    .transform((val) => val?.split(',').map(f => f.trim()))
    .refine((fields) => {
      if (!fields) return true
      return fields.every(field => /^[a-zA-Z_][a-zA-Z0-9_.]*$/.test(field))
    }, { message: 'Invalid field names in search fields' })
})

/**
 * Date range filtering schema
 */
export const dateRangeSchema = z.object({
  startDate: z
    .string()
    .optional()
    .refine((val) => {
      if (!val) return true
      return !isNaN(Date.parse(val))
    }, { message: 'Invalid start date format' })
    .transform((val) => val ? new Date(val) : undefined),
  
  endDate: z
    .string()
    .optional()
    .refine((val) => {
      if (!val) return true
      return !isNaN(Date.parse(val))
    }, { message: 'Invalid end date format' })
    .transform((val) => val ? new Date(val) : undefined)
}).refine((data) => {
  if (data.startDate && data.endDate) {
    return data.startDate <= data.endDate
  }
  return true
}, { message: 'Start date must be before end date' })

/**
 * UUID validation schema
 */
export const uuidSchema = z
  .string()
  .uuid({ message: 'Invalid UUID format' })

/**
 * Common ID parameter schema
 */
export const idParamSchema = z.object({
  id: uuidSchema
})

/**
 * Email validation schema
 */
export const emailSchema = z
  .string()
  .email({ message: 'Invalid email format' })
  .toLowerCase()
  .trim()

/**
 * Password strength schema
 */
export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must be less than 128 characters')
  .refine((password) => {
    // At least one uppercase letter
    if (!/[A-Z]/.test(password)) return false
    // At least one lowercase letter
    if (!/[a-z]/.test(password)) return false
    // At least one number
    if (!/\d/.test(password)) return false
    // At least one special character
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) return false
    return true
  }, {
    message: 'Password must contain at least one uppercase letter, lowercase letter, number, and special character'
  })

/**
 * Phone number schema (international format)
 */
export const phoneSchema = z
  .string()
  .regex(/^\+[1-9]\d{1,14}$/, 'Invalid phone number format. Use international format (+1234567890)')
  .optional()

/**
 * URL validation schema
 */
export const urlSchema = z
  .string()
  .url({ message: 'Invalid URL format' })
  .optional()

/**
 * Currency code schema (ISO 4217)
 */
export const currencyCodeSchema = z
  .string()
  .length(3, 'Currency code must be 3 characters')
  .toUpperCase()
  .refine((code) => {
    // Common currency codes
    const validCurrencies = [
      'USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'CNY', 'SEK', 'NZD',
      'MXN', 'SGD', 'HKD', 'NOK', 'KRW', 'TRY', 'RUB', 'INR', 'BRL', 'ZAR',
      'BTC', 'ETH', 'BNB', 'ADA', 'DOT', 'SOL', 'AVAX', 'MATIC', 'LINK', 'UNI'
    ]
    return validCurrencies.includes(code)
  }, { message: 'Invalid or unsupported currency code' })

/**
 * Decimal amount schema for financial values
 */
export const amountSchema = z
  .number()
  .or(z.string().transform((val) => parseFloat(val)))
  .refine((val) => !isNaN(val) && isFinite(val), { message: 'Invalid amount' })
  .refine((val) => val >= 0, { message: 'Amount must be non-negative' })
  .refine((val) => val <= 1e15, { message: 'Amount too large' })

/**
 * Percentage schema (0-100)
 */
export const percentageSchema = z
  .number()
  .or(z.string().transform((val) => parseFloat(val)))
  .refine((val) => !isNaN(val) && isFinite(val), { message: 'Invalid percentage' })
  .refine((val) => val >= 0 && val <= 100, { message: 'Percentage must be between 0 and 100' })

/**
 * Time period schema
 */
export const timePeriodSchema = z.enum([
  '1m', '5m', '15m', '30m', '1h', '4h', '6h', '12h',
  '1d', '3d', '1w', '2w', '1M', '3M', '6M', '1y', '2y', '5y', 'all'
], {
  errorMap: () => ({ message: 'Invalid time period' })
})

/**
 * Status filter schema
 */
export const statusSchema = z.enum([
  'active', 'inactive', 'pending', 'completed', 'failed', 'cancelled', 'processing'
], {
  errorMap: () => ({ message: 'Invalid status' })
})

/**
 * File upload schema
 */
export const fileUploadSchema = z.object({
  fieldname: z.string(),
  originalname: z.string(),
  encoding: z.string(),
  mimetype: z.string(),
  size: z.number().max(5 * 1024 * 1024, 'File size must be less than 5MB'),
  buffer: z.instanceof(Buffer).optional(),
  filename: z.string().optional(),
  path: z.string().optional()
})

/**
 * API response envelope schema
 */
export const responseEnvelopeSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
  data: z.any().optional(),
  pagination: z.object({
    page: z.number(),
    limit: z.number(),
    total: z.number(),
    pages: z.number(),
    hasNext: z.boolean(),
    hasPrev: z.boolean()
  }).optional(),
  error: z.string().optional(),
  code: z.string().optional(),
  timestamp: z.string().optional()
})

/**
 * Combined query schema for list endpoints
 */
export const listQuerySchema = paginationSchema
  .merge(searchSchema)
  .merge(dateRangeSchema)
  .extend({
    status: statusSchema.optional(),
    sortBy: z.string().optional(),
    order: z.enum(['asc', 'desc']).default('desc')
  })

// Export types for TypeScript
export type PaginationQuery = z.infer<typeof paginationSchema>
export type SearchQuery = z.infer<typeof searchSchema>
export type DateRangeQuery = z.infer<typeof dateRangeSchema>
export type ListQuery = z.infer<typeof listQuerySchema>
export type CurrencyCode = z.infer<typeof currencyCodeSchema>
export type TimePeriod = z.infer<typeof timePeriodSchema>
export type Status = z.infer<typeof statusSchema>
export type FileUpload = z.infer<typeof fileUploadSchema>
export type ResponseEnvelope = z.infer<typeof responseEnvelopeSchema>

export default {
  paginationSchema,
  searchSchema,
  dateRangeSchema,
  uuidSchema,
  idParamSchema,
  emailSchema,
  passwordSchema,
  phoneSchema,
  urlSchema,
  currencyCodeSchema,
  amountSchema,
  percentageSchema,
  timePeriodSchema,
  statusSchema,
  fileUploadSchema,
  responseEnvelopeSchema,
  listQuerySchema
}