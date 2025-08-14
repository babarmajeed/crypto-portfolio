import axios, { AxiosInstance } from 'axios';

interface HoldingData {
  symbol: string;
  quantity: number;
  value: number;
  averageCostBasis: number;
  unrealizedPnL: number;
  unrealizedPnLPercentage: number;
  totalCost: number;
  lastUpdated: Date;
}

interface PortfolioSummary {
  totalValue: number;
  totalCost: number;
  totalPnL: number;
  totalPnLPercentage: number;
  dayChange: number;
  dayChangePercentage: number;
  holdingsCount: number;
  lastUpdated: Date;
}

interface Transaction {
  id: string;
  symbol: string;
  type: 'buy' | 'sell' | 'transfer_in' | 'transfer_out';
  quantity: number;
  price: number;
  total: number;
  fee: number;
  timestamp: Date;
  exchange?: string;
  notes?: string;
}

class PortfolioService {
  private api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: process.env.REACT_APP_API_URL || 'http://localhost:3001/api/v1',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // Add auth token to requests if available
    this.api.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('authToken');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );
  }

  /**
   * Get portfolio summary
   */
  async getPortfolioSummary(): Promise<PortfolioSummary> {
    try {
      const response = await this.api.get('/portfolio/summary');
      return {
        ...response.data,
        lastUpdated: new Date(response.data.lastUpdated)
      };
    } catch (error) {
      console.error('Error fetching portfolio summary:', error);
      return this.getMockPortfolioSummary();
    }
  }

  /**
   * Get all holdings
   */
  async getHoldings(): Promise<HoldingData[]> {
    try {
      const response = await this.api.get('/portfolio/holdings');
      return response.data.holdings.map((holding: any) => ({
        ...holding,
        lastUpdated: new Date(holding.lastUpdated)
      }));
    } catch (error) {
      console.error('Error fetching holdings:', error);
      return this.getMockHoldings();
    }
  }

  /**
   * Get specific holding by symbol
   */
  async getHolding(symbol: string): Promise<HoldingData | null> {
    try {
      const response = await this.api.get(`/portfolio/holdings/${symbol}`);
      if (response.data) {
        return {
          ...response.data,
          lastUpdated: new Date(response.data.lastUpdated)
        };
      }
      return null;
    } catch (error) {
      console.error(`Error fetching holding for ${symbol}:`, error);
      return this.getMockHolding(symbol);
    }
  }

  /**
   * Get portfolio performance history
   */
  async getPortfolioHistory(period: '24h' | '7d' | '30d' | '3m' | '1y' | 'all' = '30d'): Promise<{ timestamp: number; value: number }[]> {
    try {
      const response = await this.api.get('/portfolio/history', {
        params: { period }
      });
      return response.data.history;
    } catch (error) {
      console.error('Error fetching portfolio history:', error);
      return this.getMockPortfolioHistory(period);
    }
  }

  /**
   * Get portfolio allocation breakdown
   */
  async getPortfolioAllocation(): Promise<{ symbol: string; percentage: number; value: number }[]> {
    try {
      const response = await this.api.get('/portfolio/allocation');
      return response.data.allocation;
    } catch (error) {
      console.error('Error fetching portfolio allocation:', error);
      return this.getMockPortfolioAllocation();
    }
  }

  /**
   * Add a new transaction
   */
  async addTransaction(transaction: Omit<Transaction, 'id' | 'timestamp'>): Promise<Transaction> {
    try {
      const response = await this.api.post('/portfolio/transactions', transaction);
      return {
        ...response.data,
        timestamp: new Date(response.data.timestamp)
      };
    } catch (error) {
      console.error('Error adding transaction:', error);
      throw error;
    }
  }

  /**
   * Get transaction history
   */
  async getTransactions(symbol?: string, limit?: number): Promise<Transaction[]> {
    try {
      const response = await this.api.get('/portfolio/transactions', {
        params: { symbol, limit }
      });
      return response.data.transactions.map((tx: any) => ({
        ...tx,
        timestamp: new Date(tx.timestamp)
      }));
    } catch (error) {
      console.error('Error fetching transactions:', error);
      return [];
    }
  }

  /**
   * Update holding manually
   */
  async updateHolding(symbol: string, quantity: number, averageCost: number): Promise<void> {
    try {
      await this.api.put(`/portfolio/holdings/${symbol}`, {
        quantity,
        averageCost
      });
    } catch (error) {
      console.error('Error updating holding:', error);
      throw error;
    }
  }

  /**
   * Delete holding
   */
  async deleteHolding(symbol: string): Promise<void> {
    try {
      await this.api.delete(`/portfolio/holdings/${symbol}`);
    } catch (error) {
      console.error('Error deleting holding:', error);
      throw error;
    }
  }

  // Mock data methods for development/fallback
  private getMockPortfolioSummary(): PortfolioSummary {
    return {
      totalValue: 125000,
      totalCost: 100000,
      totalPnL: 25000,
      totalPnLPercentage: 25,
      dayChange: 2500,
      dayChangePercentage: 2.04,
      holdingsCount: 8,
      lastUpdated: new Date()
    };
  }

  private getMockHoldings(): HoldingData[] {
    const holdings = [
      { symbol: 'BTC', quantity: 2.5, averageCost: 35000 },
      { symbol: 'ETH', quantity: 15, averageCost: 2200 },
      { symbol: 'ADA', quantity: 10000, averageCost: 0.45 },
      { symbol: 'DOT', quantity: 500, averageCost: 15 },
    ];

    return holdings.map(holding => {
      const currentPrice = holding.averageCost * (1 + (Math.random() - 0.3)); // Random price movement
      const value = holding.quantity * currentPrice;
      const totalCost = holding.quantity * holding.averageCost;
      const unrealizedPnL = value - totalCost;
      const unrealizedPnLPercentage = (unrealizedPnL / totalCost) * 100;

      return {
        symbol: holding.symbol,
        quantity: holding.quantity,
        value,
        averageCostBasis: holding.averageCost,
        unrealizedPnL,
        unrealizedPnLPercentage,
        totalCost,
        lastUpdated: new Date()
      };
    });
  }

  private getMockHolding(symbol: string): HoldingData | null {
    const holdings = this.getMockHoldings();
    return holdings.find(h => h.symbol === symbol.toUpperCase()) || null;
  }

  private getMockPortfolioHistory(period: string): { timestamp: number; value: number }[] {
    const now = Date.now();
    const points: { timestamp: number; value: number }[] = [];
    let intervals: number;
    let intervalMs: number;

    switch (period) {
      case '24h':
        intervals = 24;
        intervalMs = 60 * 60 * 1000; // 1 hour
        break;
      case '7d':
        intervals = 168;
        intervalMs = 60 * 60 * 1000; // 1 hour
        break;
      case '30d':
        intervals = 30;
        intervalMs = 24 * 60 * 60 * 1000; // 1 day
        break;
      case '3m':
        intervals = 90;
        intervalMs = 24 * 60 * 60 * 1000; // 1 day
        break;
      case '1y':
        intervals = 365;
        intervalMs = 24 * 60 * 60 * 1000; // 1 day
        break;
      default:
        intervals = 30;
        intervalMs = 24 * 60 * 60 * 1000;
    }

    let currentValue = 120000; // Starting value
    for (let i = intervals - 1; i >= 0; i--) {
      const timestamp = now - (i * intervalMs);
      const volatility = 0.02; // 2% daily volatility
      const randomChange = (Math.random() - 0.5) * 2 * volatility;
      currentValue = currentValue * (1 + randomChange);
      
      points.push({
        timestamp,
        value: Math.max(10000, currentValue) // Ensure positive value
      });
    }

    return points;
  }

  private getMockPortfolioAllocation(): { symbol: string; percentage: number; value: number }[] {
    return [
      { symbol: 'BTC', percentage: 45, value: 56250 },
      { symbol: 'ETH', percentage: 30, value: 37500 },
      { symbol: 'ADA', percentage: 12, value: 15000 },
      { symbol: 'DOT', percentage: 8, value: 10000 },
      { symbol: 'MATIC', percentage: 3, value: 3750 },
      { symbol: 'SOL', percentage: 2, value: 2500 }
    ];
  }
}

export const portfolioService = new PortfolioService();
export type { HoldingData, PortfolioSummary, Transaction };