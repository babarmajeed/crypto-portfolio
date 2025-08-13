# CP-037: Multi-Asset Chart Comparison and Correlation Analysis

## Overview
Build advanced charting functionality that allows users to compare multiple cryptocurrencies on the same chart, analyze correlations, and perform comparative technical analysis across different assets.

## Objectives
- Implement side-by-side and overlay chart comparisons
- Create correlation analysis tools and heatmaps
- Build percentage change comparison charts
- Add statistical analysis for asset relationships

## Acceptance Criteria
- [ ] Overlay multiple assets on single chart with dual Y-axes
- [ ] Side-by-side chart comparison view
- [ ] Percentage change normalization for fair comparison
- [ ] Correlation coefficient calculations and visualization
- [ ] Correlation heatmap for portfolio assets
- [ ] Statistical analysis (beta, alpha, Sharpe ratio)
- [ ] Pair trading analysis tools
- [ ] Synchronized chart interactions (zoom, pan, crosshair)
- [ ] Export comparison data and charts
- [ ] Performance ranking and sorting tools

## Technical Implementation

### File Structure
```
src/
  components/
    Charts/
      MultiAssetChart.jsx
      CorrelationHeatmap.jsx
      ComparisonChart.jsx
      StatisticalAnalysis.jsx
      AssetSelector.jsx
      PerformanceTable.jsx
  hooks/
    useMultiAssetData.js
    useCorrelationAnalysis.js
    useStatisticalAnalysis.js
  services/
    CorrelationService.js
    StatisticalAnalysisService.js
  utils/
    correlationCalculations.js
    statisticalUtils.js
```

