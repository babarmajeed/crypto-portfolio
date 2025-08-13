import { z } from 'zod'
import { uuidSchema, listQuerySchema } from './common.schema'

/**
 * Supported exchanges enum
 */
const supportedExchanges = [
  'binance',
  'coinbase_pro',
  'kraken',
  'bitfinex',
  'huobi',
  'kucoin',
  'okex',
  'bybit',
  'gate_io',
  'crypto_com',
  'bitget',
  'mexc'
] as const

/**
 * Exchange connection schema
 */
export const connectExchangeSchema = z.object({
  exchange: z.enum(supportedExchanges, {
    errorMap: () => ({ message: 'Unsupported exchange' })
  }),
  
  name: z
    .string()
    .min(1, 'Connection name is required')
    .max(100, 'Name must be less than 100 characters')
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
      .max(100, 'Passphrase too long')
      .optional(), // Required for some exchanges like Coinbase Pro
    
    testnet: z.boolean().default(false),
    
    subAccount: z
      .string()
      .max(100)
      .optional() // For exchanges that support sub-accounts
  }),
  
  permissions: z.object({
    read: z.boolean().default(true),
    trade: z.boolean().default(false),
    withdraw: z.boolean().default(false)
  }).default({}),
  
  autoSync: z.boolean().default(true),
  
  syncInterval: z
    .enum(['1m', '5m', '15m', '30m', '1h', '4h', '12h', '24h'])
    .default('15m'),
  
  portfolioMapping: z
    .array(z.object({
      portfolioId: uuidSchema,
      includeAssets: z.array(z.string()).optional(), // Specific assets to sync
      excludeAssets: z.array(z.string()).optional()  // Assets to exclude
    }))
    .max(10, 'Maximum 10 portfolio mappings allowed')
    .optional()
})

/**
 * Update exchange connection schema
 */
export const updateExchangeConnectionSchema = z.object({
  id: uuidSchema,
  
  name: z
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
    subAccount: z.string().max(100).optional()
  }).optional(),
  
  permissions: z.object({
    read: z.boolean().optional(),
    trade: z.boolean().optional(),
    withdraw: z.boolean().optional()
  }).optional(),
  
  autoSync: z.boolean().optional(),
  syncInterval: z.enum(['1m', '5m', '15m', '30m', '1h', '4h', '12h', '24h']).optional(),
  
  isActive: z.boolean().optional()
})

/**
 * Exchange credentials validation schema
 */
export const validateCredentialsSchema = z.object({
  exchange: z.enum(supportedExchanges),
  
  credentials: z.object({
    apiKey: z.string().min(1),
    apiSecret: z.string().min(1),
    passphrase: z.string().optional(),
    testnet: z.boolean().default(false),
    subAccount: z.string().optional()
  }),
  
  testConnection: z.boolean().default(true),
  
  testPermissions: z
    .array(z.enum(['read', 'trade', 'withdraw']))
    .default(['read'])
})

/**
 * Manual sync request schema
 */
export const manualSyncSchema = z.object({
  connectionId: uuidSchema,
  
  syncType: z
    .enum(['balances', 'trades', 'orders', 'deposits', 'withdrawals', 'all'])
    .default('all'),
  
  dateRange: z.object({
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
  }).optional(),
  
  forceSync: z.boolean().default(false), // Override last sync timestamp
  
  assets: z
    .array(z.string().min(1).max(20))
    .max(50)
    .optional() // Sync specific assets only
})

/**
 * Exchange balance query schema
 */
export const exchangeBalanceQuerySchema = z.object({
  connectionId: uuidSchema,
  
  includeZero: z.boolean().default(false),
  
  assets: z
    .array(z.string().min(1).max(20))
    .max(100)
    .optional(),
  
  currency: z
    .string()
    .length(3)
    .toUpperCase()
    .optional() // Convert values to specific currency
})

/**
 * Exchange trading schema
 */
export const exchangeTradeSchema = z.object({
  connectionId: uuidSchema,
  
  orderType: z.enum(['market', 'limit', 'stop', 'stop_limit']),
  
  side: z.enum(['buy', 'sell']),
  
  symbol: z
    .string()
    .min(1)
    .max(20)
    .toUpperCase(),
  
  quantity: z
    .number()
    .positive('Quantity must be positive'),
  
  price: z
    .number()
    .positive('Price must be positive')
    .optional(), // Required for limit orders
  
  stopPrice: z
    .number()
    .positive('Stop price must be positive')
    .optional(), // Required for stop orders
  
  timeInForce: z
    .enum(['GTC', 'IOC', 'FOK', 'GTT'])
    .default('GTC'),
  
  clientOrderId: z
    .string()
    .max(50)
    .optional(), // Custom order ID
  
  validateOnly: z.boolean().default(false) // Test order without execution
})

