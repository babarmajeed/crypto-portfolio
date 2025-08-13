# CP-039: Volume Analysis and Market Depth Tools

## Overview
Implement comprehensive volume analysis tools including volume indicators, order book visualization, market depth analysis, and volume-based trading signals for advanced market analysis.

## Objectives
- Build volume-based technical indicators and analysis tools
- Create order book and market depth visualization
- Implement volume profile and VWAP analysis
- Add liquidity and market impact analysis tools

## Acceptance Criteria
- [ ] Volume-based indicators (OBV, Accumulation/Distribution, CMF)
- [ ] Volume Profile with Point of Control (POC) analysis
- [ ] VWAP (Volume Weighted Average Price) calculations
- [ ] Order book visualization with bid/ask depth
- [ ] Market depth charts and liquidity analysis
- [ ] Volume trend analysis and divergence detection
- [ ] Time and Sales data visualization
- [ ] Volume-based alerts and signals
- [ ] Market impact analysis tools
- [ ] Export volume analysis data

## Technical Implementation

### File Structure
```
src/
  components/
    VolumeAnalysis/
      VolumeAnalyzer.jsx
      VolumeProfile.jsx
      OrderBookVisualization.jsx
      MarketDepthChart.jsx
      VolumeIndicators.jsx
      TimeAndSales.jsx
  hooks/
    useVolumeAnalysis.js
    useOrderBook.js
    useMarketDepth.js
  services/
    VolumeAnalysisService.js
    OrderBookService.js
    MarketDataService.js
  utils/
    volumeCalculations.js
    orderBookUtils.js
```

