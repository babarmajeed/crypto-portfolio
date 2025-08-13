import { z } from 'zod'
import { 
  uuidSchema, 
  currencyCodeSchema, 
  amountSchema, 
  percentageSchema, 
  timePeriodSchema,
  listQuerySchema 
} from './common.schema'

/**
 * Portfolio creation schema
 */
export const createPortfolioSchema = z.object({
  name: z
    .string()
    .min(1, 'Portfolio name is required')
    .max(100, 'Portfolio name must be less than 100 characters')
    .trim(),
  
  description: z
    .string()
    .max(500, 'Description must be less than 500 characters')
    .optional(),
  
  currency: currencyCodeSchema.default('USD'),
  
  visibility: z
    .enum(['private', 'public', 'shared'])
    .default('private'),
  
  tags: z
    .array(z.string().min(1).max(30).trim())
    .max(10, 'Maximum 10 tags allowed')
    .default([])
    .transform((tags) => [...new Set(tags)]), // Remove duplicates
  
  initialValue: amountSchema.optional(),
  
  riskLevel: z
    .enum(['conservative', 'moderate', 'aggressive', 'custom'])
    .default('moderate'),
  
  autoSync: z.boolean().default(true),
  
  trackPerformance: z.boolean().default(true)
})

/**
 * Portfolio update schema
 */
export const updatePortfolioSchema = createPortfolioSchema
  .partial()
  .extend({
    id: uuidSchema
  })

/**
 * Add holding to portfolio schema
 */
export const addHoldingSchema = z.object({
  portfolioId: uuidSchema,
  
  asset: z.object({
    symbol: z
      .string()
      .min(1)
      .max(20)
      .toUpperCase()
      .trim(),
    name: z
      .string()
      .max(100)
      .optional(),
    type: z
      .enum(['cryptocurrency', 'stock', 'commodity', 'fiat'])
      .default('cryptocurrency'),
    network: z
      .string()
      .max(50)
      .optional()
  }),
  
  quantity: amountSchema,
  
  averagePrice: amountSchema,
  
  source: z
    .enum(['manual', 'exchange_api', 'csv_import', 'api'])
    .default('manual'),
  
  sourceId: z
    .string()
    .optional(), // Exchange or source identifier
  
  notes: z
    .string()
    .max(500)
    .optional(),
  
  purchaseDate: z
    .string()
    .transform((val) => new Date(val))
    .refine((date) => !isNaN(date.getTime()) && date <= new Date(), {
      message: 'Purchase date cannot be in the future'
    })
    .optional()
})

/**
 * Update holding schema
 */
export const updateHoldingSchema = z.object({
  id: uuidSchema,
  quantity: amountSchema.optional(),
  averagePrice: amountSchema.optional(),
  notes: z.string().max(500).optional()
})

/**
 * Portfolio rebalancing schema
 */
export const rebalancePortfolioSchema = z.object({
  portfolioId: uuidSchema,
  
  targetAllocations: z
    .array(z.object({
      symbol: z.string().min(1).max(20).toUpperCase(),
      targetPercentage: percentageSchema
    }))
    .min(1, 'At least one allocation is required')
    .refine((allocations) => {
      const totalPercentage = allocations.reduce((sum, alloc) => sum + alloc.targetPercentage, 0)
      return Math.abs(totalPercentage - 100) < 0.01 // Allow for small floating point errors
    }, { message: 'Target allocations must sum to 100%' }),
  
  rebalanceThreshold: percentageSchema
    .min(1)
    .max(50)
    .default(5), // Minimum deviation to trigger rebalance
  
  executeImmediately: z.boolean().default(false),
  
  preserveCash: amountSchema.optional() // Amount of cash to preserve
})

/**
 * Portfolio performance query schema
 */
export const portfolioPerformanceSchema = z.object({
  portfolioId: uuidSchema,
  
  period: timePeriodSchema.default('1M'),
  
  metrics: z
    .array(z.enum([
      'total_value',
      'total_return',
      'percentage_return',
      'daily_pnl',
      'volatility',
      'sharpe_ratio',
      'max_drawdown',
      'beta',
      'alpha'
    ]))
    .default(['total_value', 'total_return', 'percentage_return']),
  
  benchmark: z
    .string()
    .max(20)
    .optional(), // Compare against BTC, ETH, S&P500, etc.
  
  groupBy: z
    .enum(['day', 'week', 'month'])
    .default('day')
})

/**
 * Portfolio analytics schema
 */
export const portfolioAnalyticsSchema = z.object({
  portfolioId: uuidSchema,
  
  includeHoldings: z.boolean().default(true),
  includePerformance: z.boolean().default(true),
  includeRiskMetrics: z.boolean().default(false),
  includeBenchmark: z.boolean().default(false),
  
  period: timePeriodSchema.default('1M'),
  
  currency: currencyCodeSchema.optional() // Override portfolio default currency
})

/**
 * Portfolio sharing schema
 */
