# CP-027: Real-time Portfolio Value Updates

## Overview
Implement real-time portfolio value updates that automatically refresh asset prices, calculate portfolio changes, and update the UI without requiring manual refreshes.

## Objectives
- Stream real-time price data for all portfolio assets
- Calculate portfolio value changes in real-time
- Update UI components automatically with new values
- Implement efficient data reconciliation and caching

## Acceptance Criteria
- [ ] Real-time price updates for all held assets
- [ ] Automatic portfolio value recalculation
- [ ] Live P&L updates with color-coded indicators
- [ ] Percentage change calculations (24h, 7d, 30d)
- [ ] Connection status indicators
- [ ] Offline mode with cached data
- [ ] Data reconciliation on reconnection
- [ ] Performance optimized for 50+ assets
- [ ] Historical price tracking for trend analysis

## Technical Implementation

### File Structure
```
src/
  services/
    realtime/
      PortfolioUpdateService.js
      PriceStreamManager.js
      ValueCalculator.js
      DataReconciler.js
  hooks/
    useRealTimePortfolio.js
    usePriceUpdates.js
  components/
    RealTime/
      PortfolioValue.jsx
      AssetPrice.jsx
      ConnectionStatus.jsx
```

### Core Service Implementation
```javascript
// PortfolioUpdateService.js
class PortfolioUpdateService {
  constructor(portfolioService, priceStreamManager, websocketService) {
    this.portfolioService = portfolioService;
    this.priceStreamManager = priceStreamManager;
    this.websocketService = websocketService;
    this.valueCalculator = new ValueCalculator();
    this.dataReconciler = new DataReconciler();
    
    this.subscribers = new Set();
    this.currentPortfolio = null;
    this.priceCache = new Map();
    this.lastUpdateTime = null;
  }

  async initialize() {
    // Load initial portfolio data
    this.currentPortfolio = await this.portfolioService.getPortfolio();
    
    // Get unique symbols from portfolio
    const symbols = this.extractSymbols(this.currentPortfolio);
    
    // Subscribe to price updates for all symbols
    await this.priceStreamManager.subscribeToSymbols(symbols);
    
    // Setup price update handlers
    this.priceStreamManager.on('priceUpdate', this.handlePriceUpdate.bind(this));
    this.priceStreamManager.on('connectionChange', this.handleConnectionChange.bind(this));
    
    // Setup portfolio change handlers
    this.portfolioService.on('portfolioChange', this.handlePortfolioChange.bind(this));
  }

  handlePriceUpdate(priceData) {
    const { symbol, price, change24h, timestamp } = priceData;
    
    // Update price cache
    this.priceCache.set(symbol, {
      price,
      change24h,
      timestamp,
      lastUpdated: Date.now()
    });

    // Recalculate portfolio if this symbol is in portfolio
    if (this.isSymbolInPortfolio(symbol)) {
      this.recalculatePortfolioValue();
    }
  }

  async handlePortfolioChange(portfolioUpdate) {
    // Update current portfolio
    this.currentPortfolio = await this.portfolioService.getPortfolio();
    
    // Check if we need to subscribe to new symbols
    const newSymbols = this.extractSymbols(this.currentPortfolio);
    const currentSymbols = this.priceStreamManager.getSubscribedSymbols();
    
    const symbolsToAdd = newSymbols.filter(s => !currentSymbols.includes(s));
    const symbolsToRemove = currentSymbols.filter(s => !newSymbols.includes(s));
    
    if (symbolsToAdd.length > 0) {
      await this.priceStreamManager.subscribeToSymbols(symbolsToAdd);
    }
    
    if (symbolsToRemove.length > 0) {
      await this.priceStreamManager.unsubscribeFromSymbols(symbolsToRemove);
    }
    
    // Recalculate with new portfolio structure
    this.recalculatePortfolioValue();
  }

  recalculatePortfolioValue() {
    if (!this.currentPortfolio) return;

    const updatedPortfolio = this.valueCalculator.calculatePortfolioValue(
      this.currentPortfolio,
      this.priceCache
    );

    this.lastUpdateTime = Date.now();
    this.notifySubscribers(updatedPortfolio);
  }

  subscribe(callback) {
    this.subscribers.add(callback);
    
    // Send current data immediately
    if (this.currentPortfolio) {
      const portfolioWithValues = this.valueCalculator.calculatePortfolioValue(
        this.currentPortfolio,
        this.priceCache
      );
      callback(portfolioWithValues);
    }
    
    return () => {
      this.subscribers.delete(callback);
    };
  }

  notifySubscribers(portfolioData) {
    this.subscribers.forEach(callback => {
      try {
        callback(portfolioData);
      } catch (error) {
        console.error('Error in portfolio update subscriber:', error);
      }
    });
  }
}
```

