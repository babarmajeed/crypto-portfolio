import { 
  CopyTrade, 
  CopyTradeSettings, 
  Trade, 
  CopyTradeFilters,
  CopyTradeStatistics 
} from '../types/social.types';

export class CopyTradingService {
  private baseURL: string;
  private cache = new Map<string, { data: any; timestamp: number; ttl: number }>();

  constructor(baseURL: string = '/api') {
    this.baseURL = baseURL;
  }

  async startCopyTrade(traderId: string, settings: CopyTradeSettings): Promise<CopyTrade> {
    try {
      // Validate settings
      this.validateCopyTradeSettings(settings);

      // Mock implementation - would call actual API
      const copyTrade: CopyTrade = {
        id: `copy_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId: 'current_user',
        traderId,
        trader: {
          id: traderId,
          name: 'Alex Thompson',
          username: 'alex_crypto',
          avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100',
          bio: 'Crypto enthusiast and DeFi specialist',
          strategy: 'DeFi Yield Farming',
          followers: 12543,
          following: 234,
          copiers: 891,
          totalReturn: 287.5,
          monthlyReturn: 18.2,
          weeklyReturn: 4.1,
          dailyReturn: 0.8,
          winRate: 73.2,
          totalTrades: 156,
          profitableTrades: 114,
          maxDrawdown: 12.4,
          sharpeRatio: 2.1,
          riskScore: 6.5,
          badges: [],
          isVerified: true,
          isPro: true,
          joinedDate: '2023-08-15T00:00:00Z',
          lastActive: new Date().toISOString()
        },
        allocatedAmount: settings.amount,
        currentValue: settings.amount,
        totalReturn: 0,
        totalReturnPercentage: 0,
        dailyReturn: 0,
        weeklyReturn: 0,
        monthlyReturn: 0,
        performance: 0,
        duration: '0 days',
        startDate: new Date().toISOString(),
        status: 'active',
        settings,
        trades: [],
        statistics: {
          totalTrades: 0,
          winningTrades: 0,
          losingTrades: 0,
          winRate: 0,
          avgWin: 0,
          avgLoss: 0,
          profitFactor: 0,
          maxDrawdown: 0,
          maxDrawdownPercentage: 0,
          bestTrade: null,
          worstTrade: null,
          totalFees: 0
        }
      };

      // Invalidate cache
      this.invalidateCache('copy-trades');
      
      return copyTrade;

    } catch (error) {
      console.error('Error starting copy trade:', error);
      throw error;
    }
  }

  async stopCopyTrade(copyTradeId: string): Promise<void> {
    try {
      // Mock implementation
      console.log(`Stopping copy trade: ${copyTradeId}`);
      
      // Invalidate cache
      this.invalidateCache('copy-trades');

    } catch (error) {
      console.error('Error stopping copy trade:', error);
      throw error;
    }
  }

  async pauseCopyTrade(copyTradeId: string): Promise<void> {
    try {
      // Mock implementation
      console.log(`Pausing copy trade: ${copyTradeId}`);
      
      // Invalidate cache
      this.invalidateCache('copy-trades');

    } catch (error) {
      console.error('Error pausing copy trade:', error);
      throw error;
    }
  }

  async resumeCopyTrade(copyTradeId: string): Promise<void> {
    try {
      // Mock implementation
      console.log(`Resuming copy trade: ${copyTradeId}`);
      
      // Invalidate cache
      this.invalidateCache('copy-trades');

    } catch (error) {
      console.error('Error resuming copy trade:', error);
      throw error;
    }
  }

  async updateCopyTradeSettings(copyTradeId: string, settings: Partial<CopyTradeSettings>): Promise<void> {
    try {
      // Validate updated settings
      if (settings.amount !== undefined) {
        this.validateAmount(settings.amount);
      }
      if (settings.stopLoss !== undefined) {
        this.validateStopLoss(settings.stopLoss);
      }
      if (settings.takeProfit !== undefined) {
        this.validateTakeProfit(settings.takeProfit);
      }

      // Mock implementation
      console.log(`Updating copy trade settings: ${copyTradeId}`, settings);
      
      // Invalidate cache
      this.invalidateCache('copy-trades');

    } catch (error) {
      console.error('Error updating copy trade settings:', error);
      throw error;
    }
  }

  async getCopyTrades(userId: string, filters: CopyTradeFilters = {}): Promise<CopyTrade[]> {
    try {
      const cacheKey = this.getCacheKey('copy-trades', { userId, ...filters });
      const cached = this.getFromCache(cacheKey);
      if (cached) return cached;

      // Mock implementation
      const mockCopyTrades: CopyTrade[] = [
        {
          id: 'copy_1',
          userId,
          traderId: 'trader_1',
          trader: {
            id: 'trader_1',
            name: 'Alex Thompson',
            username: 'alex_crypto',
            avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100',
            bio: 'Crypto enthusiast and DeFi specialist',
            strategy: 'DeFi Yield Farming',
            followers: 12543,
            following: 234,
            copiers: 891,
            totalReturn: 287.5,
            monthlyReturn: 18.2,
            weeklyReturn: 4.1,
            dailyReturn: 0.8,
            winRate: 73.2,
            totalTrades: 156,
            profitableTrades: 114,
            maxDrawdown: 12.4,
            sharpeRatio: 2.1,
            riskScore: 6.5,
            badges: [],
            isVerified: true,
            isPro: true,
            joinedDate: '2023-08-15T00:00:00Z',
            lastActive: new Date().toISOString()
          },
          allocatedAmount: 5000,
          currentValue: 5625,
          totalReturn: 625,
          totalReturnPercentage: 12.5,
          dailyReturn: 0.8,
          weeklyReturn: 3.2,
          monthlyReturn: 12.5,
          performance: 12.5,
          duration: '45 days',
          startDate: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
          status: 'active',
          settings: {
            amount: 5000,
            stopLoss: 15,
            takeProfit: 25,
            maxOpenTrades: 8,
            maxDailyTrades: 5,
            copyMode: 'percentage',
            copyPercentage: 100,
            allowShorts: false,
            allowLeverage: false,
            autoRebalance: true,
            rebalanceFrequency: 'weekly'
          },
          trades: this.generateMockTrades('trader_1'),
          statistics: {
            totalTrades: 23,
            winningTrades: 17,
            losingTrades: 6,
            winRate: 73.9,
            avgWin: 4.2,
            avgLoss: -2.1,
            profitFactor: 2.8,
            maxDrawdown: 180,
            maxDrawdownPercentage: 3.6,
            bestTrade: null,
            worstTrade: null,
            totalFees: 45.60
          }
        },
        {
          id: 'copy_2',
          userId,
          traderId: 'trader_2',
          trader: {
            id: 'trader_2',
            name: 'Sarah Chen',
            username: 'crypto_sarah',
            avatar: 'https://images.unsplash.com/photo-1494790108755-2616b612b2bd?w=100',
            bio: 'Technical analysis expert and swing trader',
            strategy: 'Technical Analysis',
            followers: 8932,
            following: 156,
            copiers: 567,
            totalReturn: 245.8,
            monthlyReturn: 15.7,
            weeklyReturn: 3.2,
            dailyReturn: 0.6,
            winRate: 68.9,
            totalTrades: 203,
            profitableTrades: 140,
            maxDrawdown: 15.2,
            sharpeRatio: 1.8,
            riskScore: 7.2,
            badges: [],
            isVerified: true,
            isPro: false,
            joinedDate: '2023-06-10T00:00:00Z',
            lastActive: new Date().toISOString()
          },
          allocatedAmount: 2500,
          currentValue: 2375,
          totalReturn: -125,
          totalReturnPercentage: -5.0,
          dailyReturn: -0.2,
          weeklyReturn: -1.8,
          monthlyReturn: -5.0,
          performance: -5.0,
          duration: '18 days',
          startDate: new Date(Date.now() - 18 * 24 * 60 * 60 * 1000).toISOString(),
          status: 'active',
          settings: {
            amount: 2500,
            stopLoss: 10,
            takeProfit: 20,
            maxOpenTrades: 5,
            maxDailyTrades: 3,
            copyMode: 'fixed',
            allowShorts: true,
            allowLeverage: false,
            autoRebalance: false
          },
          trades: this.generateMockTrades('trader_2'),
          statistics: {
            totalTrades: 12,
            winningTrades: 7,
            losingTrades: 5,
            winRate: 58.3,
            avgWin: 3.8,
            avgLoss: -4.2,
            profitFactor: 1.4,
            maxDrawdown: 200,
            maxDrawdownPercentage: 8.0,
            bestTrade: null,
            worstTrade: null,
            totalFees: 28.40
          }
        }
      ];

      // Apply filters
      let filteredCopyTrades = mockCopyTrades;

      if (filters.status) {
        filteredCopyTrades = filteredCopyTrades.filter(ct => ct.status === filters.status);
      }

      if (filters.minReturn !== undefined) {
        filteredCopyTrades = filteredCopyTrades.filter(ct => 
          ct.totalReturnPercentage >= filters.minReturn!
        );
      }

      if (filters.trader) {
        filteredCopyTrades = filteredCopyTrades.filter(ct => 
          ct.traderId === filters.trader || 
          ct.trader.name.toLowerCase().includes(filters.trader!.toLowerCase())
        );
      }

      if (filters.asset) {
        filteredCopyTrades = filteredCopyTrades.filter(ct =>
          ct.trades.some(trade => trade.symbol === filters.asset)
        );
      }

      // Apply sorting
      if (filters.sortBy) {
        filteredCopyTrades.sort((a, b) => {
          let aValue, bValue;
          
          switch (filters.sortBy) {
            case 'return':
              aValue = a.totalReturnPercentage;
              bValue = b.totalReturnPercentage;
              break;
            case 'date':
              aValue = new Date(a.startDate).getTime();
              bValue = new Date(b.startDate).getTime();
              break;
            case 'amount':
              aValue = a.allocatedAmount;
              bValue = b.allocatedAmount;
              break;
            case 'performance':
              aValue = a.performance;
              bValue = b.performance;
              break;
            default:
              aValue = new Date(a.startDate).getTime();
              bValue = new Date(b.startDate).getTime();
          }

          const result = filters.sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
          return result;
        });
      }

      this.setCache(cacheKey, filteredCopyTrades, 2 * 60 * 1000);
      return filteredCopyTrades;

    } catch (error) {
      console.error('Error fetching copy trades:', error);
      throw error;
    }
  }

  async getCopyTradeHistory(userId: string): Promise<CopyTrade[]> {
    try {
      const cacheKey = this.getCacheKey('copy-trade-history', { userId });
      const cached = this.getFromCache(cacheKey);
      if (cached) return cached;

      // Mock implementation - return stopped copy trades
      const allCopyTrades = await this.getCopyTrades(userId);
      const history = allCopyTrades.filter(ct => ct.status === 'stopped');

      this.setCache(cacheKey, history, 5 * 60 * 1000);
      return history;

    } catch (error) {
      console.error('Error fetching copy trade history:', error);
      throw error;
    }
  }

  async getCopyTradePerformance(copyTradeId: string): Promise<any[]> {
    try {
      const cacheKey = this.getCacheKey('copy-trade-performance', { copyTradeId });
      const cached = this.getFromCache(cacheKey);
      if (cached) return cached;

      // Mock implementation - generate performance chart data
      const performanceData = [];
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);
      
      let value = 5000; // Starting value
      
      for (let i = 0; i < 30; i++) {
        const date = new Date(startDate);
        date.setDate(date.getDate() + i);
        
        // Random daily return between -3% and +5%
        const dailyReturn = (Math.random() - 0.4) * 0.08;
        value *= (1 + dailyReturn);
        
        performanceData.push({
          date: date.toISOString().split('T')[0],
          value: Math.round(value * 100) / 100,
          return: ((value - 5000) / 5000) * 100
        });
      }

      this.setCache(cacheKey, performanceData, 5 * 60 * 1000);
      return performanceData;

    } catch (error) {
      console.error('Error fetching copy trade performance:', error);
      throw error;
    }
  }

  async getCopyTradeRiskMetrics(copyTradeId: string): Promise<any> {
    try {
      const cacheKey = this.getCacheKey('copy-trade-risk', { copyTradeId });
      const cached = this.getFromCache(cacheKey);
      if (cached) return cached;

      // Mock implementation
      const riskMetrics = {
        currentDrawdown: 2.3,
        maxDrawdown: 8.7,
        sharpeRatio: 1.8,
        volatility: 12.4,
        var95: 3.2, // Value at Risk (95%)
        beta: 1.1,
        correlation: 0.85,
        riskAdjustedReturn: 14.2
      };

      this.setCache(cacheKey, riskMetrics, 5 * 60 * 1000);
      return riskMetrics;

    } catch (error) {
      console.error('Error fetching copy trade risk metrics:', error);
      throw error;
    }
  }

  private generateMockTrades(traderId: string): Trade[] {
    const trades: Trade[] = [];
    const assets = ['BTC', 'ETH', 'ADA', 'SOL', 'MATIC', 'LINK', 'UNI', 'AAVE'];
    
    for (let i = 0; i < 10; i++) {
      const asset = assets[Math.floor(Math.random() * assets.length)];
      const isWin = Math.random() > 0.3; // 70% win rate
      const entryPrice = 100 + Math.random() * 400;
      const exitPrice = isWin 
        ? entryPrice * (1 + Math.random() * 0.1) // 0-10% gain
        : entryPrice * (1 - Math.random() * 0.05); // 0-5% loss
      
      trades.push({
        id: `trade_${traderId}_${i}`,
        traderId,
        asset: asset === 'BTC' ? 'Bitcoin' : asset === 'ETH' ? 'Ethereum' : asset,
        symbol: asset,
        type: Math.random() > 0.5 ? 'buy' : 'sell',
        side: Math.random() > 0.2 ? 'long' : 'short',
        amount: 100 + Math.random() * 500,
        quantity: (100 + Math.random() * 500) / entryPrice,
        entryPrice,
        exitPrice,
        pnl: exitPrice - entryPrice,
        pnlPercentage: ((exitPrice - entryPrice) / entryPrice) * 100,
        fees: 2.5 + Math.random() * 5,
        openDate: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
        closeDate: new Date(Date.now() - Math.random() * 10 * 24 * 60 * 60 * 1000).toISOString(),
        status: 'closed'
      });
    }
    
    return trades;
  }

  private validateCopyTradeSettings(settings: CopyTradeSettings): void {
    this.validateAmount(settings.amount);
    this.validateStopLoss(settings.stopLoss);
    this.validateTakeProfit(settings.takeProfit);
    this.validateMaxOpenTrades(settings.maxOpenTrades);
  }

  private validateAmount(amount: number): void {
    if (amount < 100) {
      throw new Error('Minimum copy trade amount is $100');
    }
    if (amount > 100000) {
      throw new Error('Maximum copy trade amount is $100,000');
    }
  }

  private validateStopLoss(stopLoss: number): void {
    if (stopLoss < 1 || stopLoss > 50) {
      throw new Error('Stop loss must be between 1% and 50%');
    }
  }

  private validateTakeProfit(takeProfit: number): void {
    if (takeProfit < 5 || takeProfit > 200) {
      throw new Error('Take profit must be between 5% and 200%');
    }
  }

  private validateMaxOpenTrades(maxTrades: number): void {
    if (maxTrades < 1 || maxTrades > 50) {
      throw new Error('Max open trades must be between 1 and 50');
    }
  }

  private getCacheKey(endpoint: string, params: any): string {
    return `${endpoint}_${JSON.stringify(params)}`;
  }

  private getFromCache(key: string): any | null {
    const cached = this.cache.get(key);
    if (!cached) return null;

    const now = Date.now();
    if (now - cached.timestamp > cached.ttl) {
      this.cache.delete(key);
      return null;
    }

    return cached.data;
  }

  private setCache(key: string, data: any, ttl: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }

  private invalidateCache(prefix: string): void {
    for (const [key] of this.cache) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
  }
}

export const copyTradingService = new CopyTradingService();
export default CopyTradingService;