### Multi-Asset Chart Component
```jsx
// MultiAssetChart.jsx
import React, { useRef, useEffect, useState } from 'react';
import { createChart, ColorType } from 'lightweight-charts';
import { useMultiAssetData } from '../hooks/useMultiAssetData';
import { useCorrelationAnalysis } from '../hooks/useCorrelationAnalysis';
import AssetSelector from './AssetSelector';
import StatisticalAnalysis from './StatisticalAnalysis';

const MultiAssetChart = ({ 
  initialAssets = ['BTC', 'ETH'], 
  timeframe = '1d',
  comparisonMode = 'overlay', // 'overlay', 'sideBySide', 'percentage'
  height = 500 
}) => {
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRefs = useRef(new Map());
  
  const [selectedAssets, setSelectedAssets] = useState(initialAssets);
  const [chartMode, setChartMode] = useState(comparisonMode);
  const [baseAsset, setBaseAsset] = useState(initialAssets[0]);
  const [showStatistics, setShowStatistics] = useState(false);

  const {
    multiAssetData,
    normalizedData,
    isLoading,
    error
  } = useMultiAssetData(selectedAssets, timeframe);

  const {
    correlationMatrix,
    pairCorrelations,
    calculateCorrelation
  } = useCorrelationAnalysis(multiAssetData);

  const assetColors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
    '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F'
  ];

  useEffect(() => {
    if (!chartContainerRef.current) return;

    // Initialize chart
    chartRef.current = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: height,
      layout: {
        background: {
          type: ColorType.Solid,
          color: '#ffffff',
        },
        textColor: '#000000',
      },
      grid: {
        vertLines: { color: '#f0f0f0' },
        horzLines: { color: '#f0f0f0' },
      },
      rightPriceScale: {
        borderColor: '#cccccc',
        visible: true,
      },
      leftPriceScale: {
        borderColor: '#cccccc',
        visible: chartMode === 'overlay',
      },
      timeScale: {
        borderColor: '#cccccc',
        timeVisible: true,
      },
    });

    // Handle resize
    const handleResize = () => {
      if (chartRef.current && chartContainerRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
        });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (chartRef.current) {
        chartRef.current.remove();
      }
    };
  }, [height, chartMode]);

  useEffect(() => {
    if (!chartRef.current || !multiAssetData) return;

    // Clear existing series
    seriesRefs.current.forEach(series => {
      chartRef.current.removeSeries(series);
    });
    seriesRefs.current.clear();

    // Add series for each asset
    selectedAssets.forEach((asset, index) => {
      const assetData = chartMode === 'percentage' 
        ? normalizedData[asset] 
        : multiAssetData[asset];

      if (!assetData || assetData.length === 0) return;

      const color = assetColors[index % assetColors.length];
      const isSecondaryAxis = chartMode === 'overlay' && index > 0;

      const series = chartRef.current.addLineSeries({
        color: color,
        lineWidth: 2,
        title: asset,
        priceScaleId: isSecondaryAxis ? 'left' : 'right',
      });

      const formattedData = assetData.map(point => ({
        time: point.time,
        value: point.close,
      }));

      series.setData(formattedData);
      seriesRefs.current.set(asset, series);
    });

    // Configure price scales for overlay mode
    if (chartMode === 'overlay' && selectedAssets.length > 1) {
      chartRef.current.priceScale('left').applyOptions({
        visible: true,
        position: 'left',
      });
      chartRef.current.priceScale('right').applyOptions({
        visible: true,
        position: 'right',
      });
    }
  }, [multiAssetData, normalizedData, selectedAssets, chartMode]);

  const handleAssetAdd = (asset) => {
    if (!selectedAssets.includes(asset) && selectedAssets.length < 8) {
      setSelectedAssets([...selectedAssets, asset]);
    }
  };

  const handleAssetRemove = (asset) => {
    if (selectedAssets.length > 1) {
      setSelectedAssets(selectedAssets.filter(a => a !== asset));
    }
  };

  const handleModeChange = (mode) => {
    setChartMode(mode);
  };

  const renderLegend = () => {
    return (
      <div className="chart-legend">
        {selectedAssets.map((asset, index) => (
          <div key={asset} className="legend-item">
            <div 
              className="legend-color" 
              style={{ backgroundColor: assetColors[index % assetColors.length] }}
            ></div>
            <span className="legend-label">{asset}</span>
            <button
              className="remove-asset-btn"
              onClick={() => handleAssetRemove(asset)}
              disabled={selectedAssets.length <= 1}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    );
  };

  const renderModeSelector = () => {
    return (
      <div className="chart-mode-selector">
        <button
          className={chartMode === 'overlay' ? 'active' : ''}
          onClick={() => handleModeChange('overlay')}
        >
          Overlay
        </button>
        <button
          className={chartMode === 'percentage' ? 'active' : ''}
          onClick={() => handleModeChange('percentage')}
        >
          Percentage
        </button>
        <button
          className={chartMode === 'sideBySide' ? 'active' : ''}
          onClick={() => handleModeChange('sideBySide')}
        >
          Side by Side
        </button>
      </div>
    );
  };

  const renderCorrelationInfo = () => {
    if (selectedAssets.length < 2) return null;

    const primaryAsset = selectedAssets[0];
    const correlations = selectedAssets.slice(1).map(asset => ({
      asset,
      correlation: calculateCorrelation(primaryAsset, asset)
    }));

    return (
      <div className="correlation-info">
        <h4>Correlation with {primaryAsset}</h4>
        {correlations.map(({ asset, correlation }) => (
          <div key={asset} className="correlation-item">
            <span>{asset}:</span>
            <span className={`correlation-value ${Math.abs(correlation) > 0.7 ? 'strong' : Math.abs(correlation) > 0.3 ? 'moderate' : 'weak'}`}>
              {correlation ? correlation.toFixed(3) : 'N/A'}
            </span>
          </div>
        ))}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="multi-asset-chart-loading">
        <div className="loading-spinner"></div>
        <p>Loading multi-asset data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="multi-asset-chart-error">
        <p>Error loading chart data: {error.message}</p>
      </div>
    );
  }

  return (
    <div className="multi-asset-chart">
      <div className="chart-controls">
        <div className="control-group">
          <AssetSelector
            selectedAssets={selectedAssets}
            onAssetAdd={handleAssetAdd}
            onAssetRemove={handleAssetRemove}
            maxAssets={8}
          />
        </div>

        <div className="control-group">
          {renderModeSelector()}
        </div>

        <div className="control-group">
          <button
            onClick={() => setShowStatistics(!showStatistics)}
            className={`statistics-toggle ${showStatistics ? 'active' : ''}`}
          >
            Statistics
          </button>
        </div>
      </div>

      <div className="chart-content">
        {renderLegend()}
        
        <div
          ref={chartContainerRef}
          className="chart-container"
          style={{ height: `${height}px` }}
        />

        <div className="chart-info">
          {renderCorrelationInfo()}
        </div>
      </div>

      {showStatistics && (
        <StatisticalAnalysis
          assets={selectedAssets}
          data={multiAssetData}
          correlationMatrix={correlationMatrix}
          onClose={() => setShowStatistics(false)}
        />
      )}
    </div>
  );
};

export default MultiAssetChart;
```