### Volume Analyzer Component
```jsx
// VolumeAnalyzer.jsx
import React, { useState, useEffect } from 'react';
import { useVolumeAnalysis } from '../hooks/useVolumeAnalysis';
import { useOrderBook } from '../hooks/useOrderBook';
import VolumeProfile from './VolumeProfile';
import OrderBookVisualization from './OrderBookVisualization';
import MarketDepthChart from './MarketDepthChart';
import VolumeIndicators from './VolumeIndicators';
import TimeAndSales from './TimeAndSales';

const VolumeAnalyzer = ({ symbol, timeframe = '1h' }) => {
  const [activeTab, setActiveTab] = useState('profile');
  const [analysisType, setAnalysisType] = useState('volume');

  const {
    volumeData,
    volumeProfile,
    vwapData,
    volumeIndicators,
    volumeTrends,
    isLoading: volumeLoading
  } = useVolumeAnalysis(symbol, timeframe);

  const {
    orderBook,
    marketDepth,
    timeAndSales,
    liquidityMetrics,
    isLoading: orderBookLoading
  } = useOrderBook(symbol);

  const tabs = [
    { id: 'profile', label: 'Volume Profile', icon: '📊' },
    { id: 'orderbook', label: 'Order Book', icon: '📖' },
    { id: 'depth', label: 'Market Depth', icon: '🌊' },
    { id: 'indicators', label: 'Volume Indicators', icon: '📈' },
    { id: 'timesales', label: 'Time & Sales', icon: '⏰' }
  ];

  const analysisTypes = [
    { value: 'volume', label: 'Volume Analysis' },
    { value: 'liquidity', label: 'Liquidity Analysis' },
    { value: 'flow', label: 'Order Flow' },
    { value: 'impact', label: 'Market Impact' }
  ];

  const renderVolumeStats = () => {
    if (!volumeData || volumeData.length === 0) return null;

    const latestVolume = volumeData[volumeData.length - 1];
    const avgVolume = volumeData.reduce((sum, v) => sum + v.volume, 0) / volumeData.length;
    const volumeRatio = latestVolume.volume / avgVolume;

    return (
      <div className="volume-stats">
        <div className="stat-card">
          <h4>Current Volume</h4>
          <div className="stat-value">
            {latestVolume.volume.toLocaleString()}
          </div>
          <div className="stat-change">
            {volumeRatio > 1 ? '+' : ''}{((volumeRatio - 1) * 100).toFixed(1)}% vs avg
          </div>
        </div>

        <div className="stat-card">
          <h4>Average Volume (24h)</h4>
          <div className="stat-value">
            {avgVolume.toLocaleString()}
          </div>
        </div>

        <div className="stat-card">
          <h4>Volume Trend</h4>
          <div className={`stat-value ${volumeTrends?.trend === 'increasing' ? 'positive' : 'negative'}`}>
            {volumeTrends?.trend || 'Neutral'}
          </div>
          <div className="stat-change">
            {volumeTrends?.strength}
          </div>
        </div>

        <div className="stat-card">
          <h4>VWAP</h4>
          <div className="stat-value">
            ${vwapData?.current?.toFixed(4) || 'N/A'}
          </div>
          <div className={`stat-change ${vwapData?.deviation >= 0 ? 'positive' : 'negative'}`}>
            {vwapData?.deviation ? `${vwapData.deviation > 0 ? '+' : ''}${vwapData.deviation.toFixed(2)}%` : 'N/A'}
          </div>
        </div>
      </div>
    );
  };

  const renderLiquidityStats = () => {
    if (!liquidityMetrics) return null;

    return (
      <div className="liquidity-stats">
        <div className="stat-card">
          <h4>Bid-Ask Spread</h4>
          <div className="stat-value">
            {liquidityMetrics.spread?.toFixed(4) || 'N/A'}
          </div>
          <div className="stat-change">
            {liquidityMetrics.spreadPercentage?.toFixed(3)}%
          </div>
        </div>

        <div className="stat-card">
          <h4>Market Impact</h4>
          <div className="stat-value">
            {liquidityMetrics.marketImpact?.toFixed(2)}%
          </div>
          <div className="stat-description">For $10k trade</div>
        </div>

        <div className="stat-card">
          <h4>Liquidity Score</h4>
          <div className={`stat-value ${liquidityMetrics.liquidityScore > 7 ? 'positive' : liquidityMetrics.liquidityScore > 4 ? 'neutral' : 'negative'}`}>
            {liquidityMetrics.liquidityScore}/10
          </div>
          <div className="stat-description">
            {liquidityMetrics.liquidityScore > 7 ? 'High' : liquidityMetrics.liquidityScore > 4 ? 'Medium' : 'Low'}
          </div>
        </div>

        <div className="stat-card">
          <h4>Order Book Depth</h4>
          <div className="stat-value">
            ${liquidityMetrics.totalDepth?.toLocaleString() || 'N/A'}
          </div>
          <div className="stat-description">±2% from mid</div>
        </div>
      </div>
    );
  };

  if (volumeLoading || orderBookLoading) {
    return (
      <div className="volume-analyzer-loading">
        <div className="loading-spinner"></div>
        <p>Loading volume analysis data...</p>
      </div>
    );
  }

  return (
    <div className="volume-analyzer">
      <div className="analyzer-header">
        <div className="header-info">
          <h2>{symbol} Volume Analysis</h2>
          <span className="timeframe-label">{timeframe}</span>
        </div>

        <div className="header-controls">
          <select
            value={analysisType}
            onChange={(e) => setAnalysisType(e.target.value)}
            className="analysis-type-select"
          >
            {analysisTypes.map(type => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="analyzer-stats">
        {analysisType === 'volume' && renderVolumeStats()}
        {analysisType === 'liquidity' && renderLiquidityStats()}
      </div>

      <div className="analyzer-navigation">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span className="tab-icon">{tab.icon}</span>
            <span className="tab-label">{tab.label}</span>
          </button>
        ))}
      </div>

      <div className="analyzer-content">
        {activeTab === 'profile' && (
          <VolumeProfile
            volumeProfile={volumeProfile}
            symbol={symbol}
            timeframe={timeframe}
          />
        )}
        
        {activeTab === 'orderbook' && (
          <OrderBookVisualization
            orderBook={orderBook}
            symbol={symbol}
          />
        )}
        
        {activeTab === 'depth' && (
          <MarketDepthChart
            marketDepth={marketDepth}
            symbol={symbol}
          />
        )}
        
        {activeTab === 'indicators' && (
          <VolumeIndicators
            volumeIndicators={volumeIndicators}
            volumeData={volumeData}
            symbol={symbol}
          />
        )}
        
        {activeTab === 'timesales' && (
          <TimeAndSales
            timeAndSales={timeAndSales}
            symbol={symbol}
          />
        )}
      </div>
    </div>
  );
};

export default VolumeAnalyzer;
```

