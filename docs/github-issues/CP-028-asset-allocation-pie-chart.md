# CP-028: Interactive Asset Allocation Pie Chart

## Overview
Create an interactive pie chart component that visualizes portfolio asset allocation with hover effects, click-to-drill-down functionality, and real-time updates.

## Objectives
- Build responsive pie chart for asset allocation visualization
- Implement interactive features (hover, click, zoom)
- Add customizable color schemes and themes
- Create drill-down functionality for detailed views

## Acceptance Criteria
- [ ] Interactive pie chart with smooth animations
- [ ] Hover effects showing detailed asset information
- [ ] Click-to-drill-down for exchange-specific allocations
- [ ] Real-time updates when portfolio changes
- [ ] Customizable color themes
- [ ] Legend with asset names and percentages
- [ ] Mobile-responsive design
- [ ] Accessibility support for screen readers
- [ ] Export functionality (PNG, SVG)
- [ ] Minimum slice threshold for readability

## Technical Implementation

### File Structure
```
src/
  components/
    Charts/
      AllocationPieChart.jsx
      ChartTooltip.jsx
      ChartLegend.jsx
      ChartExportMenu.jsx
  hooks/
    useAllocationData.js
    useChartTheme.js
  utils/
    chartUtils.js
    colorUtils.js
```

