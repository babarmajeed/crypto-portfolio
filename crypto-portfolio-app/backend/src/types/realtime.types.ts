export interface RealtimePrice {
  symbol: string;
  price: number;
  change24h: number;
  changePercent24h: number;
  volume24h: number;
  high24h: number;
  low24h: number;
  lastUpdate: Date;
  source: string;
}

export interface PriceSource {
  exchange: string;
  symbol: string;
  price: number;
  timestamp: Date;
  weight: number; // For price aggregation
}

export interface PortfolioRealTimeData {
  portfolioId: string;
  totalValue: number;
  totalCost: number;
  unrealizedPnl: number;
  change24h: number;
  changePercent: number;
  holdings: HoldingRealTimeData[];
  lastCalculated: Date;
}

export interface HoldingRealTimeData {
  cryptocurrencyId: string;
  symbol: string;
  quantity: number;
  averageCost: number;
  currentPrice: number;
  value: number;
  unrealizedPnl: number;
  change24h: number;
  changePercent: number;
  allocation: number; // Percentage of portfolio
}

export interface MarketDataSnapshot {
  symbol: string;
  price: number;
  volume24h: number;
  change24h: number;
  changePercent24h: number;
  high24h: number;
  low24h: number;
  marketCap?: number;
  rank?: number;
  lastUpdate: Date;
}

export interface OrderBookLevel {
  price: number;
  quantity: number;
  total?: number; // Running total
}

export interface OrderBookSnapshot {
  symbol: string;
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  spread: number;
  timestamp: Date;
}

export interface TradeSnapshot {
  symbol: string;
  price: number;
  quantity: number;
  side: 'buy' | 'sell';
  timestamp: Date;
  tradeId: string;
  exchange?: string;
}

export interface PriceAlert {
  id: string;
  userId: string;
  symbol: string;
  type: 'above' | 'below' | 'percentage_change';
  targetPrice?: number;
  percentageThreshold?: number;
  currentPrice: number;
  isActive: boolean;
  triggeredAt?: Date;
  createdAt: Date;
}

export interface MarketTrend {
  symbol: string;
  trend: 'bullish' | 'bearish' | 'sideways';
  strength: number; // 0-100
  indicators: {
    rsi?: number;
    macd?: number;
    sma20?: number;
    sma50?: number;
    volume?: number;
  };
  lastAnalyzed: Date;
}

export interface ExchangeConnection {
  exchange: string;
  status: 'connected' | 'disconnected' | 'reconnecting' | 'error';
  lastPing: Date;
  subscriptions: string[];
  errorCount: number;
  lastError?: string;
}

export interface RealTimeMetrics {
  priceUpdatesPerSecond: number;
  portfolioCalculationsPerMinute: number;
  activeConnections: number;
  messageLatency: {
    p50: number;
    p95: number;
    p99: number;
  };
  memoryUsage: {
    rss: number;
    heapUsed: number;
    heapTotal: number;
  };
  lastUpdated: Date;
}