### Volume Profile Component
```jsx
// VolumeProfile.jsx
import React, { useRef, useEffect } from 'react';
import * as d3 from 'd3';

const VolumeProfile = ({ volumeProfile, symbol, timeframe, height = 400 }) => {
  const svgRef = useRef(null);

  useEffect(() => {
    if (!volumeProfile || volumeProfile.length === 0) return;

    drawVolumeProfile();
  }, [volumeProfile, height]);

  const drawVolumeProfile = () => {
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const margin = { top: 20, right: 80, bottom: 40, left: 60 };
    const width = svg.node().getBoundingClientRect().width;
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // Find Point of Control (highest volume price level)
    const poc = volumeProfile.reduce((max, level) => 
      level.volume > max.volume ? level : max
    );

    // Price range
    const priceExtent = d3.extent(volumeProfile, d => d.price);
    const volumeExtent = d3.extent(volumeProfile, d => d.volume);

    // Scales
    const yScale = d3.scaleLinear()
      .domain(priceExtent)
      .range([innerHeight, 0]);

    const xScale = d3.scaleLinear()
      .domain([0, volumeExtent[1]])
      .range([0, innerWidth * 0.7]); // Use 70% of width for bars

    const g = svg.append('g')
      .attr('transform', `translate(${margin.left}, ${margin.top})`);

    // Add volume bars
    g.selectAll('.volume-bar')
      .data(volumeProfile)
      .enter()
      .append('rect')
      .attr('class', 'volume-bar')
      .attr('x', 0)
      .attr('y', d => yScale(d.price + d.priceRange / 2))
      .attr('width', d => xScale(d.volume))
      .attr('height', d => Math.max(1, yScale(d.price - d.priceRange / 2) - yScale(d.price + d.priceRange / 2)))
      .attr('fill', d => d === poc ? '#ff6b6b' : '#4ecdc4')
      .attr('opacity', 0.7)
      .on('mouseover', function(event, d) {
        // Add tooltip
        const tooltip = d3.select('body')
          .append('div')
          .attr('class', 'volume-profile-tooltip')
          .style('position', 'absolute')
          .style('background', 'rgba(0, 0, 0, 0.8)')
          .style('color', 'white')
          .style('padding', '8px')
          .style('border-radius', '4px')
          .style('font-size', '12px')
          .style('pointer-events', 'none')
          .style('z-index', 1000);

        tooltip.html(`
          Price: $${d.price.toFixed(4)}<br/>
          Volume: ${d.volume.toLocaleString()}<br/>
          ${d === poc ? '<strong>Point of Control</strong>' : ''}
        `)
        .style('left', (event.pageX + 10) + 'px')
        .style('top', (event.pageY - 10) + 'px');

        d3.select(this).attr('opacity', 1);
      })
      .on('mouseout', function() {
        d3.selectAll('.volume-profile-tooltip').remove();
        d3.select(this).attr('opacity', 0.7);
      });

    // Add price axis
    const priceAxis = d3.axisLeft(yScale)
      .tickFormat(d => `$${d.toFixed(2)}`);

    g.append('g')
      .attr('class', 'price-axis')
      .call(priceAxis);

    // Add volume axis
    const volumeAxis = d3.axisBottom(xScale)
      .tickFormat(d => d3.format('.2s')(d));

    g.append('g')
      .attr('class', 'volume-axis')
      .attr('transform', `translate(0, ${innerHeight})`)
      .call(volumeAxis);

    // Add POC line
    g.append('line')
      .attr('class', 'poc-line')
      .attr('x1', 0)
      .attr('x2', innerWidth)
      .attr('y1', yScale(poc.price))
      .attr('y2', yScale(poc.price))
      .attr('stroke', '#ff6b6b')
      .attr('stroke-width', 2)
      .attr('stroke-dasharray', '5,5');

    // Add POC label
    g.append('text')
      .attr('class', 'poc-label')
      .attr('x', innerWidth - 5)
      .attr('y', yScale(poc.price) - 5)
      .attr('text-anchor', 'end')
      .attr('font-size', '12px')
      .attr('font-weight', 'bold')
      .attr('fill', '#ff6b6b')
      .text(`POC: $${poc.price.toFixed(2)}`);

    // Add value area (70% of volume)
    const sortedByVolume = [...volumeProfile].sort((a, b) => b.volume - a.volume);
    const totalVolume = volumeProfile.reduce((sum, level) => sum + level.volume, 0);
    const valueAreaVolume = totalVolume * 0.7;
    
    let cumulativeVolume = 0;
    const valueAreaLevels = [];
    
    for (const level of sortedByVolume) {
      if (cumulativeVolume < valueAreaVolume) {
        valueAreaLevels.push(level);
        cumulativeVolume += level.volume;
      } else {
        break;
      }
    }

    const valueAreaPrices = valueAreaLevels.map(level => level.price);
    const valueAreaHigh = Math.max(...valueAreaPrices);
    const valueAreaLow = Math.min(...valueAreaPrices);

    // Add value area rectangle
    g.append('rect')
      .attr('class', 'value-area')
      .attr('x', 0)
      .attr('y', yScale(valueAreaHigh))
      .attr('width', innerWidth)
      .attr('height', yScale(valueAreaLow) - yScale(valueAreaHigh))
      .attr('fill', 'rgba(255, 107, 107, 0.1)')
      .attr('stroke', '#ff6b6b')
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '2,2');

    // Add labels
    g.append('text')
      .attr('x', innerWidth / 2)
      .attr('y', -5)
      .attr('text-anchor', 'middle')
      .attr('font-size', '14px')
      .attr('font-weight', 'bold')
      .text(`${symbol} Volume Profile (${timeframe})`);

    g.append('text')
      .attr('x', innerWidth / 2)
      .attr('y', innerHeight + 35)
      .attr('text-anchor', 'middle')
      .attr('font-size', '12px')
      .text('Volume');

    g.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('y', -40)
      .attr('x', -innerHeight / 2)
      .attr('text-anchor', 'middle')
      .attr('font-size', '12px')
      .text('Price');
  };

  return (
    <div className="volume-profile-container">
      <div className="volume-profile-info">
        <div className="profile-stats">
          <div className="stat-item">
            <label>Point of Control</label>
            <value>${volumeProfile?.find(level => level.volume === Math.max(...volumeProfile.map(l => l.volume)))?.price.toFixed(4)}</value>
          </div>
          <div className="stat-item">
            <label>Value Area High</label>
            <value>${volumeProfile ? Math.max(...volumeProfile.map(l => l.price)).toFixed(4) : 'N/A'}</value>
          </div>
          <div className="stat-item">
            <label>Value Area Low</label>
            <value>${volumeProfile ? Math.min(...volumeProfile.map(l => l.price)).toFixed(4) : 'N/A'}</value>
          </div>
          <div className="stat-item">
            <label>Total Volume</label>
            <value>{volumeProfile ? volumeProfile.reduce((sum, l) => sum + l.volume, 0).toLocaleString() : 'N/A'}</value>
          </div>
        </div>
      </div>

      <svg
        ref={svgRef}
        width="100%"
        height={height}
        className="volume-profile-chart"
      />
    </div>
  );
};

export default VolumeProfile;
```