export const sharePortfolioSchema = z.object({
  portfolioId: uuidSchema,
  
  shareType: z.enum(['read_only', 'collaborative', 'public_link']),
  
  permissions: z.object({
    viewHoldings: z.boolean().default(true),
    viewPerformance: z.boolean().default(true),
    viewTransactions: z.boolean().default(false),
    addHoldings: z.boolean().default(false),
    editHoldings: z.boolean().default(false),
    deleteHoldings: z.boolean().default(false)
  }).optional(),
  
  expiresAt: z
    .string()
    .transform((val) => new Date(val))
    .refine((date) => date > new Date(), {
      message: 'Expiration date must be in the future'
    })
    .optional(),
  
  recipientEmails: z
    .array(z.string().email())
    .max(10, 'Maximum 10 recipients allowed')
    .optional(),
  
  message: z
    .string()
    .max(500)
    .optional()
})

/**
 * Portfolio export schema
 */
export const exportPortfolioSchema = z.object({
  portfolioId: uuidSchema,
  
  format: z.enum(['json', 'csv', 'xlsx', 'pdf']).default('csv'),
  
  includeHoldings: z.boolean().default(true),
  includeTransactions: z.boolean().default(false),
  includePerformance: z.boolean().default(false),
  includeAnalytics: z.boolean().default(false),
  
  dateRange: z.object({
    start: z
      .string()
      .transform((val) => new Date(val))
      .optional(),
    end: z
      .string()
      .transform((val) => new Date(val))
      .optional()
  }).optional(),
  
  currency: currencyCodeSchema.optional()
})

/**
 * Portfolio watchlist schema
 */
export const portfolioWatchlistSchema = z.object({
  portfolioId: uuidSchema,
  
  assets: z
    .array(z.object({
      symbol: z.string().min(1).max(20).toUpperCase(),
      name: z.string().max(100).optional(),
      type: z.enum(['cryptocurrency', 'stock', 'commodity', 'fiat']).default('cryptocurrency'),
      alerts: z.object({
        priceAbove: amountSchema.optional(),
        priceBelow: amountSchema.optional(),
        percentageChange: percentageSchema.optional()
      }).optional()
    }))
    .max(50, 'Maximum 50 assets in watchlist')
})

/**
 * Portfolio list query schema
 */
export const portfolioListQuerySchema = listQuerySchema.extend({
  visibility: z.enum(['private', 'public', 'shared', 'all']).default('all'),
  riskLevel: z.enum(['conservative', 'moderate', 'aggressive', 'custom']).optional(),
  currency: currencyCodeSchema.optional(),
  minValue: amountSchema.optional(),
  maxValue: amountSchema.optional(),
  tags: z.string().transform(str => str.split(',').map(tag => tag.trim())).optional()
})

/**
 * Portfolio comparison schema
 */
export const comparePortfoliosSchema = z.object({
  portfolioIds: z
    .array(uuidSchema)
    .min(2, 'At least 2 portfolios required for comparison')
    .max(5, 'Maximum 5 portfolios can be compared'),
  
  period: timePeriodSchema.default('1M'),
  
  metrics: z
    .array(z.enum([
      'total_return',
      'percentage_return',
      'volatility',
      'sharpe_ratio',
      'max_drawdown'
    ]))
    .default(['total_return', 'percentage_return']),
  
  normalizeCurrency: currencyCodeSchema.optional()
})

/**
 * Portfolio backup schema
 */
export const backupPortfolioSchema = z.object({
  portfolioId: uuidSchema,
  
  includeTransactions: z.boolean().default(true),
  includePerformanceHistory: z.boolean().default(true),
  includeSettings: z.boolean().default(true),
  
  encryptBackup: z.boolean().default(true),
  
  password: z
    .string()
    .min(8)
    .optional()
    .refine((password, ctx) => {
      if (ctx.parent.encryptBackup && !password) {
        return false
      }
      return true
    }, { message: 'Password required for encrypted backups' })
})

// Export TypeScript types
export type CreatePortfolio = z.infer<typeof createPortfolioSchema>
export type UpdatePortfolio = z.infer<typeof updatePortfolioSchema>
export type AddHolding = z.infer<typeof addHoldingSchema>
export type UpdateHolding = z.infer<typeof updateHoldingSchema>
export type RebalancePortfolio = z.infer<typeof rebalancePortfolioSchema>
export type PortfolioPerformance = z.infer<typeof portfolioPerformanceSchema>
export type PortfolioAnalytics = z.infer<typeof portfolioAnalyticsSchema>
export type SharePortfolio = z.infer<typeof sharePortfolioSchema>
export type ExportPortfolio = z.infer<typeof exportPortfolioSchema>
export type PortfolioWatchlist = z.infer<typeof portfolioWatchlistSchema>
export type PortfolioListQuery = z.infer<typeof portfolioListQuerySchema>
export type ComparePortfolios = z.infer<typeof comparePortfoliosSchema>
export type BackupPortfolio = z.infer<typeof backupPortfolioSchema>

export default {
  createPortfolioSchema,
  updatePortfolioSchema,
  addHoldingSchema,
  updateHoldingSchema,
  rebalancePortfolioSchema,
  portfolioPerformanceSchema,
  portfolioAnalyticsSchema,
  sharePortfolioSchema,
  exportPortfolioSchema,
  portfolioWatchlistSchema,
  portfolioListQuerySchema,
  comparePortfoliosSchema,
  backupPortfolioSchema
}