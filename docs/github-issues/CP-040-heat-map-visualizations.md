# CP-040: Interactive Heat Map Visualizations

## Overview
Create dynamic heat map visualizations for cryptocurrency market data, including market overview heat maps, correlation matrices, sector performance, and portfolio allocation heat maps with interactive features.

## Objectives
- Build market overview heat maps with size and color encoding
- Create correlation heat maps for portfolio analysis
- Implement sector and category performance heat maps
- Add interactive features like zoom, filter, and drill-down

## Acceptance Criteria
- [ ] Market overview heat map with market cap and performance data
- [ ] Portfolio allocation heat map by asset, sector, and exchange
- [ ] Correlation matrix heat map with interactive elements
- [ ] Sector performance heat map with time-based analysis
- [ ] Interactive features (zoom, hover, click-to-detail)
- [ ] Customizable color schemes and data encoding
- [ ] Real-time data updates for heat maps
- [ ] Export functionality (PNG, SVG, PDF)
- [ ] Mobile-responsive heat map layouts
- [ ] Performance optimization for large datasets

## Technical Implementation

### File Structure
```
src/
  components/
    HeatMaps/
      MarketHeatMap.jsx
      PortfolioHeatMap.jsx
      CorrelationHeatMap.jsx
      SectorHeatMap.jsx
      TreeMapVisualization.jsx
      HeatMapControls.jsx
  hooks/
    useHeatMapData.js
    useHeatMapInteraction.js
  services/
    HeatMapDataService.js
  utils/
    heatMapCalculations.js
    colorScales.js
```