/**
 * Exchange order history query schema
 */
export const orderHistoryQuerySchema = listQuerySchema.extend({
  connectionId: uuidSchema,
  
  symbol: z
    .string()
    .max(20)
    .toUpperCase()
    .optional(),
  
  status: z
    .enum(['open', 'closed', 'canceled', 'expired', 'rejected'])
    .optional(),
  
  side: z
    .enum(['buy', 'sell'])
    .optional(),
  
  orderType: z
    .enum(['market', 'limit', 'stop', 'stop_limit'])
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
    .optional()
})

/**
 * Exchange deposit/withdrawal schema
 */
export const exchangeTransferSchema = z.object({
  connectionId: uuidSchema,
  
  type: z.enum(['deposit', 'withdrawal']),
  
  asset: z
    .string()
    .min(1)
    .max(20)
    .toUpperCase(),
  
  amount: z
    .number()
    .positive('Amount must be positive'),
  
  address: z
    .string()
    .min(1)
    .max(200), // Crypto address or bank details
  
  tag: z
    .string()
    .max(100)
    .optional(), // Memo/tag for some cryptocurrencies
  
  network: z
    .string()
    .max(50)
    .optional(), // Blockchain network (ETH, BSC, TRX, etc.)
  
  twoFactorCode: z
    .string()
    .length(6)
    .regex(/^\d{6}$/)
    .optional() // Required for withdrawals on some exchanges
})

/**
 * Exchange market data query schema
 */
export const marketDataQuerySchema = z.object({
  exchange: z.enum(supportedExchanges).optional(), // If not provided, aggregate from all
  
  symbol: z
    .string()
    .min(1)
    .max(20)
    .toUpperCase(),
  
  interval: z
    .enum(['1m', '5m', '15m', '30m', '1h', '4h', '6h', '12h', '1d', '3d', '1w'])
    .default('1h'),
  
  limit: z
    .number()
    .min(1)
    .max(1000)
    .default(100),
  
  startTime: z
    .number()
    .optional(), // Unix timestamp
  
  endTime: z
    .number()
    .optional() // Unix timestamp
})

/**
 * Exchange fee structure query schema
 */
export const exchangeFeeQuerySchema = z.object({
  connectionId: uuidSchema,
  
  feeType: z
    .enum(['trading', 'deposit', 'withdrawal'])
    .default('trading'),
  
  symbol: z
    .string()
    .max(20)
    .toUpperCase()
    .optional(),
  
  volume24h: z
    .number()
    .nonnegative()
    .optional() // For volume-based fee tiers
})

/**
 * Exchange notification settings schema
 */
export const exchangeNotificationSchema = z.object({
  connectionId: uuidSchema,
  
  notifications: z.object({
    orderFilled: z.boolean().default(true),
    orderCanceled: z.boolean().default(true),
    orderExpired: z.boolean().default(false),
    balanceThreshold: z.object({
      enabled: z.boolean().default(false),
      threshold: z.number().positive().optional(),
      asset: z.string().max(20).toUpperCase().optional()
    }).optional(),
    tradingPaused: z.boolean().default(true),
    maintenanceMode: z.boolean().default(true)
  }),
  
  deliveryMethods: z.object({
    email: z.boolean().default(true),
    push: z.boolean().default(true),
    sms: z.boolean().default(false)
  }).default({})
})

// Export TypeScript types
export type ConnectExchange = z.infer<typeof connectExchangeSchema>
export type UpdateExchangeConnection = z.infer<typeof updateExchangeConnectionSchema>
export type ValidateCredentials = z.infer<typeof validateCredentialsSchema>
export type ManualSync = z.infer<typeof manualSyncSchema>
export type ExchangeBalanceQuery = z.infer<typeof exchangeBalanceQuerySchema>
export type ExchangeTrade = z.infer<typeof exchangeTradeSchema>
export type OrderHistoryQuery = z.infer<typeof orderHistoryQuerySchema>
export type ExchangeTransfer = z.infer<typeof exchangeTransferSchema>
export type MarketDataQuery = z.infer<typeof marketDataQuerySchema>
export type ExchangeFeeQuery = z.infer<typeof exchangeFeeQuerySchema>
export type ExchangeNotification = z.infer<typeof exchangeNotificationSchema>
export type SupportedExchange = typeof supportedExchanges[number]

export default {
  connectExchangeSchema,
  updateExchangeConnectionSchema,
  validateCredentialsSchema,
  manualSyncSchema,
  exchangeBalanceQuerySchema,
  exchangeTradeSchema,
  orderHistoryQuerySchema,
  exchangeTransferSchema,
  marketDataQuerySchema,
  exchangeFeeQuerySchema,
  exchangeNotificationSchema,
  supportedExchanges
}