### Value Calculator
```javascript
// ValueCalculator.js
class ValueCalculator {
  calculatePortfolioValue(portfolio, priceCache) {
    let totalValue = 0;
    let totalValue24hAgo = 0;
    const assetValues = [];

    for (const holding of portfolio.holdings) {
      const priceData = priceCache.get(holding.symbol);
      
      if (!priceData) {
        // Use last known price if real-time not available
        priceData = {
          price: holding.lastKnownPrice || 0,
          change24h: 0,
          timestamp: holding.lastPriceUpdate || Date.now()
        };
      }

      const currentValue = holding.quantity * priceData.price;
      const price24hAgo = priceData.price / (1 + (priceData.change24h / 100));
      const value24hAgo = holding.quantity * price24hAgo;

      totalValue += currentValue;
      totalValue24hAgo += value24hAgo;

      assetValues.push({
        ...holding,
        currentPrice: priceData.price,
        currentValue,
        value24hAgo,
        valueChange24h: currentValue - value24hAgo,
        valueChangePercentage24h: ((currentValue - value24hAgo) / value24hAgo) * 100,
        priceChange24h: priceData.change24h,
        lastUpdated: priceData.timestamp,
        allocation: 0 // Will be calculated below
      });
    }

    // Calculate allocations
    assetValues.forEach(asset => {
      asset.allocation = (asset.currentValue / totalValue) * 100;
    });

    const totalChange24h = totalValue - totalValue24hAgo;
    const totalChangePercentage24h = (totalChange24h / totalValue24hAgo) * 100;

    return {
      ...portfolio,
      totalValue,
      totalValue24hAgo,
      totalChange24h,
      totalChangePercentage24h,
      holdings: assetValues,
      lastCalculated: Date.now()
    };
  }

  calculateAssetMetrics(holding, priceData) {
    const currentValue = holding.quantity * priceData.price;
    const costBasis = holding.averageCostBasis * holding.quantity;
    
    return {
      currentValue,
      costBasis,
      unrealizedPnL: currentValue - costBasis,
      unrealizedPnLPercentage: ((currentValue - costBasis) / costBasis) * 100,
      dayChange: currentValue * (priceData.change24h / 100),
      dayChangePercentage: priceData.change24h
    };
  }
}
```

### React Hook for Real-time Updates
```javascript
// useRealTimePortfolio.js
import { useState, useEffect, useRef } from 'react';
import { portfolioUpdateService } from '../services/PortfolioUpdateService';

export const useRealTimePortfolio = () => {
  const [portfolioData, setPortfolioData] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdateTime, setLastUpdateTime] = useState(null);
  const [error, setError] = useState(null);
  const unsubscribeRef = useRef(null);

  useEffect(() => {
    initializeRealTimeUpdates();
    
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, []);

  const initializeRealTimeUpdates = async () => {
    try {
      // Initialize the portfolio update service
      await portfolioUpdateService.initialize();
      
      // Subscribe to portfolio updates
      unsubscribeRef.current = portfolioUpdateService.subscribe((updatedPortfolio) => {
        setPortfolioData(updatedPortfolio);
        setLastUpdateTime(new Date());
        setError(null);
      });

      // Subscribe to connection status
      portfolioUpdateService.priceStreamManager.on('connectionChange', (connected) => {
        setIsConnected(connected);
      });

      setIsConnected(true);
    } catch (err) {
      setError(err);
      setIsConnected(false);
    }
  };

  const refresh = async () => {
    try {
      await portfolioUpdateService.forceRefresh();
    } catch (err) {
      setError(err);
    }
  };

  return {
    portfolioData,
    isConnected,
    lastUpdateTime,
    error,
    refresh
  };
};
```

