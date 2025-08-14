import React, { useRef, useEffect, useState, useMemo } from 'react';
import * as d3 from 'd3';
import {
  PieChart,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Building2,
  Target,
  RefreshCw,
  AlertTriangle
} from 'lucide-react';
import { useHeatMapData } from '../../hooks/useHeatMapData';
import { useHeatMapInteraction } from '../../hooks/useHeatMapInteraction';
import { ColorUtils } from '../../utils/colorScales';
import { HeatMapCalculations, HeatMapNode } from '../../utils/heatMapCalculations';
import { PortfolioHolding } from '../../services/HeatMapDataService';

interface PortfolioHeatMapProps {
  portfolioId: string;
  width?: number;
  height?: number;
  colorMetric?: 'profitPercentage' | 'change24h' | 'allocation';
  sizeMetric?: 'value' | 'profit' | 'allocation';
  groupBy?: 'category' | 'exchange' | 'none';
  showControls?: boolean;
  className?: string;
}

const PortfolioHeatMap: React.FC<PortfolioHeatMapProps> = ({
  portfolioId,
  width = 800,
  height = 600,
  colorMetric = 'profitPercentage',
  sizeMetric = 'value',
  groupBy = 'category',
  showControls = true,
  className = ''
}) => {
  // Refs
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  // State
  const [dimensions, setDimensions] = useState({ width, height });
  const [selectedHolding, setSelectedHolding] = useState<PortfolioHolding | null>(null);
  const [portfolioData, setPortfolioData] = useState<PortfolioHolding[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load portfolio data
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        // In a real app, this would fetch from the API
        const mockPortfolioData: PortfolioHolding[] = [
          {
            symbol: 'BTC',
            name: 'Bitcoin',
            value: 25000,
            allocation: 45,
            change24h: 2.5,
            profit: 5000,
            profitPercentage: 25,
            exchange: 'Coinbase',
            category: 'layer-1',
            quantity: 0.5,
            avgPrice: 40000
          },
          {
            symbol: 'ETH',
            name: 'Ethereum',
            value: 15000,
            allocation: 27,
            change24h: -1.2,
            profit: 3000,
            profitPercentage: 25,
            exchange: 'Binance',
            category: 'smart-contracts',
            quantity: 5,
            avgPrice: 2400
          },
          {
            symbol: 'ADA',
            name: 'Cardano',
            value: 8000,
            allocation: 14.5,
            change24h: 5.8,
            profit: 1500,
            profitPercentage: 23.1,
            exchange: 'Kraken',
            category: 'smart-contracts',
            quantity: 5333,
            avgPrice: 1.2
          },
          {
            symbol: 'DOT',
            name: 'Polkadot',
            value: 4500,
            allocation: 8.1,
            change24h: -3.2,
            profit: 500,
            profitPercentage: 12.5,
            exchange: 'Coinbase',
            category: 'interoperability',
            quantity: 180,
            avgPrice: 22.22
          },
          {
            symbol: 'LINK',
            name: 'Chainlink',
            value: 3000,
            allocation: 5.4,
            change24h: 1.8,
            profit: -200,
            profitPercentage: -6.25,
            exchange: 'Binance',
            category: 'oracles',
            quantity: 150,
            avgPrice: 21.33
          }
        ];

        setPortfolioData(mockPortfolioData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load portfolio data');
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [portfolioId]);

  // Interaction hooks
  const {
    hoveredNode,
    selectedNode,
    handleHover,
    handleMouseLeave,
    handleClick
  } = useHeatMapInteraction({
    enableZoom: false,
    enableSelection: true,
    onNodeClick: (node) => {
      const holding = portfolioData.find(h => h.symbol === node.symbol);
      setSelectedHolding(holding || null);
    }
  });

  // Process portfolio data into heat map nodes
  const processedNodes = useMemo(() => {
    return HeatMapCalculations.portfolioDataToNodes(
      portfolioData,
      sizeMetric,
      colorMetric
    );
  }, [portfolioData, sizeMetric, colorMetric]);

  // Create hierarchical data if grouping is enabled
  const hierarchicalData = useMemo(() => {
    if (groupBy === 'none') {
      return { name: 'portfolio', children: processedNodes };
    }
    return HeatMapCalculations.createHierarchicalData(processedNodes, groupBy);
  }, [processedNodes, groupBy]);

  // Color scale
  const colorScale = useMemo(() => {
    if (processedNodes.length === 0) return null;

    const values = processedNodes.map(node => node.color);
    const extent = d3.extent(values) as [number, number];
    
    if (colorMetric === 'profitPercentage' || colorMetric === 'change24h') {
      // Diverging scale for performance metrics
      return d3.scaleSequential()
        .domain(extent)
        .interpolator(d3.interpolateRdYlGn);
    } else {
      // Sequential scale for allocation
      return d3.scaleSequential()
        .domain(extent)
        .interpolator(d3.interpolateBlues);
    }
  }, [processedNodes, colorMetric]);

  // Calculate portfolio metrics
  const portfolioMetrics = useMemo(() => {
    if (portfolioData.length === 0) return null;
    
    return HeatMapCalculations.calculatePortfolioMetrics(portfolioData);
  }, [portfolioData]);

  // Draw portfolio treemap
  const drawPortfolioTreeMap = () => {
    if (!svgRef.current || !colorScale || !processedNodes.length) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const margin = { top: 30, right: 20, bottom: 20, left: 20 };
    const innerWidth = dimensions.width - margin.left - margin.right;
    const innerHeight = dimensions.height - margin.top - margin.bottom;

    // Create hierarchy
    const root = d3.hierarchy(hierarchicalData)
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

    // Add title
    svg.append('text')
      .attr('x', dimensions.width / 2)
      .attr('y', 20)
      .attr('text-anchor', 'middle')
      .attr('font-size', '16px')
      .attr('font-weight', 'bold')
      .attr('fill', 'currentColor')
      .text('Portfolio Allocation Heat Map');

    // Create cells
    const cell = g.selectAll('.portfolio-cell')
      .data(root.leaves())
      .enter()
      .append('g')
      .attr('class', 'portfolio-cell')
      .attr('transform', d => `translate(${d.x0}, ${d.y0})`);

    // Add rectangles
    cell.append('rect')
      .attr('width', d => Math.max(0, (d.x1 || 0) - (d.x0 || 0)))
      .attr('height', d => Math.max(0, (d.y1 || 0) - (d.y0 || 0)))
      .attr('fill', d => colorScale(d.data.color))
      .attr('stroke', '#fff')
      .attr('stroke-width', 2)
      .style('cursor', 'pointer')
      .on('mouseover', function(event, d) {
        d3.select(this)
          .attr('stroke', '#333')
          .attr('stroke-width', 3);
        
        showTooltip(event, d.data);
        handleHover(event as any, d.data);
      })
      .on('mouseout', function() {
        d3.select(this)
          .attr('stroke', '#fff')
          .attr('stroke-width', 2);
        
        hideTooltip();
        handleMouseLeave();
      })
      .on('click', function(event, d) {
        handleClick(event as any, d.data);
      });

    // Add symbol labels
    cell.append('text')
      .attr('x', d => ((d.x1 || 0) - (d.x0 || 0)) / 2)
      .attr('y', d => ((d.y1 || 0) - (d.y0 || 0)) / 2 - 15)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('font-size', d => {
        const area = ((d.x1 || 0) - (d.x0 || 0)) * ((d.y1 || 0) - (d.y0 || 0));
        return Math.min(16, Math.max(10, Math.sqrt(area) / 8));
      })
      .attr('font-weight', 'bold')
      .attr('fill', d => ColorUtils.getContrastingTextColor(colorScale(d.data.color)))
      .text(d => d.data.symbol)
      .style('pointer-events', 'none');

    // Add allocation labels
    cell.append('text')
      .attr('x', d => ((d.x1 || 0) - (d.x0 || 0)) / 2)
      .attr('y', d => ((d.y1 || 0) - (d.y0 || 0)) / 2)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('font-size', d => {
        const area = ((d.x1 || 0) - (d.x0 || 0)) * ((d.y1 || 0) - (d.y0 || 0));
        return Math.min(12, Math.max(8, Math.sqrt(area) / 10));
      })
      .attr('fill', d => {
        const textColor = ColorUtils.getContrastingTextColor(colorScale(d.data.color));
        return d3.color(textColor)?.opacity(0.8)?.toString() || textColor;
      })
      .text(d => {
        const holding = portfolioData.find(h => h.symbol === d.data.symbol);
        return holding ? `${holding.allocation.toFixed(1)}%` : '';
      })
      .style('pointer-events', 'none');

    // Add value labels
    cell.append('text')
      .attr('x', d => ((d.x1 || 0) - (d.x0 || 0)) / 2)
      .attr('y', d => ((d.y1 || 0) - (d.y0 || 0)) / 2 + 15)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('font-size', d => {
        const area = ((d.x1 || 0) - (d.x0 || 0)) * ((d.y1 || 0) - (d.y0 || 0));
        return Math.min(10, Math.max(6, Math.sqrt(area) / 12));
      })
      .attr('fill', d => {
        const textColor = ColorUtils.getContrastingTextColor(colorScale(d.data.color));
        return d3.color(textColor)?.opacity(0.7)?.toString() || textColor;
      })
      .text(d => formatCurrency(d.data.size))
      .style('pointer-events', 'none');
  };

  // Show tooltip
  const showTooltip = (event: any, node: HeatMapNode) => {
    if (!tooltipRef.current) return;

    const holding = portfolioData.find(h => h.symbol === node.symbol);
    if (!holding) return;

    const tooltip = tooltipRef.current;
    tooltip.style.display = 'block';
    tooltip.style.left = `${event.pageX + 10}px`;
    tooltip.style.top = `${event.pageY - 10}px`;

    tooltip.innerHTML = `
      <div class="font-bold text-white mb-2">${holding.name} (${holding.symbol})</div>
      <div class="text-gray-200 text-sm space-y-1">
        <div>Value: ${formatCurrency(holding.value)}</div>
        <div>Allocation: ${holding.allocation.toFixed(1)}%</div>
        <div>Quantity: ${holding.quantity.toLocaleString()}</div>
        <div>Avg Price: ${formatCurrency(holding.avgPrice)}</div>
        <div class="flex items-center">
          <span>P&L: </span>
          <span class="ml-1 ${holding.profit >= 0 ? 'text-green-400' : 'text-red-400'}">
            ${formatCurrency(holding.profit)} (${holding.profitPercentage.toFixed(2)}%)
          </span>
        </div>
        <div class="flex items-center">
          <span>24h Change: </span>
          <span class="ml-1 ${holding.change24h >= 0 ? 'text-green-400' : 'text-red-400'}">
            ${holding.change24h > 0 ? '+' : ''}${holding.change24h.toFixed(2)}%
          </span>
        </div>
        ${holding.exchange ? `<div>Exchange: ${holding.exchange}</div>` : ''}
        ${holding.category ? `<div>Category: ${holding.category}</div>` : ''}
      </div>
    `;
  };

  // Hide tooltip
  const hideTooltip = () => {
    if (tooltipRef.current) {
      tooltipRef.current.style.display = 'none';
    }
  };

  // Format currency
  const formatCurrency = (value: number): string => {
    if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
    if (value >= 1e3) return `$${(value / 1e3).toFixed(1)}K`;
    return `$${value.toFixed(0)}`;
  };

  // Format percentage
  const formatPercentage = (value: number): string => {
    return `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;
  };

  // Redraw when data changes
  useEffect(() => {
    drawPortfolioTreeMap();
  }, [processedNodes, dimensions, colorScale, portfolioData]);

  // Handle responsive sizing
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

  // Loading state
  if (isLoading) {
    return (
      <div className={`portfolio-heatmap ${className}`}>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto text-blue-600 mb-4" />
            <p className="text-gray-600 dark:text-gray-400">Loading portfolio data...</p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={`portfolio-heatmap ${className}`}>
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-center">
            <AlertTriangle className="w-5 h-5 text-red-600 mr-2" />
            <div>
              <h3 className="font-medium text-red-800 dark:text-red-200">Error loading portfolio</h3>
              <p className="text-sm text-red-600 dark:text-red-300 mt-1">{error}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`portfolio-heatmap ${className}`} ref={containerRef}>
      {/* Portfolio Metrics */}
      {portfolioMetrics && (
        <div className="mb-6">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center space-x-2 mb-2">
                <DollarSign className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Value</span>
              </div>
              <div className="text-xl font-bold text-gray-900 dark:text-white">
                {formatCurrency(portfolioData.reduce((sum, h) => sum + h.value, 0))}
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center space-x-2 mb-2">
                <TrendingUp className="w-4 h-4 text-green-600" />
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Total P&L</span>
              </div>
              <div className={`text-xl font-bold ${portfolioMetrics.totalReturn >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatPercentage(portfolioMetrics.totalReturn)}
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center space-x-2 mb-2">
                <Target className="w-4 h-4 text-purple-600" />
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Sharpe Ratio</span>
              </div>
              <div className="text-xl font-bold text-gray-900 dark:text-white">
                {portfolioMetrics.sharpeRatio.toFixed(2)}
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center space-x-2 mb-2">
                <TrendingDown className="w-4 h-4 text-orange-600" />
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Max Drawdown</span>
              </div>
              <div className="text-xl font-bold text-red-600">
                -{portfolioMetrics.maxDrawdown.toFixed(2)}%
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center space-x-2 mb-2">
                <PieChart className="w-4 h-4 text-indigo-600" />
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Win Rate</span>
              </div>
              <div className="text-xl font-bold text-gray-900 dark:text-white">
                {portfolioMetrics.winRate.toFixed(1)}%
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
            {colorMetric === 'profitPercentage' ? 'P&L %' : 
             colorMetric === 'change24h' ? '24h Change %' : 'Allocation %'}
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-xs text-red-600">-10%</span>
            <div className="w-16 h-3 bg-gradient-to-r from-red-500 via-yellow-400 to-green-500 rounded"></div>
            <span className="text-xs text-green-600">+10%</span>
          </div>
        </div>
      </div>

      {/* Selected Holding Details */}
      {selectedHolding && (
        <div className="mt-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {selectedHolding.name} ({selectedHolding.symbol})
            </h3>
            <button
              onClick={() => setSelectedHolding(null)}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              ×
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <div className="text-gray-500 dark:text-gray-400">Current Value</div>
              <div className="font-medium">{formatCurrency(selectedHolding.value)}</div>
            </div>
            <div>
              <div className="text-gray-500 dark:text-gray-400">Allocation</div>
              <div className="font-medium">{selectedHolding.allocation.toFixed(1)}%</div>
            </div>
            <div>
              <div className="text-gray-500 dark:text-gray-400">Quantity</div>
              <div className="font-medium">{selectedHolding.quantity.toLocaleString()}</div>
            </div>
            <div>
              <div className="text-gray-500 dark:text-gray-400">Avg Price</div>
              <div className="font-medium">{formatCurrency(selectedHolding.avgPrice)}</div>
            </div>
            <div>
              <div className="text-gray-500 dark:text-gray-400">P&L</div>
              <div className={`font-medium ${selectedHolding.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(selectedHolding.profit)} ({formatPercentage(selectedHolding.profitPercentage)})
              </div>
            </div>
            <div>
              <div className="text-gray-500 dark:text-gray-400">24h Change</div>
              <div className={`font-medium ${selectedHolding.change24h >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatPercentage(selectedHolding.change24h)}
              </div>
            </div>
            <div>
              <div className="text-gray-500 dark:text-gray-400">Exchange</div>
              <div className="font-medium">{selectedHolding.exchange || 'N/A'}</div>
            </div>
            <div>
              <div className="text-gray-500 dark:text-gray-400">Category</div>
              <div className="font-medium capitalize">{selectedHolding.category || 'N/A'}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PortfolioHeatMap;