import { loggingService } from '../loggingService.js';

/**
 * Portfolio Value Calculator
 * Calculates real-time portfolio values, P&L, and allocation metrics
 */
class ValueCalculator {
  constructor() {
    // Configuration for value calculations
    this.config = {
      baseCurrency: 'USD',
      precisionDigits: 8,
      minAllocationThreshold: 0.01, // 1%
      calculateHistoricalMetrics: true
    };
    
    // Cache for expensive calculations
    this.calculationCache = new Map();
    this.cacheExpiration = 30000; // 30 seconds
    
    // Performance metrics
    this.metrics = {
      totalCalculations: 0,
      cacheHits: 0,
      averageCalculationTime: 0,
      lastCalculationTime: null
    };
  }

  /**
   * Calculate complete portfolio value with all metrics
   */
  calculatePortfolioValue(portfolio, priceCache) {
    const startTime = Date.now();
    
    try {
      if (!portfolio || !portfolio.holdings || portfolio.holdings.length === 0) {
        return this.createEmptyPortfolioResult();
      }

      // Check cache first
      const cacheKey = this.generateCacheKey(portfolio, priceCache);
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        this.metrics.cacheHits++;
        return cached;
      }

      // Calculate current values
      const calculatedHoldings = this.calculateHoldingValues(portfolio.holdings, priceCache);
      
      // Calculate portfolio totals
      const portfolioTotals = this.calculatePortfolioTotals(calculatedHoldings);
      
      // Calculate allocation percentages
      const allocations = this.calculateAllocations(calculatedHoldings, portfolioTotals.totalValue);
      
      // Calculate P&L metrics
      const pnlMetrics = this.calculatePnLMetrics(calculatedHoldings);
      
      // Calculate time-based metrics
      const timeMetrics = this.calculateTimeMetrics(calculatedHoldings, priceCache);
      
      // Calculate risk metrics
      const riskMetrics = this.calculateRiskMetrics(calculatedHoldings, allocations);
      
      // Create final result
      const result = {
        ...portfolio,
        holdings: calculatedHoldings,
        totalValue: portfolioTotals.totalValue,
        totalCostBasis: portfolioTotals.totalCostBasis,
        allocations,
        ...pnlMetrics,
        ...timeMetrics,
        ...riskMetrics,
        lastCalculated: new Date(),
        calculationId: this.generateCalculationId()
      };
      
      // Cache result
      this.setCache(cacheKey, result);
      
      // Update metrics
      this.updateMetrics(startTime);
      
      return result;
      
    } catch (error) {
      loggingService.error('Error calculating portfolio value', {
        error: error.message,
        portfolioId: portfolio?.id
      });
      throw error;
    }
  }

  /**
   * Calculate values for individual holdings
   */
  calculateHoldingValues(holdings, priceCache) {
    return holdings.map(holding => {
      try {
        const priceData = this.getPriceData(holding.symbol, priceCache);
        
        if (!priceData) {
          // Use last known price if real-time data unavailable
          return this.calculateWithLastKnownPrice(holding);
        }
        
        return this.calculateHoldingWithPriceData(holding, priceData);
        
      } catch (error) {
        loggingService.warn('Error calculating holding value', {
          symbol: holding.symbol,
          error: error.message
        });
        return this.calculateWithLastKnownPrice(holding);
      }
    });
  }

  /**
   * Calculate holding value with current price data
   */
  calculateHoldingWithPriceData(holding, priceData) {
    const {
      symbol,
      quantity,
      averageCostBasis = 0,
      exchange,
      lastKnownPrice = 0
    } = holding;

    const currentPrice = priceData.price || lastKnownPrice;
    const currentValue = quantity * currentPrice;
    const costBasis = quantity * averageCostBasis;
    
    // Calculate P&L
    const unrealizedPnL = currentValue - costBasis;
    const unrealizedPnLPercentage = costBasis > 0 ? (unrealizedPnL / costBasis) * 100 : 0;
    
    // Calculate 24h changes
    const price24hAgo = this.calculatePrice24hAgo(currentPrice, priceData.change24h || 0);
    const value24hAgo = quantity * price24hAgo;
    const dayChange = currentValue - value24hAgo;
    const dayChangePercentage = value24hAgo > 0 ? (dayChange / value24hAgo) * 100 : 0;
    
    return {
      ...holding,
      currentPrice: this.roundToDecimal(currentPrice, 8),
      currentValue: this.roundToDecimal(currentValue, 2),
      costBasis: this.roundToDecimal(costBasis, 2),
      unrealizedPnL: this.roundToDecimal(unrealizedPnL, 2),
      unrealizedPnLPercentage: this.roundToDecimal(unrealizedPnLPercentage, 2),
      dayChange: this.roundToDecimal(dayChange, 2),
      dayChangePercentage: this.roundToDecimal(dayChangePercentage, 2),
      priceChange24h: priceData.change24h || 0,
      volume24h: priceData.volume24h || 0,
      lastUpdated: priceData.timestamp || new Date(),
      dataSource: priceData.exchange || 'cached'
    };
  }

  /**
   * Calculate holding value with last known price (fallback)
   */
  calculateWithLastKnownPrice(holding) {
    const {
      symbol,
      quantity,
      averageCostBasis = 0,
      lastKnownPrice = 0,
      lastPriceUpdate
    } = holding;

    const currentPrice = lastKnownPrice;
    const currentValue = quantity * currentPrice;
    const costBasis = quantity * averageCostBasis;
    const unrealizedPnL = currentValue - costBasis;
    const unrealizedPnLPercentage = costBasis > 0 ? (unrealizedPnL / costBasis) * 100 : 0;

    return {
      ...holding,
      currentPrice: this.roundToDecimal(currentPrice, 8),
      currentValue: this.roundToDecimal(currentValue, 2),
      costBasis: this.roundToDecimal(costBasis, 2),
      unrealizedPnL: this.roundToDecimal(unrealizedPnL, 2),
      unrealizedPnLPercentage: this.roundToDecimal(unrealizedPnLPercentage, 2),
      dayChange: 0, // Cannot calculate without current data
      dayChangePercentage: 0,
      priceChange24h: 0,
      volume24h: 0,
      lastUpdated: lastPriceUpdate || new Date(),
      dataSource: 'cached',
      isStale: true
    };
  }

  /**
   * Calculate portfolio totals
   */
  calculatePortfolioTotals(holdings) {
    const totals = holdings.reduce((acc, holding) => ({
      totalValue: acc.totalValue + (holding.currentValue || 0),
      totalCostBasis: acc.totalCostBasis + (holding.costBasis || 0),
      totalDayChange: acc.totalDayChange + (holding.dayChange || 0)
    }), {
      totalValue: 0,
      totalCostBasis: 0,
      totalDayChange: 0
    });

    return {
      ...totals,
      totalValue: this.roundToDecimal(totals.totalValue, 2),
      totalCostBasis: this.roundToDecimal(totals.totalCostBasis, 2),
      totalDayChange: this.roundToDecimal(totals.totalDayChange, 2)
    };
  }

  /**
   * Calculate allocation percentages
   */
  calculateAllocations(holdings, totalValue) {
    if (totalValue <= 0) {
      return holdings.map(holding => ({
        symbol: holding.symbol,
        allocation: 0,
        value: 0
      }));
    }

    const allocations = holdings.map(holding => {
      const allocation = (holding.currentValue / totalValue) * 100;
      return {
        symbol: holding.symbol,
        allocation: this.roundToDecimal(allocation, 2),
        value: holding.currentValue,
        exchange: holding.exchange
      };
    }).sort((a, b) => b.allocation - a.allocation);

    // Group small allocations
    return this.groupSmallAllocations(allocations);
  }

  /**
   * Calculate P&L metrics
   */
  calculatePnLMetrics(holdings) {
    const totalUnrealizedPnL = holdings.reduce((sum, holding) => 
      sum + (holding.unrealizedPnL || 0), 0);
    
    const totalCostBasis = holdings.reduce((sum, holding) => 
      sum + (holding.costBasis || 0), 0);
    
    const totalUnrealizedPnLPercentage = totalCostBasis > 0 ? 
      (totalUnrealizedPnL / totalCostBasis) * 100 : 0;
    
    const totalDayChange = holdings.reduce((sum, holding) => 
      sum + (holding.dayChange || 0), 0);
    
    const totalValue = holdings.reduce((sum, holding) => 
      sum + (holding.currentValue || 0), 0);
    
    const totalDayChangePercentage = (totalValue - totalDayChange) > 0 ? 
      (totalDayChange / (totalValue - totalDayChange)) * 100 : 0;

    return {
      totalUnrealizedPnL: this.roundToDecimal(totalUnrealizedPnL, 2),
      totalUnrealizedPnLPercentage: this.roundToDecimal(totalUnrealizedPnLPercentage, 2),
      totalDayChange: this.roundToDecimal(totalDayChange, 2),
      totalDayChangePercentage: this.roundToDecimal(totalDayChangePercentage, 2)
    };
  }

  /**
   * Calculate time-based metrics (7d, 30d, etc.)
   */
  calculateTimeMetrics(holdings, priceCache) {
    // This would typically require historical price data
    // For now, we'll extrapolate from 24h data as an approximation
    
    const totalValue = holdings.reduce((sum, holding) => 
      sum + (holding.currentValue || 0), 0);
    
    // Rough approximation based on 24h change
    const estimated7dChange = holdings.reduce((sum, holding) => {
      const dayChange = holding.dayChange || 0;
      // Simple approximation: 7 * daily change (not accurate, but placeholder)
      return sum + (dayChange * 2); // Conservative estimate
    }, 0);
    
    const estimated7dChangePercentage = totalValue > 0 ? 
      (estimated7dChange / totalValue) * 100 : 0;
    
    return {
      change7d: this.roundToDecimal(estimated7dChange, 2),
      changePercentage7d: this.roundToDecimal(estimated7dChangePercentage, 2),
      change30d: 0, // Would need historical data
      changePercentage30d: 0 // Would need historical data
    };
  }

  /**
   * Calculate risk metrics
   */
  calculateRiskMetrics(holdings, allocations) {
    // Concentration risk (Herfindahl-Hirschman Index)
    const hhi = allocations.reduce((sum, allocation) => 
      sum + Math.pow(allocation.allocation, 2), 0);
    
    // Diversification score (inverse of concentration)
    const diversificationScore = allocations.length > 0 ? 
      Math.max(0, 100 - (hhi / 100)) : 0;
    
    // Risk level based on concentration
    let riskLevel = 'Low';
    if (hhi > 2500) riskLevel = 'High';
    else if (hhi > 1500) riskLevel = 'Medium';
    
    return {
      concentrationIndex: this.roundToDecimal(hhi, 2),
      diversificationScore: this.roundToDecimal(diversificationScore, 2),
      riskLevel,
      assetCount: holdings.length,
      exchangeCount: [...new Set(holdings.map(h => h.exchange))].length
    };
  }

  /**
   * Get price data for symbol from cache
   */
  getPriceData(symbol, priceCache) {
    // Try exact symbol match first
    let priceData = priceCache.get(symbol);
    
    if (!priceData) {
      // Try normalized symbol variations
      const normalizedSymbol = this.normalizeSymbol(symbol);
      priceData = priceCache.get(normalizedSymbol);
    }
    
    return priceData;
  }

  /**
   * Calculate price 24 hours ago
   */
  calculatePrice24hAgo(currentPrice, change24hPercent) {
    if (change24hPercent === 0) return currentPrice;
    return currentPrice / (1 + (change24hPercent / 100));
  }

  /**
   * Group small allocations under "Others"
   */
  groupSmallAllocations(allocations) {
    const significantAllocations = [];
    let othersValue = 0;
    let othersAllocation = 0;
    
    for (const allocation of allocations) {
      if (allocation.allocation >= this.config.minAllocationThreshold) {
        significantAllocations.push(allocation);
      } else {
        othersValue += allocation.value;
        othersAllocation += allocation.allocation;
      }
    }
    
    if (othersAllocation > 0) {
      significantAllocations.push({
        symbol: 'Others',
        allocation: this.roundToDecimal(othersAllocation, 2),
        value: othersValue,
        isGrouped: true
      });
    }
    
    return significantAllocations;
  }

  /**
   * Normalize symbol for lookup
   */
  normalizeSymbol(symbol) {
    if (!symbol) return '';
    return symbol.toUpperCase().replace(/[-_]/g, '');
  }

  /**
   * Round number to specified decimal places
   */
  roundToDecimal(number, decimals) {
    if (typeof number !== 'number' || isNaN(number)) return 0;
    return Math.round(number * Math.pow(10, decimals)) / Math.pow(10, decimals);
  }

  /**
   * Generate cache key for portfolio calculation
   */
  generateCacheKey(portfolio, priceCache) {
    const portfolioHash = this.hashObject({
      id: portfolio.id,
      holdingsCount: portfolio.holdings?.length || 0,
      lastModified: portfolio.lastModified
    });
    
    const pricesHash = this.hashObject(
      Array.from(priceCache.entries()).map(([symbol, data]) => ({
        symbol,
        price: data.price,
        timestamp: data.timestamp
      }))
    );
    
    return `portfolio_${portfolioHash}_prices_${pricesHash}`;
  }

  /**
   * Simple hash function for objects
   */
  hashObject(obj) {
    const str = JSON.stringify(obj);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Get result from cache
   */
  getFromCache(key) {
    const cached = this.calculationCache.get(key);
    if (cached && (Date.now() - cached.timestamp) < this.cacheExpiration) {
      return cached.result;
    }
    this.calculationCache.delete(key);
    return null;
  }

  /**
   * Set result in cache
   */
  setCache(key, result) {
    this.calculationCache.set(key, {
      result,
      timestamp: Date.now()
    });
    
    // Clean up old cache entries
    if (this.calculationCache.size > 100) {
      const oldestKey = this.calculationCache.keys().next().value;
      this.calculationCache.delete(oldestKey);
    }
  }

  /**
   * Create empty portfolio result
   */
  createEmptyPortfolioResult() {
    return {
      holdings: [],
      totalValue: 0,
      totalCostBasis: 0,
      totalUnrealizedPnL: 0,
      totalUnrealizedPnLPercentage: 0,
      totalDayChange: 0,
      totalDayChangePercentage: 0,
      change7d: 0,
      changePercentage7d: 0,
      change30d: 0,
      changePercentage30d: 0,
      allocations: [],
      concentrationIndex: 0,
      diversificationScore: 100,
      riskLevel: 'Low',
      assetCount: 0,
      exchangeCount: 0,
      lastCalculated: new Date(),
      calculationId: this.generateCalculationId()
    };
  }

  /**
   * Generate unique calculation ID
   */
  generateCalculationId() {
    return `calc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Update performance metrics
   */
  updateMetrics(startTime) {
    const calculationTime = Date.now() - startTime;
    this.metrics.totalCalculations++;
    this.metrics.lastCalculationTime = calculationTime;
    
    // Update running average
    this.metrics.averageCalculationTime = 
      (this.metrics.averageCalculationTime * (this.metrics.totalCalculations - 1) + calculationTime) / 
      this.metrics.totalCalculations;
  }

  /**
   * Get calculator metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      cacheSize: this.calculationCache.size,
      cacheHitRate: this.metrics.totalCalculations > 0 ? 
        this.metrics.cacheHits / this.metrics.totalCalculations : 0
    };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    
    // Clear cache when config changes
    this.calculationCache.clear();
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.calculationCache.clear();
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    this.calculationCache.clear();
  }
}

export { ValueCalculator };