### Real-time Portfolio Value Component
```jsx
// PortfolioValue.jsx
import React from 'react';
import { useRealTimePortfolio } from '../hooks/useRealTimePortfolio';
import { formatCurrency, formatPercentage } from '../utils/formatters';
import ConnectionStatus from './ConnectionStatus';

const PortfolioValue = () => {
  const { 
    portfolioData, 
    isConnected, 
    lastUpdateTime, 
    error 
  } = useRealTimePortfolio();

  if (error) {
    return (
      <div className="portfolio-value error">
        <p>Error loading portfolio: {error.message}</p>
      </div>
    );
  }

  if (!portfolioData) {
    return (
      <div className="portfolio-value loading">
        <div className="skeleton-value"></div>
      </div>
    );
  }

  const {
    totalValue,
    totalChange24h,
    totalChangePercentage24h
  } = portfolioData;

  const isPositive = totalChange24h >= 0;

  return (
    <div className="portfolio-value">
      <ConnectionStatus 
        isConnected={isConnected} 
        lastUpdate={lastUpdateTime} 
      />
      
      <div className="total-value">
        <div className="value-amount">
          {formatCurrency(totalValue)}
        </div>
        
        <div className={`value-change ${isPositive ? 'positive' : 'negative'}`}>
          <span className="change-amount">
            {isPositive ? '+' : ''}{formatCurrency(totalChange24h)}
          </span>
          <span className="change-percentage">
            ({isPositive ? '+' : ''}{formatPercentage(totalChangePercentage24h)})
          </span>
          <span className="change-period">24h</span>
        </div>
      </div>

      <div className="update-info">
        Last updated: {lastUpdateTime?.toLocaleTimeString()}
      </div>
    </div>
  );
};

export default PortfolioValue;
```

### Connection Status Component
```jsx
// ConnectionStatus.jsx
import React from 'react';

const ConnectionStatus = ({ isConnected, lastUpdate }) => {
  const getStatusText = () => {
    if (isConnected) {
      return 'Live';
    }
    return 'Disconnected';
  };

  const getStatusColor = () => {
    if (isConnected) {
      return '#00c851'; // Green
    }
    return '#ff4444'; // Red
  };

  return (
    <div className="connection-status">
      <div 
        className={`status-indicator ${isConnected ? 'connected' : 'disconnected'}`}
        style={{ backgroundColor: getStatusColor() }}
      ></div>
      <span className="status-text">{getStatusText()}</span>
      {lastUpdate && (
        <span className="last-update">
          • Updated {lastUpdate.toLocaleTimeString()}
        </span>
      )}
    </div>
  );
};

export default ConnectionStatus;
```

## Testing Requirements
- Real-time data flow testing
- WebSocket connection handling tests
- Portfolio calculation accuracy tests
- Performance testing with multiple assets
- Error handling and reconnection tests

## Dependencies
- Depends on: CP-021 (Real-time WebSocket Integration)
- Depends on: CP-004 (Portfolio Management)
- Blocks: CP-026 (Dashboard Overview)

## Time Estimate
**Beginner**: 6-7 days
**Intermediate**: 4-5 days
**Advanced**: 2-3 days

## Required Skills
- Real-time data streaming
- WebSocket management
- React hooks and state management
- Financial calculations
- Performance optimization