### Market Heat Map Component
```jsx
// MarketHeatMap.jsx
import React, { useRef, useEffect, useState } from 'react';
import * as d3 from 'd3';
import { useHeatMapData } from '../hooks/useHeatMapData';
import { useHeatMapInteraction } from '../hooks/useHeatMapInteraction';
import HeatMapControls from './HeatMapControls';

const MarketHeatMap = ({ 
  width = 800, 
  height = 600,
  colorMetric = 'change24h',
  sizeMetric = 'marketCap',
  category = 'all'
}) => {
  const svgRef = useRef(null);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [viewMode, setViewMode] = useState('treemap');

  const {
    marketData,
    processedData,
    categories,
    isLoading,
    error,
    updateFilters
  } = useHeatMapData(category);

  const {
    handleHover,
    handleClick,
    handleZoom,
    selectedNodes,
    zoomLevel
  } = useHeatMapInteraction();

  useEffect(() => {
    if (!processedData || processedData.length === 0) return;

    if (viewMode === 'treemap') {
      drawTreeMap();
    } else {
      drawGridHeatMap();
    }
  }, [processedData, colorMetric, sizeMetric, width, height, viewMode]);

  const drawTreeMap = () => {
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const margin = { top: 20, right: 20, bottom: 20, left: 20 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // Create hierarchy
    const root = d3.hierarchy({ children: processedData })
      .sum(d => d[sizeMetric] || 0)
      .sort((a, b) => b.value - a.value);

    // Create treemap layout
    const treemap = d3.treemap()
      .size([innerWidth, innerHeight])
      .padding(2)
      .round(true);

    treemap(root);

    // Color scale based on selected metric
    const colorExtent = d3.extent(processedData, d => d[colorMetric]);
    const colorScale = d3.scaleSequential()
      .domain(colorExtent)
      .interpolator(d3.interpolateRdYlGn);

    const g = svg.append('g')
      .attr('transform', `translate(${margin.left}, ${margin.top})`);

    // Create cells
    const cell = g.selectAll('.cell')
      .data(root.leaves())
      .enter()
      .append('g')
      .attr('class', 'cell')
      .attr('transform', d => `translate(${d.x0}, ${d.y0})`);

    // Add rectangles
    cell.append('rect')
      .attr('width', d => d.x1 - d.x0)
      .attr('height', d => d.y1 - d.y0)
      .attr('fill', d => colorScale(d.data[colorMetric]))
      .attr('stroke', '#fff')
      .attr('stroke-width', 1)
      .style('cursor', 'pointer')
      .on('mouseover', function(event, d) {
        handleHover(event, d.data);
        d3.select(this)
          .attr('stroke', '#333')
          .attr('stroke-width', 2);
        
        showTooltip(event, d.data);
      })
      .on('mouseout', function(event, d) {
        d3.select(this)
          .attr('stroke', '#fff')
          .attr('stroke-width', 1);
        
        hideTooltip();
      })
      .on('click', function(event, d) {
        handleClick(event, d.data);
        setSelectedAsset(d.data);
      });

    // Add labels
    cell.append('text')
      .attr('x', d => (d.x1 - d.x0) / 2)
      .attr('y', d => (d.y1 - d.y0) / 2)
      .attr('text-anchor', 'middle')
      .attr('dy', '0.35em')
      .attr('font-size', d => {
        const area = (d.x1 - d.x0) * (d.y1 - d.y0);
        return Math.min(12, Math.sqrt(area) / 10);
      })
      .attr('font-weight', 'bold')
      .attr('fill', d => {
        const value = d.data[colorMetric];
        return Math.abs(value) > 0.5 ? '#fff' : '#333';
      })
      .text(d => d.data.symbol)
      .style('pointer-events', 'none');

    // Add percentage labels
    cell.append('text')
      .attr('x', d => (d.x1 - d.x0) / 2)
      .attr('y', d => (d.y1 - d.y0) / 2 + 15)
      .attr('text-anchor', 'middle')
      .attr('dy', '0.35em')
      .attr('font-size', d => {
        const area = (d.x1 - d.x0) * (d.y1 - d.y0);
        return Math.min(10, Math.sqrt(area) / 12);
      })
      .attr('fill', d => {
        const value = d.data[colorMetric];
        return Math.abs(value) > 0.5 ? '#fff' : '#666';
      })
      .text(d => `${d.data[colorMetric] > 0 ? '+' : ''}${d.data[colorMetric].toFixed(1)}%`)
      .style('pointer-events', 'none');
  };

  const drawGridHeatMap = () => {
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const cols = Math.ceil(Math.sqrt(processedData.length * (width / height)));
    const rows = Math.ceil(processedData.length / cols);
    
    const cellWidth = width / cols;
    const cellHeight = height / rows;

    // Color scale
    const colorExtent = d3.extent(processedData, d => d[colorMetric]);
    const colorScale = d3.scaleSequential()
      .domain(colorExtent)
      .interpolator(d3.interpolateRdYlGn);

    const g = svg.append('g');

    // Create grid cells
    processedData.forEach((asset, index) => {
      const row = Math.floor(index / cols);
      const col = index % cols;
      const x = col * cellWidth;
      const y = row * cellHeight;

      const cell = g.append('g')
        .attr('class', 'grid-cell')
        .attr('transform', `translate(${x}, ${y})`);

      cell.append('rect')
        .attr('width', cellWidth - 2)
        .attr('height', cellHeight - 2)
        .attr('fill', colorScale(asset[colorMetric]))
        .attr('stroke', '#fff')
        .attr('stroke-width', 1)
        .style('cursor', 'pointer')
        .on('mouseover', function(event) {
          d3.select(this)
            .attr('stroke', '#333')
            .attr('stroke-width', 2);
          
          showTooltip(event, asset);
        })
        .on('mouseout', function() {
          d3.select(this)
            .attr('stroke', '#fff')
            .attr('stroke-width', 1);
          
          hideTooltip();
        })
        .on('click', function(event) {
          setSelectedAsset(asset);
        });

      // Add symbol text
      cell.append('text')
        .attr('x', cellWidth / 2)
        .attr('y', cellHeight / 2 - 5)
        .attr('text-anchor', 'middle')
        .attr('dy', '0.35em')
        .attr('font-size', Math.min(12, cellWidth / 6))
        .attr('font-weight', 'bold')
        .attr('fill', '#fff')
        .text(asset.symbol)
        .style('pointer-events', 'none');

      // Add percentage text
      cell.append('text')
        .attr('x', cellWidth / 2)
        .attr('y', cellHeight / 2 + 8)
        .attr('text-anchor', 'middle')
        .attr('dy', '0.35em')
        .attr('font-size', Math.min(10, cellWidth / 8))
        .attr('fill', '#fff')
        .text(`${asset[colorMetric] > 0 ? '+' : ''}${asset[colorMetric].toFixed(1)}%`)
        .style('pointer-events', 'none');
    });
  };

  const showTooltip = (event, data) => {
    const tooltip = d3.select('body')
      .append('div')
      .attr('class', 'heatmap-tooltip')
      .style('position', 'absolute')
      .style('background', 'rgba(0, 0, 0, 0.9)')
      .style('color', 'white')
      .style('padding', '12px')
      .style('border-radius', '6px')
      .style('font-size', '14px')
      .style('pointer-events', 'none')
      .style('z-index', 1000);

    tooltip.html(`
      <div style="font-weight: bold; margin-bottom: 8px;">${data.name} (${data.symbol})</div>
      <div>Price: $${data.price?.toFixed(4) || 'N/A'}</div>
      <div>24h Change: <span style="color: ${data[colorMetric] >= 0 ? '#4ade80' : '#f87171'}">${data[colorMetric] > 0 ? '+' : ''}${data[colorMetric]?.toFixed(2) || 'N/A'}%</span></div>
      <div>Market Cap: $${(data.marketCap / 1e9)?.toFixed(2) || 'N/A'}B</div>
      <div>Volume: $${(data.volume24h / 1e6)?.toFixed(2) || 'N/A'}M</div>
      ${data.category ? `<div>Category: ${data.category}</div>` : ''}
    `)
    .style('left', (event.pageX + 10) + 'px')
    .style('top', (event.pageY - 10) + 'px');
  };

  const hideTooltip = () => {
    d3.selectAll('.heatmap-tooltip').remove();
  };

  const handleMetricChange = (metric, type) => {
    if (type === 'color') {
      // Update color metric and redraw
    } else if (type === 'size') {
      // Update size metric and redraw
    }
  };

  const handleExport = (format) => {
    const svg = svgRef.current;
    
    if (format === 'png') {
      // Convert SVG to PNG
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = width;
      canvas.height = height;
      
      const svgData = new XMLSerializer().serializeToString(svg);
      const img = new Image();
      
      img.onload = () => {
        ctx.drawImage(img, 0, 0);
        const link = document.createElement('a');
        link.download = 'market-heatmap.png';
        link.href = canvas.toDataURL();
        link.click();
      };
      
      img.src = 'data:image/svg+xml;base64,' + btoa(svgData);
    } else if (format === 'svg') {
      const svgData = new XMLSerializer().serializeToString(svg);
      const blob = new Blob([svgData], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'market-heatmap.svg';
      link.click();
      URL.revokeObjectURL(url);
    }
  };

  if (isLoading) {
    return (
      <div className="heatmap-loading">
        <div className="loading-spinner"></div>
        <p>Loading market data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="heatmap-error">
        <p>Error loading heat map: {error.message}</p>
      </div>
    );
  }

  return (
    <div className="market-heatmap">
      <HeatMapControls
        colorMetric={colorMetric}
        sizeMetric={sizeMetric}
        viewMode={viewMode}
        categories={categories}
        selectedCategory={category}
        onMetricChange={handleMetricChange}
        onViewModeChange={setViewMode}
        onCategoryChange={updateFilters}
        onExport={handleExport}
      />

      <div className="heatmap-container">
        <svg
          ref={svgRef}
          width={width}
          height={height}
          className="heatmap-svg"
        />
      </div>

      {selectedAsset && (
        <div className="asset-detail-panel">
          <div className="panel-header">
            <h3>{selectedAsset.name}</h3>
            <button onClick={() => setSelectedAsset(null)}>×</button>
          </div>
          <div className="panel-content">
            <div className="detail-row">
              <span>Symbol:</span>
              <span>{selectedAsset.symbol}</span>
            </div>
            <div className="detail-row">
              <span>Price:</span>
              <span>${selectedAsset.price?.toFixed(4)}</span>
            </div>
            <div className="detail-row">
              <span>24h Change:</span>
              <span className={selectedAsset.change24h >= 0 ? 'positive' : 'negative'}>
                {selectedAsset.change24h > 0 ? '+' : ''}{selectedAsset.change24h?.toFixed(2)}%
              </span>
            </div>
            <div className="detail-row">
              <span>Market Cap:</span>
              <span>${(selectedAsset.marketCap / 1e9)?.toFixed(2)}B</span>
            </div>
            <div className="detail-row">
              <span>Volume 24h:</span>
              <span>${(selectedAsset.volume24h / 1e6)?.toFixed(2)}M</span>
            </div>
          </div>
        </div>
      )}

      <div className="heatmap-legend">
        <div className="legend-title">24h Change (%)</div>
        <div className="legend-gradient">
          <div className="gradient-bar"></div>
          <div className="gradient-labels">
            <span>-10%</span>
            <span>0%</span>
            <span>+10%</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MarketHeatMap;
```