### Volume Analysis Hook
```javascript
// useVolumeAnalysis.js
import { useState, useEffect } from 'react';
import { volumeAnalysisService } from '../services/VolumeAnalysisService';

export const useVolumeAnalysis = (symbol, timeframe) => {
  const [volumeData, setVolumeData] = useState([]);
  const [volumeProfile, setVolumeProfile] = useState([]);
  const [vwapData, setVwapData] = useState(null);
  const [volumeIndicators, setVolumeIndicators] = useState({});
  const [volumeTrends, setVolumeTrends] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (symbol && timeframe) {
      loadVolumeAnalysis();
    }
  }, [symbol, timeframe]);

  const loadVolumeAnalysis = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const [
        volumeDataResult,
        volumeProfileResult,
        vwapResult,
        indicatorsResult,
        trendsResult
      ] = await Promise.all([
        volumeAnalysisService.getVolumeData(symbol, timeframe),
        volumeAnalysisService.calculateVolumeProfile(symbol, timeframe),
        volumeAnalysisService.calculateVWAP(symbol, timeframe),
        volumeAnalysisService.calculateVolumeIndicators(symbol, timeframe),
        volumeAnalysisService.analyzeVolumeTrends(symbol, timeframe)
      ]);

      setVolumeData(volumeDataResult);
      setVolumeProfile(volumeProfileResult);
      setVwapData(vwapResult);
      setVolumeIndicators(indicatorsResult);
      setVolumeTrends(trendsResult);

    } catch (err) {
      setError(err);
    } finally {
      setIsLoading(false);
    }
  };

  return {
    volumeData,
    volumeProfile,
    vwapData,
    volumeIndicators,
    volumeTrends,
    isLoading,
    error,
    refresh: loadVolumeAnalysis
  };
};
```