### Core Component Implementation
```jsx
// AllocationPieChart.jsx
import React, { useState, useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { useAllocationData } from '../hooks/useAllocationData';
import { useChartTheme } from '../hooks/useChartTheme';
import ChartTooltip from './ChartTooltip';
import ChartLegend from './ChartLegend';
import ChartExportMenu from './ChartExportMenu';

const AllocationPieChart = ({ 
  width = 400, 
  height = 400, 
  showLegend = true,
  theme = 'default',
  onSliceClick = null,
  minSlicePercentage = 2 
}) => {
  const svgRef = useRef(null);
  const [selectedSlice, setSelectedSlice] = useState(null);
  const [tooltip, setTooltip] = useState({ visible: false, data: null, x: 0, y: 0 });
  
  const { allocationData, isLoading } = useAllocationData();
  const { colors, getColor } = useChartTheme(theme);

  useEffect(() => {
    if (!allocationData || isLoading) return;
    
    drawChart();
  }, [allocationData, width, height, theme, minSlicePercentage]);

  const processData = (data) => {
    // Group small allocations into "Others"
    const processedData = [];
    let othersValue = 0;
    
    data.forEach(item => {
      if (item.percentage >= minSlicePercentage) {
        processedData.push(item);
      } else {
        othersValue += item.value;
      }
    });

    if (othersValue > 0) {
      processedData.push({
        symbol: 'Others',
        value: othersValue,
        percentage: (othersValue / data.reduce((sum, item) => sum + item.value, 0)) * 100,
        assets: data.filter(item => item.percentage < minSlicePercentage)
      });
    }

    return processedData;
  };

  const drawChart = () => {
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const processedData = processData(allocationData);
    const radius = Math.min(width, height) / 2 - 40;
    const centerX = width / 2;
    const centerY = height / 2;

    // Create pie layout
    const pie = d3.pie()
      .value(d => d.value)
      .sort(null)
      .padAngle(0.02);

    // Create arc generator
    const arc = d3.arc()
      .innerRadius(0)
      .outerRadius(radius);

    const arcHover = d3.arc()
      .innerRadius(0)
      .outerRadius(radius + 10);

    // Create groups for pie slices
    const g = svg.append('g')
      .attr('transform', `translate(${centerX}, ${centerY})`);

    const arcs = g.selectAll('.arc')
      .data(pie(processedData))
      .enter()
      .append('g')
      .attr('class', 'arc');

    // Add pie slices
    arcs.append('path')
      .attr('d', arc)
      .attr('fill', (d, i) => getColor(i))
      .attr('stroke', '#fff')
      .attr('stroke-width', 2)
      .style('cursor', 'pointer')
      .on('mouseover', handleMouseOver)
      .on('mousemove', handleMouseMove)
      .on('mouseout', handleMouseOut)
      .on('click', handleSliceClick)
      .transition()
      .duration(1000)
      .attrTween('d', function(d) {
        const interpolate = d3.interpolate({ startAngle: 0, endAngle: 0 }, d);
        return function(t) {
          return arc(interpolate(t));
        };
      });

    // Add labels
    arcs.append('text')
      .attr('transform', d => `translate(${arc.centroid(d)})`)
      .attr('text-anchor', 'middle')
      .attr('font-size', '12px')
      .attr('font-weight', 'bold')
      .attr('fill', '#333')
      .style('opacity', 0)
      .text(d => d.data.percentage > 5 ? `${d.data.percentage.toFixed(1)}%` : '')
      .transition()
      .delay(1000)
      .duration(500)
      .style('opacity', 1);
  };

  const handleMouseOver = (event, d) => {
    // Animate slice expansion
    d3.select(event.currentTarget)
      .transition()
      .duration(200)
      .attr('d', arcHover);

    // Show tooltip
    setTooltip({
      visible: true,
      data: d.data,
      x: event.pageX,
      y: event.pageY
    });
  };

  const handleMouseMove = (event, d) => {
    setTooltip(prev => ({
      ...prev,
      x: event.pageX,
      y: event.pageY
    }));
  };

  const handleMouseOut = (event, d) => {
    // Reset slice size
    d3.select(event.currentTarget)
      .transition()
      .duration(200)
      .attr('d', arc);

    // Hide tooltip
    setTooltip({ visible: false, data: null, x: 0, y: 0 });
  };

  const handleSliceClick = (event, d) => {
    setSelectedSlice(d.data);
    
    if (onSliceClick) {
      onSliceClick(d.data);
    }
  };

  const handleExport = (format) => {
    const svg = svgRef.current;
    
    if (format === 'svg') {
      exportAsSVG(svg);
    } else if (format === 'png') {
      exportAsPNG(svg, width, height);
    }
  };

  if (isLoading) {
    return (
      <div className="chart-loading">
        <div className="loading-spinner"></div>
        <p>Loading allocation data...</p>
      </div>
    );
  }

  return (
    <div className="allocation-pie-chart">
      <div className="chart-header">
        <h3>Asset Allocation</h3>
        <ChartExportMenu onExport={handleExport} />
      </div>
      
      <div className="chart-container">
        <svg
          ref={svgRef}
          width={width}
          height={height}
          className="pie-chart-svg"
        />
        
        {tooltip.visible && (
          <ChartTooltip
            data={tooltip.data}
            x={tooltip.x}
            y={tooltip.y}
          />
        )}
      </div>

      {showLegend && (
        <ChartLegend
          data={processData(allocationData)}
          colors={colors}
          selectedItem={selectedSlice}
          onItemClick={setSelectedSlice}
        />
      )}
    </div>
  );
};

export default AllocationPieChart;
```

### Allocation Data Hook
```javascript
// useAllocationData.js
import { useState, useEffect } from 'react';
import { portfolioService } from '../services/PortfolioService';

export const useAllocationData = () => {
  const [allocationData, setAllocationData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadAllocationData();
    
    // Subscribe to portfolio updates
    const unsubscribe = portfolioService.subscribe('portfolioUpdate', handlePortfolioUpdate);
    
    return unsubscribe;
  }, []);

  const loadAllocationData = async () => {
    try {
      setIsLoading(true);
      const portfolio = await portfolioService.getPortfolio();
      const allocation = calculateAllocation(portfolio);
      setAllocationData(allocation);
    } catch (err) {
      setError(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePortfolioUpdate = (portfolio) => {
    const allocation = calculateAllocation(portfolio);
    setAllocationData(allocation);
  };

  const calculateAllocation = (portfolio) => {
    if (!portfolio || !portfolio.holdings) return [];

    const totalValue = portfolio.totalValue || 0;
    
    return portfolio.holdings
      .map(holding => ({
        symbol: holding.symbol,
        name: holding.name,
        value: holding.currentValue || 0,
        percentage: totalValue > 0 ? ((holding.currentValue || 0) / totalValue) * 100 : 0,
        quantity: holding.quantity,
        price: holding.currentPrice,
        change24h: holding.priceChange24h || 0,
        exchange: holding.exchange
      }))
      .filter(item => item.value > 0)
      .sort((a, b) => b.value - a.value);
  };

  return {
    allocationData,
    isLoading,
    error,
    refresh: loadAllocationData
  };
};
```