### Multi-Asset Data Hook
```javascript
// useMultiAssetData.js
import { useState, useEffect } from 'react';
import { chartDataService } from '../services/ChartDataService';

export const useMultiAssetData = (assets, timeframe) => {
  const [multiAssetData, setMultiAssetData] = useState({});
  const [normalizedData, setNormalizedData] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (assets.length === 0) return;
    
    loadMultiAssetData();
  }, [assets, timeframe]);

  const loadMultiAssetData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Fetch data for all assets in parallel
      const dataPromises = assets.map(asset =>
        chartDataService.getPriceData(asset, timeframe, 1000)
          .then(data => ({ asset, data }))
          .catch(err => ({ asset, error: err }))
      );

      const results = await Promise.all(dataPromises);
      
      const newMultiAssetData = {};
      const errors = [];

      results.forEach(result => {
        if (result.error) {
          errors.push(`${result.asset}: ${result.error.message}`);
        } else {
          newMultiAssetData[result.asset] = result.data;
        }
      });

      if (errors.length > 0) {
        console.warn('Some assets failed to load:', errors);
      }

      setMultiAssetData(newMultiAssetData);
      
      // Calculate normalized (percentage change) data
      const normalized = calculateNormalizedData(newMultiAssetData);
      setNormalizedData(normalized);

    } catch (err) {
      setError(err);
    } finally {
      setIsLoading(false);
    }
  };

  const calculateNormalizedData = (data) => {
    const normalized = {};

    Object.keys(data).forEach(asset => {
      const assetData = data[asset];
      if (!assetData || assetData.length === 0) return;

      const firstPrice = assetData[0].close;
      
      normalized[asset] = assetData.map(point => ({
        ...point,
        close: ((point.close - firstPrice) / firstPrice) * 100
      }));
    });

    return normalized;
  };

  return {
    multiAssetData,
    normalizedData,
    isLoading,
    error,
    refresh: loadMultiAssetData
  };
};
```