### Heat Map Data Hook
```javascript
// useHeatMapData.js
import { useState, useEffect } from 'react';
import { heatMapDataService } from '../services/HeatMapDataService';

export const useHeatMapData = (initialCategory = 'all') => {
  const [marketData, setMarketData] = useState([]);
  const [processedData, setProcessedData] = useState([]);
  const [categories, setCategories] = useState([]);
  const [filters, setFilters] = useState({
    category: initialCategory,
    minMarketCap: 0,
    maxAssets: 100
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadMarketData();
  }, [filters]);

  const loadMarketData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const [data, categoryList] = await Promise.all([
        heatMapDataService.getMarketData(filters),
        heatMapDataService.getCategories()
      ]);

      setMarketData(data);
      setCategories(categoryList);
      
      // Process data for visualization
      const processed = processDataForVisualization(data);
      setProcessedData(processed);

    } catch (err) {
      setError(err);
    } finally {
      setIsLoading(false);
    }
  };

  const processDataForVisualization = (data) => {
    return data
      .filter(asset => asset.marketCap > filters.minMarketCap)
      .slice(0, filters.maxAssets)
      .map(asset => ({
        ...asset,
        change24h: asset.priceChangePercentage24h || 0,
        volume24h: asset.totalVolume || 0,
        size: asset.marketCap || 0
      }))
      .sort((a, b) => b.marketCap - a.marketCap);
  };

  const updateFilters = (newFilters) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  };

  return {
    marketData,
    processedData,
    categories,
    filters,
    isLoading,
    error,
    updateFilters,
    refresh: loadMarketData
  };
};
```