### Chart Tooltip Component
```jsx
// ChartTooltip.jsx
import React from 'react';
import { formatCurrency, formatPercentage } from '../utils/formatters';

const ChartTooltip = ({ data, x, y }) => {
  if (!data) return null;

  const tooltipStyle = {
    position: 'fixed',
    left: x + 10,
    top: y - 10,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    color: 'white',
    padding: '12px',
    borderRadius: '6px',
    fontSize: '14px',
    zIndex: 1000,
    pointerEvents: 'none',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)'
  };

  return (
    <div style={tooltipStyle} className="chart-tooltip">
      <div className="tooltip-header">
        <strong>{data.symbol}</strong>
        {data.name && data.name !== data.symbol && (
          <div className="tooltip-subtext">{data.name}</div>
        )}
      </div>
      
      <div className="tooltip-content">
        <div className="tooltip-row">
          <span>Value:</span>
          <span>{formatCurrency(data.value)}</span>
        </div>
        
        <div className="tooltip-row">
          <span>Allocation:</span>
          <span>{formatPercentage(data.percentage)}</span>
        </div>
        
        {data.quantity && (
          <div className="tooltip-row">
            <span>Quantity:</span>
            <span>{data.quantity.toLocaleString()}</span>
          </div>
        )}
        
        {data.price && (
          <div className="tooltip-row">
            <span>Price:</span>
            <span>{formatCurrency(data.price)}</span>
          </div>
        )}
        
        {data.change24h !== undefined && (
          <div className="tooltip-row">
            <span>24h Change:</span>
            <span className={data.change24h >= 0 ? 'positive' : 'negative'}>
              {formatPercentage(data.change24h)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChartTooltip;
```

### Chart Export Utilities
```javascript
// chartUtils.js
export const exportAsSVG = (svgElement) => {
  const svgData = new XMLSerializer().serializeToString(svgElement);
  const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
  const svgUrl = URL.createObjectURL(svgBlob);
  
  const downloadLink = document.createElement('a');
  downloadLink.href = svgUrl;
  downloadLink.download = `portfolio-allocation-${Date.now()}.svg`;
  document.body.appendChild(downloadLink);
  downloadLink.click();
  document.body.removeChild(downloadLink);
  URL.revokeObjectURL(svgUrl);
};

export const exportAsPNG = (svgElement, width, height) => {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  
  canvas.width = width * 2; // 2x for retina
  canvas.height = height * 2;
  ctx.scale(2, 2);
  
  const svgData = new XMLSerializer().serializeToString(svgElement);
  const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
  const svgUrl = URL.createObjectURL(svgBlob);
  
  const img = new Image();
  img.onload = () => {
    ctx.drawImage(img, 0, 0);
    
    canvas.toBlob((blob) => {
      const pngUrl = URL.createObjectURL(blob);
      const downloadLink = document.createElement('a');
      downloadLink.href = pngUrl;
      downloadLink.download = `portfolio-allocation-${Date.now()}.png`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
      URL.revokeObjectURL(pngUrl);
    });
    
    URL.revokeObjectURL(svgUrl);
  };
  
  img.src = svgUrl;
};
```

## Testing Requirements
- Component rendering tests with various data sets
- Interactive feature testing (hover, click, export)
- Responsive design testing
- Performance testing with large portfolios
- Accessibility testing for screen readers

## Dependencies
- Depends on: CP-004 (Portfolio Management)
- Depends on: CP-027 (Real-time Portfolio Updates)
- Blocks: CP-026 (Dashboard Overview)

## Time Estimate
**Beginner**: 5-6 days
**Intermediate**: 3-4 days
**Advanced**: 2-3 days

## Required Skills
- D3.js for data visualization
- React component development
- SVG and Canvas APIs
- Interactive UI patterns
- Data transformation and formatting