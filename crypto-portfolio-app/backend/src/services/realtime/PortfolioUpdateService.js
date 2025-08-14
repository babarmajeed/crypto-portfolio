import { EventEmitter } from 'events';
import { portfolioService } from '../portfolioService.js';
import { PriceStreamManager } from './PriceStreamManager.js';
import { ValueCalculator } from './ValueCalculator.js';
import { DataReconciler } from './DataReconciler.js';
import { websocketService } from '../websocketService.js';
import { loggingService } from '../loggingService.js';

/**
 * Real-time Portfolio Update Service
 * Manages real-time portfolio value updates by streaming price data,
 * calculating portfolio changes, and notifying subscribers
 */
class PortfolioUpdateService extends EventEmitter {
  constructor() {
    super();
    this.priceStreamManager = new PriceStreamManager();
    this.valueCalculator = new ValueCalculator();
    this.dataReconciler = new DataReconciler();
    
    this.subscribers = new Set();
    this.portfolioCache = new Map(); // userId -> portfolio data
    this.priceCache = new Map(); // symbol -> price data
    this.lastUpdateTime = null;
    this.connectionStatus = false;
    this.updateInterval = null;
    this.reconcileInterval = null;
    
    // Performance tracking
    this.metrics = {
      totalUpdates: 0,
      successfulUpdates: 0,
      failedUpdates: 0,
      averageCalculationTime: 0,
      lastCalculationTime: 0
    };
    
    this.setupEventHandlers();
  }