### Heat Map Data Service
```javascript
// HeatMapDataService.js
class HeatMapDataService {
  constructor(apiClient) {
    this.apiClient = apiClient;
  }

  async getMarketData(filters = {}) {
    try {
      const params = {
        vs_currency: 'usd',
        order: 'market_cap_desc',
        per_page: filters.maxAssets || 100,
        page: 1,
        sparkline: false,
        price_change_percentage: '24h,7d,30d'
      };

      if (filters.category && filters.category !== 'all') {
        params.category = filters.category;
      }

      const response = await this.apiClient.get('/coins/markets', { params });

      return response.data.map(coin => ({
        id: coin.id,
        symbol: coin.symbol.toUpperCase(),
        name: coin.name,
        image: coin.image,
        currentPrice: coin.current_price,
        price: coin.current_price,
        marketCap: coin.market_cap,
        marketCapRank: coin.market_cap_rank,
        fullyDilutedValuation: coin.fully_diluted_valuation,
        totalVolume: coin.total_volume,
        volume24h: coin.total_volume,
        high24h: coin.high_24h,
        low24h: coin.low_24h,
        priceChange24h: coin.price_change_24h,
        priceChangePercentage24h: coin.price_change_percentage_24h,
        priceChangePercentage7d: coin.price_change_percentage_7d_in_currency,
        priceChangePercentage30d: coin.price_change_percentage_30d_in_currency,
        marketCapChange24h: coin.market_cap_change_24h,
        marketCapChangePercentage24h: coin.market_cap_change_percentage_24h,
        circulatingSupply: coin.circulating_supply,
        totalSupply: coin.total_supply,
        maxSupply: coin.max_supply,
        ath: coin.ath,
        athChangePercentage: coin.ath_change_percentage,
        athDate: coin.ath_date,
        atl: coin.atl,
        atlChangePercentage: coin.atl_change_percentage,
        atlDate: coin.atl_date,
        lastUpdated: coin.last_updated
      }));
    } catch (error) {
      console.error('Error fetching market data:', error);
      throw error;
    }
  }

  async getCategories() {
    try {
      const response = await this.apiClient.get('/coins/categories/list');
      
      return [
        { id: 'all', name: 'All Categories' },
        ...response.data.map(category => ({
          id: category.category_id,
          name: category.name
        }))
      ];
    } catch (error) {
      console.error('Error fetching categories:', error);
      return [{ id: 'all', name: 'All Categories' }];
    }
  }

  async getPortfolioHeatMapData(portfolioId) {
    try {
      const response = await this.apiClient.get(`/portfolios/${portfolioId}/heatmap-data`);
      
      return response.data.map(holding => ({
        symbol: holding.symbol,
        name: holding.name,
        value: holding.currentValue,
        allocation: holding.allocationPercentage,
        change24h: holding.priceChangePercentage24h,
        profit: holding.unrealizedPnL,
        profitPercentage: holding.unrealizedPnLPercentage,
        exchange: holding.exchange,
        category: holding.category
      }));
    } catch (error) {
      console.error('Error fetching portfolio heatmap data:', error);
      throw error;
    }
  }

  async getSectorPerformanceData(timeframe = '24h') {
    try {
      const response = await this.apiClient.get('/coins/categories', {
        params: { order: 'market_cap_desc' }
      });

      return response.data.map(sector => ({
        id: sector.id,
        name: sector.name,
        marketCap: sector.market_cap,
        marketCapChange24h: sector.market_cap_change_24h,
        volume24h: sector.volume_24h,
        change24h: sector.market_cap_change_24h_percentage || 0,
        topCoins: sector.top_3_coins || [],
        updatedAt: sector.updated_at
      }));
    } catch (error) {
      console.error('Error fetching sector performance data:', error);
      throw error;
    }
  }

  calculateCorrelationMatrix(assets, timeframe = '30d') {
    // This would typically be done on the backend
    // For now, return mock correlation data
    const correlationMatrix = {};
    
    assets.forEach(asset1 => {
      correlationMatrix[asset1.symbol] = {};
      
      assets.forEach(asset2 => {
        if (asset1.symbol === asset2.symbol) {
          correlationMatrix[asset1.symbol][asset2.symbol] = 1;
        } else {
          // Mock correlation calculation
          correlationMatrix[asset1.symbol][asset2.symbol] = 
            (Math.random() - 0.5) * 2; // Random correlation between -1 and 1
        }
      });
    });

    return correlationMatrix;
  }
}

export const heatMapDataService = new HeatMapDataService();
```

## Testing Requirements
- Heat map rendering performance testing
- Interactive feature testing (hover, click, zoom)
- Data accuracy validation for large datasets
- Mobile responsiveness testing
- Export functionality testing

## Dependencies
- Depends on: CP-036 (Advanced Price Charts)
- Depends on: CP-037 (Multi-Asset Chart Comparison)
- Blocks: CP-041 (Real-time News Feed)

## Time Estimate
**Beginner**: 7-9 days
**Intermediate**: 4-6 days
**Advanced**: 3-4 days

## Required Skills
- D3.js advanced visualization techniques
- Treemap and grid layout algorithms
- Interactive data visualization
- Color theory and data encoding
- Performance optimization for large datasets