### Correlation Analysis Hook
```javascript
// useCorrelationAnalysis.js
import { useState, useEffect } from 'react';
import { correlationService } from '../services/CorrelationService';

export const useCorrelationAnalysis = (multiAssetData) => {
  const [correlationMatrix, setCorrelationMatrix] = useState({});
  const [pairCorrelations, setPairCorrelations] = useState([]);

  useEffect(() => {
    if (!multiAssetData || Object.keys(multiAssetData).length < 2) return;

    calculateCorrelations();
  }, [multiAssetData]);

  const calculateCorrelations = () => {
    const assets = Object.keys(multiAssetData);
    const matrix = {};
    const pairs = [];

    // Calculate correlation matrix
    assets.forEach(asset1 => {
      matrix[asset1] = {};
      
      assets.forEach(asset2 => {
        const correlation = correlationService.calculatePearsonCorrelation(
          multiAssetData[asset1],
          multiAssetData[asset2]
        );
        
        matrix[asset1][asset2] = correlation;

        // Store unique pairs for analysis
        if (asset1 < asset2) { // Avoid duplicates
          pairs.push({
            asset1,
            asset2,
            correlation,
            strength: getCorrelationStrength(correlation)
          });
        }
      });
    });

    setCorrelationMatrix(matrix);
    setPairCorrelations(pairs.sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation)));
  };

  const calculateCorrelation = (asset1, asset2) => {
    if (!multiAssetData[asset1] || !multiAssetData[asset2]) return null;
    
    return correlationService.calculatePearsonCorrelation(
      multiAssetData[asset1],
      multiAssetData[asset2]
    );
  };

  const getCorrelationStrength = (correlation) => {
    const abs = Math.abs(correlation);
    if (abs >= 0.8) return 'very strong';
    if (abs >= 0.6) return 'strong';
    if (abs >= 0.4) return 'moderate';
    if (abs >= 0.2) return 'weak';
    return 'very weak';
  };

  const getTopCorrelatedPairs = (minCorrelation = 0.5) => {
    return pairCorrelations.filter(pair => 
      Math.abs(pair.correlation) >= minCorrelation
    );
  };

  const getAntiCorrelatedPairs = (maxCorrelation = -0.3) => {
    return pairCorrelations.filter(pair => 
      pair.correlation <= maxCorrelation
    );
  };

  return {
    correlationMatrix,
    pairCorrelations,
    calculateCorrelation,
    getCorrelationStrength,
    getTopCorrelatedPairs,
    getAntiCorrelatedPairs
  };
};
```