### Volume Analysis Service
```javascript
// VolumeAnalysisService.js
import { volumeCalculations } from '../utils/volumeCalculations';

class VolumeAnalysisService {
  constructor(apiClient) {
    this.apiClient = apiClient;
  }

  async getVolumeData(symbol, timeframe, limit = 1000) {
    try {
      const response = await this.apiClient.get('/market-data/volume', {
        params: { symbol, timeframe, limit }
      });

      return response.data.map(point => ({
        timestamp: point.timestamp,
        volume: point.volume,
        price: point.close,
        high: point.high,
        low: point.low,
        open: point.open,
        buyVolume: point.buyVolume,
        sellVolume: point.sellVolume
      }));
    } catch (error) {
      console.error('Error fetching volume data:', error);
      throw error;
    }
  }

  async calculateVolumeProfile(symbol, timeframe, periods = 100) {
    try {
      const priceVolumeData = await this.getVolumeData(symbol, timeframe);
      
      if (priceVolumeData.length === 0) return [];

      // Calculate price levels and volume distribution
      const priceRange = {
        min: Math.min(...priceVolumeData.map(d => d.low)),
        max: Math.max(...priceVolumeData.map(d => d.high))
      };

      const priceStep = (priceRange.max - priceRange.min) / periods;
      const volumeProfile = [];

      for (let i = 0; i < periods; i++) {
        const priceLevel = priceRange.min + (i * priceStep);
        const priceUpperBound = priceLevel + priceStep;
        
        let totalVolume = 0;
        let count = 0;

        priceVolumeData.forEach(point => {
          // Check if this price level intersects with the candle
          if (priceLevel <= point.high && priceUpperBound >= point.low) {
            // Distribute volume proportionally if candle spans multiple levels
            const intersection = Math.min(point.high, priceUpperBound) - Math.max(point.low, priceLevel);
            const candleRange = point.high - point.low;
            const volumeRatio = candleRange > 0 ? intersection / candleRange : 1;
            
            totalVolume += point.volume * volumeRatio;
            count++;
          }
        });

        if (totalVolume > 0) {
          volumeProfile.push({
            price: priceLevel + priceStep / 2, // Mid-point of level
            priceRange: priceStep,
            volume: totalVolume,
            count: count
          });
        }
      }

      return volumeProfile.sort((a, b) => b.volume - a.volume);
    } catch (error) {
      console.error('Error calculating volume profile:', error);
      throw error;
    }
  }

  async calculateVWAP(symbol, timeframe) {
    try {
      const volumeData = await this.getVolumeData(symbol, timeframe);
      
      if (volumeData.length === 0) return null;

      let cumulativeVolumePrice = 0;
      let cumulativeVolume = 0;
      const vwapSeries = [];

      volumeData.forEach(point => {
        const typicalPrice = (point.high + point.low + point.price) / 3;
        cumulativeVolumePrice += typicalPrice * point.volume;
        cumulativeVolume += point.volume;
        
        const vwap = cumulativeVolume > 0 ? cumulativeVolumePrice / cumulativeVolume : 0;
        
        vwapSeries.push({
          timestamp: point.timestamp,
          vwap: vwap,
          price: point.price,
          deviation: ((point.price - vwap) / vwap) * 100
        });
      });

      const currentVwap = vwapSeries[vwapSeries.length - 1];
      
      return {
        current: currentVwap.vwap,
        deviation: currentVwap.deviation,
        series: vwapSeries
      };
    } catch (error) {
      console.error('Error calculating VWAP:', error);
      throw error;
    }
  }

  async calculateVolumeIndicators(symbol, timeframe) {
    try {
      const volumeData = await this.getVolumeData(symbol, timeframe);
      
      if (volumeData.length < 20) return {};

      const indicators = {
        obv: this.calculateOBV(volumeData),
        ad: this.calculateAccumulationDistribution(volumeData),
        cmf: this.calculateChaikinMoneyFlow(volumeData),
        vpt: this.calculateVolumePercentTrend(volumeData),
        nvi: this.calculateNegativeVolumeIndex(volumeData),
        pvi: this.calculatePositiveVolumeIndex(volumeData)
      };

      return indicators;
    } catch (error) {
      console.error('Error calculating volume indicators:', error);
      throw error;
    }
  }

  calculateOBV(volumeData) {
    // On-Balance Volume
    const obv = [{ timestamp: volumeData[0].timestamp, value: 0 }];
    
    for (let i = 1; i < volumeData.length; i++) {
      const current = volumeData[i];
      const previous = volumeData[i - 1];
      const prevOBV = obv[obv.length - 1].value;
      
      let newOBV;
      if (current.price > previous.price) {
        newOBV = prevOBV + current.volume;
      } else if (current.price < previous.price) {
        newOBV = prevOBV - current.volume;
      } else {
        newOBV = prevOBV;
      }
      
      obv.push({
        timestamp: current.timestamp,
        value: newOBV
      });
    }
    
    return obv;
  }

  calculateAccumulationDistribution(volumeData) {
    // Accumulation/Distribution Line
    const ad = [{ timestamp: volumeData[0].timestamp, value: 0 }];
    
    for (let i = 1; i < volumeData.length; i++) {
      const current = volumeData[i];
      const range = current.high - current.low;
      
      let clv = 0; // Close Location Value
      if (range > 0) {
        clv = ((current.price - current.low) - (current.high - current.price)) / range;
      }
      
      const adValue = ad[ad.length - 1].value + (clv * current.volume);
      
      ad.push({
        timestamp: current.timestamp,
        value: adValue
      });
    }
    
    return ad;
  }

  calculateChaikinMoneyFlow(volumeData, period = 20) {
    // Chaikin Money Flow
    const cmf = [];
    
    for (let i = period - 1; i < volumeData.length; i++) {
      let sumMoneyFlowVolume = 0;
      let sumVolume = 0;
      
      for (let j = i - period + 1; j <= i; j++) {
        const point = volumeData[j];
        const range = point.high - point.low;
        
        let moneyFlowMultiplier = 0;
        if (range > 0) {
          moneyFlowMultiplier = ((point.price - point.low) - (point.high - point.price)) / range;
        }
        
        const moneyFlowVolume = moneyFlowMultiplier * point.volume;
        sumMoneyFlowVolume += moneyFlowVolume;
        sumVolume += point.volume;
      }
      
      const cmfValue = sumVolume > 0 ? sumMoneyFlowVolume / sumVolume : 0;
      
      cmf.push({
        timestamp: volumeData[i].timestamp,
        value: cmfValue
      });
    }
    
    return cmf;
  }

  calculateVolumePercentTrend(volumeData) {
    // Volume Price Trend
    const vpt = [{ timestamp: volumeData[0].timestamp, value: 0 }];
    
    for (let i = 1; i < volumeData.length; i++) {
      const current = volumeData[i];
      const previous = volumeData[i - 1];
      const prevVPT = vpt[vpt.length - 1].value;
      
      const percentChange = previous.price > 0 ? (current.price - previous.price) / previous.price : 0;
      const vptValue = prevVPT + (current.volume * percentChange);
      
      vpt.push({
        timestamp: current.timestamp,
        value: vptValue
      });
    }
    
    return vpt;
  }

  calculateNegativeVolumeIndex(volumeData) {
    // Negative Volume Index
    const nvi = [{ timestamp: volumeData[0].timestamp, value: 1000 }];
    
    for (let i = 1; i < volumeData.length; i++) {
      const current = volumeData[i];
      const previous = volumeData[i - 1];
      const prevNVI = nvi[nvi.length - 1].value;
      
      let nviValue;
      if (current.volume < previous.volume) {
        const percentChange = previous.price > 0 ? (current.price - previous.price) / previous.price : 0;
        nviValue = prevNVI + (prevNVI * percentChange);
      } else {
        nviValue = prevNVI;
      }
      
      nvi.push({
        timestamp: current.timestamp,
        value: nviValue
      });
    }
    
    return nvi;
  }

  calculatePositiveVolumeIndex(volumeData) {
    // Positive Volume Index
    const pvi = [{ timestamp: volumeData[0].timestamp, value: 1000 }];
    
    for (let i = 1; i < volumeData.length; i++) {
      const current = volumeData[i];
      const previous = volumeData[i - 1];
      const prevPVI = pvi[pvi.length - 1].value;
      
      let pviValue;
      if (current.volume > previous.volume) {
        const percentChange = previous.price > 0 ? (current.price - previous.price) / previous.price : 0;
        pviValue = prevPVI + (prevPVI * percentChange);
      } else {
        pviValue = prevPVI;
      }
      
      pvi.push({
        timestamp: current.timestamp,
        value: pviValue
      });
    }
    
    return pvi;
  }

  async analyzeVolumeTrends(symbol, timeframe) {
    try {
      const volumeData = await this.getVolumeData(symbol, timeframe, 50);
      
      if (volumeData.length < 10) return null;

      // Calculate volume trend
      const recentVolume = volumeData.slice(-10);
      const earlierVolume = volumeData.slice(-20, -10);
      
      const recentAvg = recentVolume.reduce((sum, v) => sum + v.volume, 0) / recentVolume.length;
      const earlierAvg = earlierVolume.reduce((sum, v) => sum + v.volume, 0) / earlierVolume.length;
      
      const volumeChange = (recentAvg - earlierAvg) / earlierAvg;
      
      let trend = 'neutral';
      let strength = 'weak';
      
      if (Math.abs(volumeChange) > 0.2) {
        strength = 'strong';
      } else if (Math.abs(volumeChange) > 0.1) {
        strength = 'moderate';
      }
      
      if (volumeChange > 0.05) {
        trend = 'increasing';
      } else if (volumeChange < -0.05) {
        trend = 'decreasing';
      }

      return {
        trend,
        strength,
        volumeChange: volumeChange * 100,
        recentAverage: recentAvg,
        historicalAverage: earlierAvg
      };
    } catch (error) {
      console.error('Error analyzing volume trends:', error);
      throw error;
    }
  }
}

export const volumeAnalysisService = new VolumeAnalysisService();
```

## Testing Requirements
- Volume calculation accuracy testing
- Order book data parsing validation
- Real-time volume update testing
- Performance testing with large datasets
- Volume indicator calculation verification

## Dependencies
- Depends on: CP-036 (Advanced Price Charts)
- Depends on: CP-021 (Real-time WebSocket Integration)
- Blocks: CP-053 (Automated Trading Strategies)

## Time Estimate
**Beginner**: 8-10 days
**Intermediate**: 5-7 days
**Advanced**: 3-5 days

## Required Skills
- Volume analysis and trading concepts
- Order book and market microstructure
- Real-time data visualization
- Financial mathematics
- Performance optimization for real-time data