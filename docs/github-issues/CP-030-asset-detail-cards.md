# CP-030: Interactive Asset Detail Cards

## Overview
Create comprehensive asset detail cards that display individual cryptocurrency information, performance metrics, charts, and actions in an engaging, interactive format.

## Objectives
- Build responsive asset cards with key metrics and charts
- Implement interactive features like quick buy/sell actions
- Add detailed asset information and market data
- Create card layout system with grid and list views

## Acceptance Criteria
- [ ] Responsive asset cards with multiple layout options
- [ ] Real-time price updates and percentage changes
- [ ] Mini charts showing price trends (sparklines)
- [ ] Quick action buttons (buy, sell, add to watchlist)
- [ ] Detailed asset information (market cap, volume, supply)
- [ ] Holdings information (quantity, value, P&L)
- [ ] Card animations and hover effects
- [ ] Grid and list view toggles
- [ ] Sorting and filtering capabilities
- [ ] Favorite/watchlist functionality

## Technical Implementation

### File Structure
```
src/
  components/
    AssetCards/
      AssetCard.jsx
      AssetCardGrid.jsx
      AssetCardList.jsx
      AssetSparkline.jsx
      QuickActions.jsx
      AssetMetrics.jsx
  hooks/
    useAssetData.js
    useAssetActions.js
  utils/
    assetUtils.js
```

