export interface Asset {
  id: string
  symbol: string
  name: string
  currentPrice: number
  priceChange24h: number
  priceChangePercentage24h: number
  marketCap: number
  volume24h: number
  circulatingSupply: number
  totalSupply: number
  maxSupply: number | null
  image: string
  lastUpdated: string
}

export interface Portfolio {
  id: string
  userId: string
  name: string
  totalValue: number
  totalChange24h: number
  totalChangePercentage24h: number
  holdings: Holding[]
  createdAt: string
  updatedAt: string
}

export interface Holding {
  id: string
  portfolioId: string
  assetId: string
  asset: Asset
  amount: number
  averagePrice: number
  totalValue: number
  totalChange: number
  totalChangePercentage: number
  allocation: number
  transactions: Transaction[]
}

export interface Transaction {
  id: string
  portfolioId: string
  assetId: string
  asset?: Asset
  type: 'buy' | 'sell'
  amount: number
  price: number
  totalValue: number
  fee: number
  timestamp: string
  exchange?: string
  notes?: string
}

export interface User {
  id: string
  email: string
  firstName: string
  lastName: string
  preferences: UserPreferences
  createdAt: string
  updatedAt: string
}

export interface UserPreferences {
  currency: string
  timezone: string
  notifications: {
    email: boolean
    push: boolean
    priceAlerts: boolean
    portfolioUpdates: boolean
  }
  privacy: {
    hideBalances: boolean
    sharePortfolio: boolean
  }
}

export interface PriceAlert {
  id: string
  userId: string
  assetId: string
  asset: Asset
  type: 'above' | 'below'
  targetPrice: number
  isActive: boolean
  createdAt: string
}

export interface ApiResponse<T> {
  data: T
  success: boolean
  message?: string
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export interface ChartData {
  timestamp: string
  price: number
  volume: number
}

export interface MarketOverview {
  totalMarketCap: number
  totalVolume24h: number
  marketCapChange24h: number
  activeCryptocurrencies: number
  dominance: {
    bitcoin: number
    ethereum: number
  }
}