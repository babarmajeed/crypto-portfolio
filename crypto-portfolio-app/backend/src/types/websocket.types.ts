export interface SocketUser {
  userId: string;
  userRole: string;
  socketId: string;
  connectedAt: Date;
}

export interface PriceUpdateData {
  symbol: string;
  price: number;
  change24h: number;
  changePercent24h: number;
  volume24h: number;
  lastUpdate: string;
  source: string;
}

export interface PortfolioUpdateData {
  portfolioId: string;
  userId: string;
  totalValue: number;
  change24h: number;
  changePercent: number;
  holdings: PortfolioHolding[];
  lastUpdate: string;
}

export interface PortfolioHolding {
  symbol: string;
  quantity: number;
  averageCost: number;
  currentPrice: number;
  value: number;
  change24h: number;
  changePercent: number;
}

export interface OrderBookData {
  symbol: string;
  bids: [number, number][];  // [price, quantity]
  asks: [number, number][];
  timestamp: string;
}

export interface TradeData {
  symbol: string;
  price: number;
  quantity: number;
  side: 'buy' | 'sell';
  timestamp: string;
  tradeId: string;
}

export interface MarketAlert {
  type: 'price_threshold' | 'volume_spike' | 'news' | 'technical';
  symbol?: string;
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'critical';
  timestamp: string;
  userId?: string; // For personal alerts
}

export interface SubscriptionRequest {
  type: 'prices' | 'portfolio' | 'orderbook' | 'trades';
  symbols?: string[];
  portfolioId?: string;
  options?: {
    depth?: number;
    interval?: string;
  };
}

export interface SubscriptionResponse {
  type: string;
  status: 'confirmed' | 'error';
  symbols?: string[];
  portfolioId?: string;
  error?: string;
  timestamp: string;
}

export interface WebSocketEvents {
  // Client to Server events
  subscribe_prices: (symbols: string[]) => void;
  unsubscribe_prices: (symbols: string[]) => void;
  subscribe_portfolio: (portfolioId: string) => void;
  unsubscribe_portfolio: (portfolioId: string) => void;
  subscribe_orderbook: (data: { symbol: string; depth?: number }) => void;
  subscribe_trades: (symbol: string) => void;
  refresh_portfolio: (portfolioId: string) => void;
  subscribe_all_portfolios: () => void;

  // Server to Client events
  price_update: (data: PriceUpdateData) => void;
  portfolio_update: (data: PortfolioUpdateData) => void;
  all_portfolios_update: (data: PortfolioUpdateData[]) => void;
  orderbook_update: (data: OrderBookData) => void;
  trade_update: (data: TradeData) => void;
  market_alert: (data: MarketAlert) => void;
  notification: (data: UserNotification) => void;
  subscription_confirmed: (data: SubscriptionResponse) => void;
  subscription_error: (data: SubscriptionResponse) => void;
  unsubscription_confirmed: (data: SubscriptionResponse) => void;
  refresh_error: (data: { portfolioId: string; error: string }) => void;
}

export interface UserNotification {
  id: string;
  userId: string;
  type: 'portfolio' | 'market' | 'system' | 'security';
  title: string;
  message: string;
  data?: any;
  read: boolean;
  timestamp: string;
}

export interface ConnectionMetrics {
  socketId: string;
  userId?: string;
  connectedAt: number;
  lastActivity: number;
  messagesSent: number;
  messagesReceived: number;
  averageLatency: number;
  subscriptions: {
    prices: number;
    portfolios: number;
    orderbooks: number;
    trades: number;
  };
  rateLimitViolations: number;
  errors: number;
}

export interface ClientToServerEvents {
  subscribe_prices: (symbols: string[]) => void;
  unsubscribe_prices: (symbols: string[]) => void;
  subscribe_portfolio: (portfolioId: string) => void;
  unsubscribe_portfolio: (portfolioId: string) => void;
  subscribe_all_portfolios: () => void;
  unsubscribe_all_portfolios: () => void;
  subscribe_orderbook: (data: { symbol: string; depth?: number }) => void;
  unsubscribe_orderbook: (symbol: string) => void;
  subscribe_trades: (symbol: string) => void;
  unsubscribe_trades: (symbol: string) => void;
  refresh_portfolio: (portfolioId: string) => void;
  get_portfolio_summary: (portfolioId: string) => void;
  get_market_stats: () => void;
  get_market_overview: () => void;
  get_portfolio_performance: (portfolioId: string) => void;
  get_system_status: () => void;
  heartbeat: () => void;
}

export interface ServerToClientEvents {
  price_update: (data: PriceUpdateData) => void;
  portfolio_update: (data: PortfolioUpdateData) => void;
  all_portfolios_update: (data: PortfolioUpdateData[]) => void;
  orderbook_update: (data: OrderBookUpdateData) => void;
  trade_update: (data: TradeUpdateData) => void;
  recent_trades: (data: { symbol: string; trades: TradeUpdateData[] }) => void;
  market_stats: (data: any) => void;
  portfolio_summary: (data: any) => void;
  subscription_confirmed: (data: SubscriptionConfirmData) => void;
  subscription_error: (data: SubscriptionErrorData) => void;
  unsubscription_confirmed: (data: SubscriptionConfirmData) => void;
  refresh_error: (data: { portfolioId: string; error: string }) => void;
  error: (data: { event: string; error: string }) => void;
  connection_status: (data: { status: string; timestamp: number }) => void;
  system_status: (data: SystemStatusData) => void;
  rate_limit_exceeded: (data: { event: string; retryAfter: number }) => void;
  market_alert: (data: MarketAlert) => void;
  notification: (data: UserNotification) => void;
}

export interface InterServerEvents {
  broadcast_price_update: (data: any) => void;
  broadcast_portfolio_update: (data: any) => void;
  broadcast_system_alert: (data: any) => void;
}

export interface SocketData {
  user?: {
    id: string;
    role: string;
    email: string;
  };
}

export interface SubscriptionConfirmData {
  type: string;
  status: string;
  symbols?: string[];
  portfolioId?: string;
  portfolioIds?: string[];
  timestamp: string;
}

export interface SubscriptionErrorData {
  type: string;
  error: string;
  portfolioId?: string;
  timestamp: string;
}

export interface SystemStatusData {
  status: 'operational' | 'degraded' | 'maintenance';
  services: {
    api: 'operational' | 'degraded' | 'down';
    websocket: 'operational' | 'degraded' | 'down';
    database: 'operational' | 'degraded' | 'down';
    redis: 'operational' | 'degraded' | 'down';
    priceFeeds: 'operational' | 'degraded' | 'down';
  };
  metrics: {
    activeConnections: number;
    averageLatency: number;
    messagesPerSecond: number;
    errorRate: number;
  };
  timestamp: number;
  message?: string;
}

export interface OrderBookUpdateData {
  symbol: string;
  bids: { price: number; quantity: number; total?: number }[];
  asks: { price: number; quantity: number; total?: number }[];
  timestamp: string;
}

export interface TradeUpdateData {
  symbol: string;
  price: number;
  quantity: number;
  side: 'buy' | 'sell';
  timestamp: string;
  tradeId: string;
}

export interface AuthenticatedSocket {
  userId: string;
  userRole: string;
}