### Main Asset Card Component
```jsx
// AssetCard.jsx
import React, { useState } from 'react';
import { useAssetData } from '../hooks/useAssetData';
import { useAssetActions } from '../hooks/useAssetActions';
import AssetSparkline from './AssetSparkline';
import QuickActions from './QuickActions';
import AssetMetrics from './AssetMetrics';
import { formatCurrency, formatPercentage, formatNumber } from '../utils/formatters';

const AssetCard = ({ 
  symbol, 
  viewMode = 'grid', 
  onCardClick = null,
  showQuickActions = true 
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  
  const {
    assetData,
    holdingData,
    priceHistory,
    isLoading,
    error
  } = useAssetData(symbol);

  const {
    addToWatchlist,
    removeFromWatchlist,
    isInWatchlist,
    openBuyModal,
    openSellModal
  } = useAssetActions(symbol);

  if (isLoading) {
    return <AssetCardSkeleton viewMode={viewMode} />;
  }

  if (error) {
    return <AssetCardError symbol={symbol} error={error} />;
  }

  const {
    name,
    currentPrice,
    priceChange24h,
    priceChangePercentage24h,
    marketCap,
    volume24h,
    rank,
    icon
  } = assetData;

  const {
    quantity,
    value,
    averageCostBasis,
    unrealizedPnL,
    unrealizedPnLPercentage
  } = holdingData || {};

  const isPositiveChange = priceChangePercentage24h >= 0;
  const isPositivePnL = unrealizedPnL >= 0;
  const hasHolding = quantity > 0;

  const handleCardClick = () => {
    if (onCardClick) {
      onCardClick(symbol, assetData);
    } else {
      setShowDetails(!showDetails);
    }
  };

  const handleWatchlistToggle = (e) => {
    e.stopPropagation();
    if (isInWatchlist) {
      removeFromWatchlist(symbol);
    } else {
      addToWatchlist(symbol);
    }
  };

  if (viewMode === 'list') {
    return (
      <div
        className={`asset-card asset-card-list ${isHovered ? 'hovered' : ''}`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={handleCardClick}
      >
        <div className="asset-basic-info">
          <div className="asset-icon-name">
            <img src={icon} alt={symbol} className="asset-icon" />
            <div className="asset-names">
              <span className="asset-symbol">{symbol}</span>
              <span className="asset-name">{name}</span>
            </div>
          </div>
          
          <div className="asset-rank">
            #{rank}
          </div>
        </div>

        <div className="asset-price-info">
          <div className="current-price">
            {formatCurrency(currentPrice)}
          </div>
          <div className={`price-change ${isPositiveChange ? 'positive' : 'negative'}`}>
            {isPositiveChange ? '+' : ''}{formatPercentage(priceChangePercentage24h)}
          </div>
        </div>

        <div className="asset-chart">
          <AssetSparkline 
            data={priceHistory} 
            color={isPositiveChange ? '#00c851' : '#ff4444'}
            width={120}
            height={40}
          />
        </div>

        {hasHolding && (
          <div className="holding-info">
            <div className="holding-value">
              {formatCurrency(value)}
            </div>
            <div className={`holding-pnl ${isPositivePnL ? 'positive' : 'negative'}`}>
              {isPositivePnL ? '+' : ''}{formatPercentage(unrealizedPnLPercentage)}
            </div>
          </div>
        )}

        <div className="asset-market-data">
          <div className="market-cap">
            <label>Market Cap</label>
            <span>{formatNumber(marketCap, { notation: 'compact' })}</span>
          </div>
          <div className="volume">
            <label>24h Volume</label>
            <span>{formatNumber(volume24h, { notation: 'compact' })}</span>
          </div>
        </div>

        {showQuickActions && (
          <QuickActions
            symbol={symbol}
            onBuy={() => openBuyModal(symbol)}
            onSell={() => openSellModal(symbol)}
            onWatchlistToggle={handleWatchlistToggle}
            isInWatchlist={isInWatchlist}
            hasHolding={hasHolding}
          />
        )}
      </div>
    );
  }

  return (
    <div
      className={`asset-card asset-card-grid ${isHovered ? 'hovered' : ''} ${hasHolding ? 'has-holding' : ''}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleCardClick}
    >
      <div className="card-header">
        <div className="asset-info">
          <img src={icon} alt={symbol} className="asset-icon" />
          <div className="asset-details">
            <h3 className="asset-symbol">{symbol}</h3>
            <p className="asset-name">{name}</p>
            <span className="asset-rank">#{rank}</span>
          </div>
        </div>

        <button
          className={`watchlist-btn ${isInWatchlist ? 'active' : ''}`}
          onClick={handleWatchlistToggle}
        >
          {isInWatchlist ? '★' : '☆'}
        </button>
      </div>

      <div className="card-content">
        <div className="price-section">
          <div className="current-price">
            {formatCurrency(currentPrice)}
          </div>
          <div className={`price-change ${isPositiveChange ? 'positive' : 'negative'}`}>
            <span className="change-amount">
              {isPositiveChange ? '+' : ''}{formatCurrency(priceChange24h)}
            </span>
            <span className="change-percentage">
              ({isPositiveChange ? '+' : ''}{formatPercentage(priceChangePercentage24h)})
            </span>
          </div>
        </div>

        <div className="chart-section">
          <AssetSparkline 
            data={priceHistory} 
            color={isPositiveChange ? '#00c851' : '#ff4444'}
            width={280}
            height={60}
          />
        </div>

        {hasHolding && (
          <div className="holding-section">
            <div className="holding-summary">
              <div className="holding-quantity">
                <label>Holdings</label>
                <span>{formatNumber(quantity)} {symbol}</span>
              </div>
              <div className="holding-value">
                <label>Value</label>
                <span>{formatCurrency(value)}</span>
              </div>
            </div>
            
            <div className="pnl-section">
              <div className="cost-basis">
                <label>Avg Cost</label>
                <span>{formatCurrency(averageCostBasis)}</span>
              </div>
              <div className={`unrealized-pnl ${isPositivePnL ? 'positive' : 'negative'}`}>
                <label>Unrealized P&L</label>
                <span>
                  {isPositivePnL ? '+' : ''}{formatCurrency(unrealizedPnL)}
                  ({isPositivePnL ? '+' : ''}{formatPercentage(unrealizedPnLPercentage)})
                </span>
              </div>
            </div>
          </div>
        )}

        <AssetMetrics
          marketCap={marketCap}
          volume24h={volume24h}
          assetData={assetData}
          compact={!showDetails}
        />
      </div>

      {showQuickActions && (
        <div className="card-actions">
          <QuickActions
            symbol={symbol}
            onBuy={() => openBuyModal(symbol)}
            onSell={() => openSellModal(symbol)}
            onWatchlistToggle={handleWatchlistToggle}
            isInWatchlist={isInWatchlist}
            hasHolding={hasHolding}
            layout="grid"
          />
        </div>
      )}

      {showDetails && (
        <div className="card-details-overlay">
          <div className="details-content">
            <button 
              className="close-details"
              onClick={(e) => {
                e.stopPropagation();
                setShowDetails(false);
              }}
            >
              ×
            </button>
            <AssetMetrics
              marketCap={marketCap}
              volume24h={volume24h}
              assetData={assetData}
              compact={false}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default AssetCard;
```

### Asset Data Hook
```javascript
// useAssetData.js
import { useState, useEffect } from 'react';
import { assetService } from '../services/AssetService';
import { portfolioService } from '../services/PortfolioService';
import { priceService } from '../services/PriceService';

export const useAssetData = (symbol) => {
  const [assetData, setAssetData] = useState(null);
  const [holdingData, setHoldingData] = useState(null);
  const [priceHistory, setPriceHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadAssetData();
    
    // Subscribe to real-time price updates
    const unsubscribe = priceService.subscribe(symbol, handlePriceUpdate);
    
    return unsubscribe;
  }, [symbol]);

  const loadAssetData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const [asset, holding, history] = await Promise.all([
        assetService.getAssetInfo(symbol),
        portfolioService.getHolding(symbol),
        priceService.getPriceHistory(symbol, '24h', '1h')
      ]);

      setAssetData(asset);
      setHoldingData(holding);
      setPriceHistory(history);
    } catch (err) {
      setError(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePriceUpdate = (priceData) => {
    setAssetData(prev => ({
      ...prev,
      currentPrice: priceData.price,
      priceChange24h: priceData.change24h,
      priceChangePercentage24h: priceData.changePercentage24h,
      volume24h: priceData.volume24h
    }));

    // Update holding value if user has holdings
    if (holdingData && holdingData.quantity > 0) {
      const newValue = holdingData.quantity * priceData.price;
      const costBasis = holdingData.averageCostBasis * holdingData.quantity;
      
      setHoldingData(prev => ({
        ...prev,
        value: newValue,
        unrealizedPnL: newValue - costBasis,
        unrealizedPnLPercentage: ((newValue - costBasis) / costBasis) * 100
      }));
    }
  };

  return {
    assetData,
    holdingData,
    priceHistory,
    isLoading,
    error,
    refresh: loadAssetData
  };
};
```

### Asset Sparkline Component
```jsx
// AssetSparkline.jsx
import React, { useRef, useEffect } from 'react';
import * as d3 from 'd3';

const AssetSparkline = ({ 
  data, 
  width = 120, 
  height = 40, 
  color = '#007bff',
  showTooltip = false 
}) => {
  const svgRef = useRef(null);

  useEffect(() => {
    if (!data || data.length === 0) return;

    drawSparkline();
  }, [data, width, height, color]);

  const drawSparkline = () => {
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const margin = { top: 5, right: 5, bottom: 5, left: 5 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const xScale = d3.scaleLinear()
      .domain([0, data.length - 1])
      .range([0, innerWidth]);

    const yScale = d3.scaleLinear()
      .domain(d3.extent(data, d => d.price))
      .range([innerHeight, 0]);

    const line = d3.line()
      .x((d, i) => xScale(i))
      .y(d => yScale(d.price))
      .curve(d3.curveMonotoneX);

    const g = svg.append('g')
      .attr('transform', `translate(${margin.left}, ${margin.top})`);

    // Add gradient definition
    const gradient = svg.append('defs')
      .append('linearGradient')
      .attr('id', `sparkline-gradient-${Math.random().toString(36).substr(2, 9)}`)
      .attr('gradientUnits', 'userSpaceOnUse')
      .attr('x1', 0).attr('y1', 0)
      .attr('x2', 0).attr('y2', innerHeight);

    gradient.append('stop')
      .attr('offset', '0%')
      .attr('stop-color', color)
      .attr('stop-opacity', 0.3);

    gradient.append('stop')
      .attr('offset', '100%')
      .attr('stop-color', color)
      .attr('stop-opacity', 0);

    // Add area under the line
    const area = d3.area()
      .x((d, i) => xScale(i))
      .y0(innerHeight)
      .y1(d => yScale(d.price))
      .curve(d3.curveMonotoneX);

    g.append('path')
      .datum(data)
      .attr('fill', `url(#sparkline-gradient-${gradient.attr('id')})`)
      .attr('d', area);

    // Add the line
    g.append('path')
      .datum(data)
      .attr('fill', 'none')
      .attr('stroke', color)
      .attr('stroke-width', 1.5)
      .attr('d', line);

    // Add dots for data points (optional, for hover effect)
    if (showTooltip) {
      g.selectAll('.dot')
        .data(data)
        .enter().append('circle')
        .attr('class', 'dot')
        .attr('cx', (d, i) => xScale(i))
        .attr('cy', d => yScale(d.price))
        .attr('r', 2)
        .attr('fill', color)
        .style('opacity', 0)
        .on('mouseover', function(event, d) {
          d3.select(this).style('opacity', 1);
          // Show tooltip logic here
        })
        .on('mouseout', function() {
          d3.select(this).style('opacity', 0);
        });
    }
  };

  return (
    <svg
      ref={svgRef}
      width={width}
      height={height}
      className="asset-sparkline"
    />
  );
};

export default AssetSparkline;
```

### Quick Actions Component
```jsx
// QuickActions.jsx
import React from 'react';

const QuickActions = ({
  symbol,
  onBuy,
  onSell,
  onWatchlistToggle,
  isInWatchlist,
  hasHolding,
  layout = 'grid'
}) => {
  const handleAction = (action, event) => {
    event.stopPropagation();
    action();
  };

  if (layout === 'list') {
    return (
      <div className="quick-actions quick-actions-list">
        <button
          className="action-btn buy-btn"
          onClick={(e) => handleAction(onBuy, e)}
          title="Buy"
        >
          Buy
        </button>
        
        {hasHolding && (
          <button
            className="action-btn sell-btn"
            onClick={(e) => handleAction(onSell, e)}
            title="Sell"
          >
            Sell
          </button>
        )}
        
        <button
          className={`action-btn watchlist-btn ${isInWatchlist ? 'active' : ''}`}
          onClick={(e) => handleAction(onWatchlistToggle, e)}
          title={isInWatchlist ? 'Remove from watchlist' : 'Add to watchlist'}
        >
          {isInWatchlist ? '★' : '☆'}
        </button>
      </div>
    );
  }

  return (
    <div className="quick-actions quick-actions-grid">
      <button
        className="action-btn buy-btn primary"
        onClick={(e) => handleAction(onBuy, e)}
      >
        Buy {symbol}
      </button>
      
      {hasHolding && (
        <button
          className="action-btn sell-btn secondary"
          onClick={(e) => handleAction(onSell, e)}
        >
          Sell {symbol}
        </button>
      )}
      
      <button
        className={`action-btn watchlist-btn ${isInWatchlist ? 'active' : 'outline'}`}
        onClick={(e) => handleAction(onWatchlistToggle, e)}
      >
        {isInWatchlist ? 'Remove from Watchlist' : 'Add to Watchlist'}
      </button>
    </div>
  );
};

export default QuickActions;
```

## Testing Requirements
- Component rendering tests with various asset data
- Interactive feature testing (hover, click, actions)
- Real-time price update testing
- Performance testing with multiple cards
- Responsive design testing

## Dependencies
- Depends on: CP-004 (Portfolio Management)
- Depends on: CP-027 (Real-time Portfolio Updates)
- Blocks: CP-031 (Asset Search and Filtering)

## Time Estimate
**Beginner**: 6-7 days
**Intermediate**: 4-5 days
**Advanced**: 3-4 days

## Required Skills
- React component development
- D3.js for sparkline charts
- CSS animations and hover effects
- Real-time data handling
- Responsive design patterns