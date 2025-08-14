import React, { useRef, useEffect, useState, useMemo } from 'react';
import * as d3 from 'd3';
import {
  TrendingUp,
  TrendingDown,
  Grid,
  Map,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Maximize2,
  Eye,
  AlertTriangle,
  RefreshCw
} from 'lucide-react';
import { useHeatMapData } from '../../hooks/useHeatMapData';
import { useHeatMapInteraction } from '../../hooks/useHeatMapInteraction';
import { ColorUtils, colorSchemes } from '../../utils/colorScales';
import { HeatMapCalculations, HeatMapNode } from '../../utils/heatMapCalculations';

interface MarketHeatMapProps {
  width?: number;
  height?: number;
  colorMetric?: 'priceChangePercentage24h' | 'priceChangePercentage7d' | 'marketCapChangePercentage24h';
  sizeMetric?: 'marketCap' | 'totalVolume' | 'fullyDilutedValuation';
  viewMode?: 'treemap' | 'grid';
  category?: string;
  showControls?: boolean;
  autoRefresh?: boolean;
  className?: string;
}

const MarketHeatMap: React.FC<MarketHeatMapProps> = ({
  width = 800,
  height = 600,
  colorMetric = 'priceChangePercentage24h',
  sizeMetric = 'marketCap',
  viewMode: initialViewMode = 'treemap',
  category = 'all',
  showControls = true,
  autoRefresh = false,
  className = ''
}) => {
  // Refs
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  // State
  const [viewMode, setViewMode] = useState(initialViewMode);
  const [selectedAsset, setSelectedAsset] = useState<HeatMapNode | null>(null);
  const [dimensions, setDimensions] = useState({ width, height });

  // Hooks
  const {
    marketData,
    processedNodes,
    filteredNodes,
    categories,
    stats,
    isLoading,
    error,
    updateFilters,
    refresh
  } = useHeatMapData({
    autoRefresh,
    refreshInterval: 30000,
    initialFilters: { category, maxAssets: 100 }
  });

  const {
    hoveredNode,
    selectedNode,
    tooltipData,
    zoomLevel,
    zoomTransform,
    handleHover,
    handleMouseLeave,
    handleClick,
    zoomIn,
    zoomOut,
    resetZoom,
    setContainerRef
  } = useHeatMapInteraction({
    enableZoom: true,
    enableSelection: true,
    onNodeClick: (node) => setSelectedAsset(node),
    onNodeHover: (node, event) => {
      if (node && tooltipRef.current) {
        showTooltip(event, node);
      } else {
        hideTooltip();
      }
    }
  });

  // Calculate responsive dimensions
  useEffect(() => {
    if (containerRef.current) {
      const resizeObserver = new ResizeObserver((entries) => {
        const entry = entries[0];
        if (entry) {
          const { width: containerWidth, height: containerHeight } = entry.contentRect;
          setDimensions({
            width: containerWidth || width,
            height: containerHeight || height
          });
        }
      });

      resizeObserver.observe(containerRef.current);
      return () => resizeObserver.disconnect();
    }
  }, [width, height]);

  // Color scale
  const colorScale = useMemo(() => {
    if (filteredNodes.length === 0) return null;

    const values = filteredNodes.map(node => node.color);
    const extent = d3.extent(values) as [number, number];
    
    if (colorMetric.includes('change') || colorMetric.includes('percentage')) {
      // Diverging scale for performance metrics
      return d3.scaleSequential()
        .domain(extent)
        .interpolator(d3.interpolateRdYlGn);
    } else {
      // Sequential scale for volume/market cap
      return d3.scaleSequential()
        .domain(extent)
        .interpolator(d3.interpolateBlues);
    }
  }, [filteredNodes, colorMetric]);

  // Size scale
  const sizeScale = useMemo(() => {
    if (filteredNodes.length === 0) return null;

    const values = filteredNodes.map(node => node.size);
    const extent = d3.extent(values) as [number, number];
    
    return d3.scaleLinear()
      .domain(extent)
      .range([20, 1000]); // Min and max area for cells
  }, [filteredNodes]);

  // Draw treemap visualization
  const drawTreeMap = () => {
    if (!svgRef.current || !colorScale || !filteredNodes.length) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const margin = { top: 20, right: 20, bottom: 20, left: 20 };
    const innerWidth = dimensions.width - margin.left - margin.right;
    const innerHeight = dimensions.height - margin.top - margin.bottom;

    // Create hierarchy
    const root = d3.hierarchy({ children: filteredNodes } as any)
      .sum(d => d.size || 0)
      .sort((a, b) => (b.value || 0) - (a.value || 0));

    // Create treemap layout
    const treemap = d3.treemap<HeatMapNode>()
      .size([innerWidth, innerHeight])
      .padding(2)
      .round(true);

    treemap(root);

    const g = svg.append('g')
      .attr('transform', `translate(${margin.left}, ${margin.top})`);

    // Create cells
    const cell = g.selectAll('.heatmap-cell')
      .data(root.leaves())
      .enter()
      .append('g')
      .attr('class', 'heatmap-cell')
      .attr('transform', d => `translate(${d.x0}, ${d.y0})`);

    // Add rectangles
    cell.append('rect')
      .attr('width', d => Math.max(0, (d.x1 || 0) - (d.x0 || 0)))
      .attr('height', d => Math.max(0, (d.y1 || 0) - (d.y0 || 0)))
      .attr('fill', d => colorScale(d.data.color))
      .attr('stroke', '#fff')
      .attr('stroke-width', 1)
      .style('cursor', 'pointer')
      .on('mouseover', function(event, d) {
        d3.select(this)
          .attr('stroke', '#333')
          .attr('stroke-width', 2);
        
        handleHover(event as any, d.data);
      })
      .on('mouseout', function() {
        d3.select(this)
          .attr('stroke', '#fff')
          .attr('stroke-width', 1);
        
        handleMouseLeave();
      })
      .on('click', function(event, d) {
        handleClick(event as any, d.data);
      });

    // Add symbol labels
    cell.append('text')
      .attr('x', d => ((d.x1 || 0) - (d.x0 || 0)) / 2)
      .attr('y', d => ((d.y1 || 0) - (d.y0 || 0)) / 2 - 5)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('font-size', d => {
        const area = ((d.x1 || 0) - (d.x0 || 0)) * ((d.y1 || 0) - (d.y0 || 0));
        return Math.min(14, Math.max(8, Math.sqrt(area) / 8));
      })
      .attr('font-weight', 'bold')
      .attr('fill', d => {
        const bgColor = colorScale(d.data.color);
        return ColorUtils.getContrastingTextColor(bgColor);
      })
      .text(d => d.data.symbol)
      .style('pointer-events', 'none');

    // Add percentage labels
    cell.append('text')
      .attr('x', d => ((d.x1 || 0) - (d.x0 || 0)) / 2)
      .attr('y', d => ((d.y1 || 0) - (d.y0 || 0)) / 2 + 12)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('font-size', d => {
        const area = ((d.x1 || 0) - (d.x0 || 0)) * ((d.y1 || 0) - (d.y0 || 0));
        return Math.min(12, Math.max(6, Math.sqrt(area) / 10));
      })
      .attr('fill', d => {
        const bgColor = colorScale(d.data.color);
        const textColor = ColorUtils.getContrastingTextColor(bgColor);
        return d3.color(textColor)?.opacity(0.8)?.toString() || textColor;
      })
      .text(d => `${d.data.color > 0 ? '+' : ''}${d.data.color.toFixed(1)}%`)
      .style('pointer-events', 'none');
  };

  // Draw grid visualization
  const drawGridHeatMap = () => {
    if (!svgRef.current || !colorScale || !filteredNodes.length) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const margin = { top: 20, right: 20, bottom: 20, left: 20 };
    const innerWidth = dimensions.width - margin.left - margin.right;
    const innerHeight = dimensions.height - margin.top - margin.bottom;

    // Calculate grid layout
    const layout = HeatMapCalculations.calculateGridLayout(
      filteredNodes.length,
      { width: dimensions.width, height: dimensions.height, margin, innerWidth, innerHeight }
    );

    const g = svg.append('g')
      .attr('transform', `translate(${margin.left}, ${margin.top})`);

    // Create grid cells
    filteredNodes.forEach((node, index) => {
      if (index >= layout.positions.length) return;

      const position = layout.positions[index];
      
      const cell = g.append('g')
        .attr('class', 'grid-cell')
        .attr('transform', `translate(${position.x}, ${position.y})`);

      cell.append('rect')
        .attr('width', position.width)
        .attr('height', position.height)
        .attr('fill', colorScale(node.color))
        .attr('stroke', '#fff')
        .attr('stroke-width', 1)
        .style('cursor', 'pointer')
        .on('mouseover', function(event) {
          d3.select(this)
            .attr('stroke', '#333')
            .attr('stroke-width', 2);
          
          handleHover(event as any, node);
        })
        .on('mouseout', function() {
          d3.select(this)
            .attr('stroke', '#fff')
            .attr('stroke-width', 1);
          
          handleMouseLeave();
        })
        .on('click', function(event) {
          handleClick(event as any, node);
        });

      // Add symbol text
      cell.append('text')
        .attr('x', position.width / 2)
        .attr('y', position.height / 2 - 8)
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'middle')
        .attr('font-size', Math.min(12, position.width / 6))
        .attr('font-weight', 'bold')
        .attr('fill', ColorUtils.getContrastingTextColor(colorScale(node.color)))
        .text(node.symbol)
        .style('pointer-events', 'none');

      // Add percentage text
      cell.append('text')
        .attr('x', position.width / 2)
        .attr('y', position.height / 2 + 8)
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'middle')
        .attr('font-size', Math.min(10, position.width / 8))
        .attr('fill', ColorUtils.getContrastingTextColor(colorScale(node.color)))
        .text(`${node.color > 0 ? '+' : ''}${node.color.toFixed(1)}%`)
        .style('pointer-events', 'none');
    });
  };

  // Show tooltip
  const showTooltip = (event: MouseEvent, node: HeatMapNode) => {
    if (!tooltipRef.current) return;

    const tooltip = tooltipRef.current;
    tooltip.style.display = 'block';
    tooltip.style.left = `${event.pageX + 10}px`;
    tooltip.style.top = `${event.pageY - 10}px`;

    tooltip.innerHTML = `
      <div class="font-bold text-white mb-2">${node.name} (${node.symbol})</div>
      <div class="text-gray-200 text-sm space-y-1">
        <div>Market Cap: $${(node.size / 1e9).toFixed(2)}B</div>
        <div class="flex items-center">
          <span>24h Change: </span>
          <span class="ml-1 ${node.color >= 0 ? 'text-green-400' : 'text-red-400'}">
            ${node.color > 0 ? '+' : ''}${node.color.toFixed(2)}%
          </span>
        </div>
        ${node.category ? `<div>Category: ${node.category}</div>` : ''}
      </div>
    `;
  };

  // Hide tooltip
  const hideTooltip = () => {
    if (tooltipRef.current) {
      tooltipRef.current.style.display = 'none';
    }
  };

  // Effect to redraw when data or view mode changes
  useEffect(() => {
    if (viewMode === 'treemap') {
      drawTreeMap();
    } else {
      drawGridHeatMap();
    }
  }, [filteredNodes, viewMode, dimensions, colorScale]);

  // Set container ref for interactions
  useEffect(() => {
    if (containerRef.current) {
      setContainerRef(containerRef.current);
    }
  }, [setContainerRef]);

  // Format numbers for display
  const formatNumber = (value: number, type: 'currency' | 'percentage' | 'number' = 'number'): string => {
    switch (type) {
      case 'currency':
        if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
        if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
        if (value >= 1e3) return `$${(value / 1e3).toFixed(2)}K`;
        return `$${value.toFixed(2)}`;
      case 'percentage':
        return `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;
      default:
        return value.toLocaleString();
    }
  };

  // Loading state
  if (isLoading && filteredNodes.length === 0) {
    return (
      <div className={`market-heatmap ${className}`}>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto text-blue-600 mb-4" />
            <p className="text-gray-600 dark:text-gray-400">Loading market heat map...</p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={`market-heatmap ${className}`}>
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-center">
            <AlertTriangle className="w-5 h-5 text-red-600 mr-2" />
            <div>
              <h3 className="font-medium text-red-800 dark:text-red-200">Error loading heat map</h3>
              <p className="text-sm text-red-600 dark:text-red-300 mt-1">{error}</p>
            </div>
          </div>
          <button
            onClick={refresh}
            className="mt-3 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`market-heatmap ${className}`} ref={containerRef}>
      {showControls && (
        <div className="mb-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            {/* View Mode Controls */}
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">View:</span>
              <div className="flex rounded-lg bg-gray-100 dark:bg-gray-800 p-1">
                <button
                  onClick={() => setViewMode('treemap')}
                  className={`flex items-center space-x-1 px-3 py-1 rounded-md text-sm transition-colors ${
                    viewMode === 'treemap'
                      ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  <Map className="w-4 h-4" />
                  <span>Treemap</span>
                </button>
                <button
                  onClick={() => setViewMode('grid')}
                  className={`flex items-center space-x-1 px-3 py-1 rounded-md text-sm transition-colors ${
                    viewMode === 'grid'
                      ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  <Grid className="w-4 h-4" />
                  <span>Grid</span>
                </button>
              </div>
            </div>

            {/* Zoom Controls */}
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Zoom: {Math.round(zoomLevel * 100)}%
              </span>
              <div className="flex items-center space-x-1">
                <button
                  onClick={zoomOut}
                  className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  title="Zoom Out"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <button
                  onClick={resetZoom}
                  className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  title="Reset Zoom"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
                <button
                  onClick={zoomIn}
                  className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  title="Zoom In"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Market Stats */}
            <div className="flex items-center space-x-4 text-sm">
              <div className="flex items-center space-x-1">
                <TrendingUp className="w-4 h-4 text-green-600" />
                <span className="text-gray-600 dark:text-gray-400">
                  {stats.positiveCount} positive
                </span>
              </div>
              <div className="flex items-center space-x-1">
                <TrendingDown className="w-4 h-4 text-red-600" />
                <span className="text-gray-600 dark:text-gray-400">
                  {stats.negativeCount} negative
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Heat Map Container */}
      <div className="relative bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <svg
          ref={svgRef}
          width={dimensions.width}
          height={dimensions.height}
          className="block"
        />

        {/* Tooltip */}
        <div
          ref={tooltipRef}
          className="absolute pointer-events-none bg-gray-900 text-white px-3 py-2 rounded-lg shadow-lg z-10 max-w-xs"
          style={{ display: 'none' }}
        />

        {/* Legend */}
        <div className="absolute bottom-4 left-4 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-3 border border-gray-200 dark:border-gray-700">
          <div className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
            24h Change (%)
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-xs text-red-600">-10%</span>
            <div className="w-16 h-3 bg-gradient-to-r from-red-500 via-yellow-400 to-green-500 rounded"></div>
            <span className="text-xs text-green-600">+10%</span>
          </div>
        </div>
      </div>

      {/* Selected Asset Details */}
      {selectedAsset && (
        <div className="mt-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {selectedAsset.name} ({selectedAsset.symbol})
            </h3>
            <button
              onClick={() => setSelectedAsset(null)}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              ×
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <div className="text-gray-500 dark:text-gray-400">Market Cap</div>
              <div className="font-medium">{formatNumber(selectedAsset.size, 'currency')}</div>
            </div>
            <div>
              <div className="text-gray-500 dark:text-gray-400">24h Change</div>
              <div className={`font-medium ${selectedAsset.color >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatNumber(selectedAsset.color, 'percentage')}
              </div>
            </div>
            <div>
              <div className="text-gray-500 dark:text-gray-400">Category</div>
              <div className="font-medium capitalize">{selectedAsset.category || 'N/A'}</div>
            </div>
            <div>
              <div className="text-gray-500 dark:text-gray-400">Rank</div>
              <div className="font-medium">#{filteredNodes.findIndex(n => n.id === selectedAsset.id) + 1}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MarketHeatMap;