### Correlation Heatmap Component
```jsx
// CorrelationHeatmap.jsx
import React, { useRef, useEffect } from 'react';
import * as d3 from 'd3';

const CorrelationHeatmap = ({ 
  correlationMatrix, 
  width = 400, 
  height = 400,
  onCellClick = null 
}) => {
  const svgRef = useRef(null);

  useEffect(() => {
    if (!correlationMatrix || Object.keys(correlationMatrix).length === 0) return;

    drawHeatmap();
  }, [correlationMatrix, width, height]);

  const drawHeatmap = () => {
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const assets = Object.keys(correlationMatrix);
    const margin = { top: 80, right: 25, bottom: 25, left: 80 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const cellSize = Math.min(innerWidth, innerHeight) / assets.length;

    // Create color scale
    const colorScale = d3.scaleSequential()
      .interpolator(d3.interpolateRdYlBu)
      .domain([1, -1]);

    const g = svg.append('g')
      .attr('transform', `translate(${margin.left}, ${margin.top})`);

    // Create cells
    const cells = g.selectAll('.cell')
      .data(assets.flatMap(asset1 => 
        assets.map(asset2 => ({
          asset1,
          asset2,
          correlation: correlationMatrix[asset1][asset2]
        }))
      ))
      .enter()
      .append('g')
      .attr('class', 'cell');

    cells.append('rect')
      .attr('x', d => assets.indexOf(d.asset2) * cellSize)
      .attr('y', d => assets.indexOf(d.asset1) * cellSize)
      .attr('width', cellSize)
      .attr('height', cellSize)
      .attr('fill', d => colorScale(d.correlation))
      .attr('stroke', '#fff')
      .attr('stroke-width', 1)
      .style('cursor', 'pointer')
      .on('click', (event, d) => {
        if (onCellClick) {
          onCellClick(d.asset1, d.asset2, d.correlation);
        }
      })
      .on('mouseover', function(event, d) {
        // Add tooltip
        const tooltip = d3.select('body')
          .append('div')
          .attr('class', 'correlation-tooltip')
          .style('position', 'absolute')
          .style('background', 'rgba(0, 0, 0, 0.8)')
          .style('color', 'white')
          .style('padding', '8px')
          .style('border-radius', '4px')
          .style('font-size', '12px')
          .style('pointer-events', 'none')
          .style('z-index', 1000);

        tooltip.html(`
          ${d.asset1} vs ${d.asset2}<br/>
          Correlation: ${d.correlation.toFixed(3)}
        `)
        .style('left', (event.pageX + 10) + 'px')
        .style('top', (event.pageY - 10) + 'px');
      })
      .on('mouseout', function() {
        d3.selectAll('.correlation-tooltip').remove();
      });

    // Add correlation values as text
    cells.append('text')
      .attr('x', d => assets.indexOf(d.asset2) * cellSize + cellSize / 2)
      .attr('y', d => assets.indexOf(d.asset1) * cellSize + cellSize / 2)
      .attr('text-anchor', 'middle')
      .attr('dy', '0.35em')
      .attr('font-size', '10px')
      .attr('font-weight', 'bold')
      .attr('fill', d => Math.abs(d.correlation) > 0.5 ? 'white' : 'black')
      .text(d => d.correlation.toFixed(2));

    // Add row labels
    g.selectAll('.row-label')
      .data(assets)
      .enter()
      .append('text')
      .attr('class', 'row-label')
      .attr('x', -10)
      .attr('y', (d, i) => i * cellSize + cellSize / 2)
      .attr('text-anchor', 'end')
      .attr('dy', '0.35em')
      .attr('font-size', '12px')
      .attr('font-weight', 'bold')
      .text(d => d);

    // Add column labels
    g.selectAll('.col-label')
      .data(assets)
      .enter()
      .append('text')
      .attr('class', 'col-label')
      .attr('x', (d, i) => i * cellSize + cellSize / 2)
      .attr('y', -10)
      .attr('text-anchor', 'middle')
      .attr('font-size', '12px')
      .attr('font-weight', 'bold')
      .text(d => d);

    // Add color legend
    const legendWidth = 200;
    const legendHeight = 10;
    const legend = svg.append('g')
      .attr('transform', `translate(${margin.left}, ${height - margin.bottom + 20})`);

    const legendScale = d3.scaleLinear()
      .domain([-1, 1])
      .range([0, legendWidth]);

    const legendAxis = d3.axisBottom(legendScale)
      .tickSize(legendHeight)
      .tickValues([-1, -0.5, 0, 0.5, 1]);

    // Create gradient for legend
    const defs = svg.append('defs');
    const gradient = defs.append('linearGradient')
      .attr('id', 'correlation-gradient');

    gradient.selectAll('stop')
      .data([-1, -0.5, 0, 0.5, 1])
      .enter()
      .append('stop')
      .attr('offset', d => `${((d + 1) / 2) * 100}%`)
      .attr('stop-color', d => colorScale(d));

    legend.append('rect')
      .attr('width', legendWidth)
      .attr('height', legendHeight)
      .style('fill', 'url(#correlation-gradient)');

    legend.append('g')
      .call(legendAxis);
  };

  return (
    <div className="correlation-heatmap">
      <h3>Asset Correlation Matrix</h3>
      <svg
        ref={svgRef}
        width={width}
        height={height}
        className="heatmap-svg"
      />
    </div>
  );
};

export default CorrelationHeatmap;
```

## Testing Requirements
- Multi-asset data synchronization testing
- Correlation calculation accuracy testing
- Chart performance with multiple assets
- Cross-browser compatibility testing
- Real-time update testing for multiple streams

## Dependencies
- Depends on: CP-036 (Advanced Price Charts)
- Depends on: CP-021 (Real-time WebSocket Integration)
- Blocks: CP-038 (Portfolio Performance Analytics)

## Time Estimate
**Beginner**: 8-10 days
**Intermediate**: 5-7 days
**Advanced**: 3-5 days

## Required Skills
- Advanced data visualization (D3.js)
- Statistical analysis and correlation calculations
- Multi-stream real-time data handling
- Financial mathematics
- Performance optimization for large datasets