  /**
   * Initialize the portfolio update service
   */
  async initialize() {
    try {
      loggingService.info('Initializing PortfolioUpdateService');
      
      // Initialize price stream manager
      await this.priceStreamManager.initialize();
      
      // Start periodic data reconciliation
      this.startReconciliation();
      
      // Set connection status
      this.connectionStatus = true;
      this.emit('connectionStatusChanged', true);
      
      loggingService.info('PortfolioUpdateService initialized successfully');
    } catch (error) {
      loggingService.error('Failed to initialize PortfolioUpdateService', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Setup event handlers for price updates and portfolio changes
   */
  setupEventHandlers() {
    // Handle price updates from stream manager
    this.priceStreamManager.on('priceUpdate', this.handlePriceUpdate.bind(this));
    this.priceStreamManager.on('connectionChange', this.handleConnectionChange.bind(this));
    this.priceStreamManager.on('error', this.handleStreamError.bind(this));
    
    // Handle portfolio changes
    portfolioService.on('portfolioChanged', this.handlePortfolioChange.bind(this));
    
    // Handle WebSocket connection changes
    websocketService.on('connectionStatusChanged', this.handleConnectionChange.bind(this));
  }

  /**
   * Subscribe to real-time updates for a user's portfolio
   */
  async subscribeToPortfolio(userId) {
    try {
      loggingService.info('Subscribing to portfolio updates', { userId });
      
      // Load user's current portfolio
      const portfolio = await portfolioService.getUserPortfolio(userId);
      if (!portfolio) {
        throw new Error('Portfolio not found');
      }
      
      // Cache the portfolio
      this.portfolioCache.set(userId, portfolio);
      
      // Extract unique symbols from portfolio
      const symbols = this.extractSymbolsFromPortfolio(portfolio);
      
      if (symbols.length > 0) {
        // Subscribe to price updates for all symbols
        await this.priceStreamManager.subscribeToSymbols(symbols);
        
        // Get initial price data
        const initialPrices = await this.priceStreamManager.getCurrentPrices(symbols);
        initialPrices.forEach((priceData, symbol) => {
          this.priceCache.set(symbol, priceData);
        });
        
        // Calculate initial portfolio value
        const portfolioWithValues = this.calculatePortfolioValue(userId, portfolio);
        
        // Notify subscriber immediately
        this.notifyPortfolioUpdate(userId, portfolioWithValues);
      }
      
      return true;
    } catch (error) {
      loggingService.error('Failed to subscribe to portfolio', {
        userId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Unsubscribe from portfolio updates
   */
  async unsubscribeFromPortfolio(userId) {
    try {
      loggingService.info('Unsubscribing from portfolio updates', { userId });
      
      const portfolio = this.portfolioCache.get(userId);
      if (portfolio) {
        const symbols = this.extractSymbolsFromPortfolio(portfolio);
        
        // Check if other users are still using these symbols
        const symbolsInUse = this.getSymbolsInUse();
        const symbolsToUnsubscribe = symbols.filter(symbol => !symbolsInUse.has(symbol));
        
        if (symbolsToUnsubscribe.length > 0) {
          await this.priceStreamManager.unsubscribeFromSymbols(symbolsToUnsubscribe);
        }
        
        // Remove from cache
        this.portfolioCache.delete(userId);
      }
      
      return true;
    } catch (error) {
      loggingService.error('Failed to unsubscribe from portfolio', {
        userId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Handle incoming price updates
   */
  handlePriceUpdate(priceData) {
    try {
      const { symbol, price, change24h, volume24h, timestamp } = priceData;
      
      // Update price cache
      const cacheData = {
        price: parseFloat(price),
        change24h: parseFloat(change24h || 0),
        volume24h: parseFloat(volume24h || 0),
        timestamp: new Date(timestamp),
        lastUpdated: new Date()
      };
      
      this.priceCache.set(symbol, cacheData);
      
      // Find portfolios that contain this symbol and recalculate
      const affectedUsers = this.findUsersWithSymbol(symbol);
      
      for (const userId of affectedUsers) {
        this.recalculatePortfolioValue(userId);
      }
      
      this.metrics.totalUpdates++;
      this.lastUpdateTime = new Date();
      
    } catch (error) {
      loggingService.error('Error handling price update', {
        priceData,
        error: error.message
      });
      this.metrics.failedUpdates++;
    }
  }

  /**
   * Handle portfolio changes (when user buys/sells assets)
   */
  async handlePortfolioChange(portfolioChangeData) {
    try {
      const { userId, portfolio } = portfolioChangeData;
      
      loggingService.info('Handling portfolio change', { userId });
      
      // Update cached portfolio
      const oldPortfolio = this.portfolioCache.get(userId);
      this.portfolioCache.set(userId, portfolio);
      
      // Check for new symbols that need subscription
      const oldSymbols = oldPortfolio ? this.extractSymbolsFromPortfolio(oldPortfolio) : [];
      const newSymbols = this.extractSymbolsFromPortfolio(portfolio);
      
      const symbolsToAdd = newSymbols.filter(symbol => !oldSymbols.includes(symbol));
      const symbolsToRemove = oldSymbols.filter(symbol => !newSymbols.includes(symbol));
      
      // Subscribe to new symbols
      if (symbolsToAdd.length > 0) {
        await this.priceStreamManager.subscribeToSymbols(symbolsToAdd);
        
        // Get initial prices for new symbols
        const newPrices = await this.priceStreamManager.getCurrentPrices(symbolsToAdd);
        newPrices.forEach((priceData, symbol) => {
          this.priceCache.set(symbol, priceData);
        });
      }
      
      // Unsubscribe from unused symbols
      if (symbolsToRemove.length > 0) {
        const symbolsInUse = this.getSymbolsInUse();
        const symbolsToUnsubscribe = symbolsToRemove.filter(symbol => !symbolsInUse.has(symbol));
        
        if (symbolsToUnsubscribe.length > 0) {
          await this.priceStreamManager.unsubscribeFromSymbols(symbolsToUnsubscribe);
        }
      }
      
      // Recalculate portfolio value with new structure
      this.recalculatePortfolioValue(userId);
      
    } catch (error) {
      loggingService.error('Error handling portfolio change', {
        portfolioChangeData,
        error: error.message
      });
    }
  }

  /**
   * Handle connection status changes
   */
  handleConnectionChange(isConnected) {
    this.connectionStatus = isConnected;
    this.emit('connectionStatusChanged', isConnected);
    
    if (isConnected) {
      loggingService.info('Connection restored, starting data reconciliation');
      this.reconcileAllData();
    } else {
      loggingService.warn('Connection lost, using cached data');
    }
  }

  /**
   * Handle stream errors
   */
  handleStreamError(error) {
    loggingService.error('Price stream error', { error: error.message });
    this.emit('error', error);
    this.metrics.failedUpdates++;
  }

  /**
   * Recalculate portfolio value for a specific user
   */
  recalculatePortfolioValue(userId) {
    try {
      const startTime = Date.now();
      
      const portfolio = this.portfolioCache.get(userId);
      if (!portfolio) {
        return;
      }
      
      const portfolioWithValues = this.calculatePortfolioValue(userId, portfolio);
      
      // Update metrics
      const calculationTime = Date.now() - startTime;
      this.metrics.lastCalculationTime = calculationTime;
      this.metrics.averageCalculationTime = 
        (this.metrics.averageCalculationTime * this.metrics.successfulUpdates + calculationTime) / 
        (this.metrics.successfulUpdates + 1);
      this.metrics.successfulUpdates++;
      
      // Notify subscribers
      this.notifyPortfolioUpdate(userId, portfolioWithValues);
      
    } catch (error) {
      loggingService.error('Error recalculating portfolio value', {
        userId,
        error: error.message
      });
      this.metrics.failedUpdates++;
    }
  }

  /**
   * Calculate portfolio value using current prices
   */
  calculatePortfolioValue(userId, portfolio) {
    return this.valueCalculator.calculatePortfolioValue(portfolio, this.priceCache);
  }

  /**
   * Notify subscribers of portfolio updates
   */
  notifyPortfolioUpdate(userId, portfolioData) {
    const updateData = {
      userId,
      portfolio: portfolioData,
      timestamp: new Date(),
      isConnected: this.connectionStatus,
      lastPriceUpdate: this.lastUpdateTime
    };
    
    this.emit('portfolioUpdate', updateData);
    
    // Emit user-specific event
    this.emit(`portfolioUpdate:${userId}`, updateData);
  }

  /**
   * Extract symbols from portfolio holdings
   */
  extractSymbolsFromPortfolio(portfolio) {
    if (!portfolio || !portfolio.holdings) {
      return [];
    }
    
    return portfolio.holdings.map(holding => holding.symbol).filter(Boolean);
  }

  /**
   * Find users that have a specific symbol in their portfolio
   */
  findUsersWithSymbol(symbol) {
    const users = [];
    
    for (const [userId, portfolio] of this.portfolioCache) {
      const symbols = this.extractSymbolsFromPortfolio(portfolio);
      if (symbols.includes(symbol)) {
        users.push(userId);
      }
    }
    
    return users;
  }

  /**
   * Get all symbols currently in use across all portfolios
   */
  getSymbolsInUse() {
    const symbolsInUse = new Set();
    
    for (const [userId, portfolio] of this.portfolioCache) {
      const symbols = this.extractSymbolsFromPortfolio(portfolio);
      symbols.forEach(symbol => symbolsInUse.add(symbol));
    }
    
    return symbolsInUse;
  }

  /**
   * Start periodic data reconciliation
   */
  startReconciliation() {
    // Reconcile data every 30 seconds
    this.reconcileInterval = setInterval(() => {
      this.reconcileAllData();
    }, 30000);
  }

  /**
   * Stop periodic data reconciliation
   */
  stopReconciliation() {
    if (this.reconcileInterval) {
      clearInterval(this.reconcileInterval);
      this.reconcileInterval = null;
    }
  }

  /**
   * Reconcile all cached data with latest data
   */
  async reconcileAllData() {
    try {
      loggingService.info('Starting data reconciliation');
      
      const symbolsToReconcile = Array.from(this.getSymbolsInUse());
      
      if (symbolsToReconcile.length === 0) {
        return;
      }
      
      const reconciledData = await this.dataReconciler.reconcileData(
        symbolsToReconcile,
        this.priceCache
      );
      
      // Update price cache with reconciled data
      reconciledData.forEach((priceData, symbol) => {
        this.priceCache.set(symbol, priceData);
      });
      
      // Recalculate all portfolio values
      for (const userId of this.portfolioCache.keys()) {
        this.recalculatePortfolioValue(userId);
      }
      
      loggingService.info('Data reconciliation completed', {
        symbolsReconciled: reconciledData.size
      });
      
    } catch (error) {
      loggingService.error('Error during data reconciliation', {
        error: error.message
      });
    }
  }

  /**
   * Force refresh of all portfolio data
   */
  async forceRefresh() {
    try {
      loggingService.info('Force refreshing portfolio data');
      
      // Clear price cache to force fresh data
      this.priceCache.clear();
      
      // Reconcile all data
      await this.reconcileAllData();
      
      return true;
    } catch (error) {
      loggingService.error('Error during force refresh', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get current portfolio data for a user
   */
  getCurrentPortfolioData(userId) {
    const portfolio = this.portfolioCache.get(userId);
    if (!portfolio) {
      return null;
    }
    
    return this.calculatePortfolioValue(userId, portfolio);
  }

  /**
   * Get service metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      activePortfolios: this.portfolioCache.size,
      trackedSymbols: this.priceCache.size,
      connectionStatus: this.connectionStatus,
      lastUpdateTime: this.lastUpdateTime,
      uptime: Date.now() - (this.startTime || Date.now())
    };
  }

  /**
   * Get connection status
   */
  getConnectionStatus() {
    return {
      isConnected: this.connectionStatus,
      lastUpdateTime: this.lastUpdateTime,
      activePortfolios: this.portfolioCache.size,
      trackedSymbols: this.priceCache.size
    };
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    try {
      loggingService.info('Cleaning up PortfolioUpdateService');
      
      // Stop reconciliation
      this.stopReconciliation();
      
      // Cleanup price stream manager
      await this.priceStreamManager.cleanup();
      
      // Clear caches
      this.portfolioCache.clear();
      this.priceCache.clear();
      
      // Remove all listeners
      this.removeAllListeners();
      
      this.connectionStatus = false;
      
    } catch (error) {
      loggingService.error('Error during cleanup', {
        error: error.message
      });
    }
  }
}

export const portfolioUpdateService = new PortfolioUpdateService();
export { PortfolioUpdateService };