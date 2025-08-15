import React, { useRef, useEffect, useState, useMemo } from 'react';
import * as d3 from 'd3';
import {
  Grid,
  TrendingUp,
  TrendingDown,
  Target,
  RefreshCw,
  AlertTriangle,
  BarChart3
} from 'lucide-react';
import { useHeatMapData } from '../../hooks/useHeatMapData';
import { ColorUtils } from '../../utils/colorScales';
import { HeatMapCalculations } from '../../utils/heatMapCalculations';
import { CorrelationMatrix } from '../../services/HeatMapDataService';

interface CorrelationHeatMapProps {
  assets?: string[];
  timeframe?: string;
  width?: number;
  height?: number;
  showLabels?: boolean;
  className?: string;
}

const CorrelationHeatMap: React.FC<CorrelationHeatMapProps> = ({
  assets = [],
  timeframe = '30d',
  width = 600,
  height = 600,
  showLabels = true,
  className = ''
}) => {
  // Refs
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  // State
  const [dimensions, setDimensions] = useState({ width, height });
  const [correlationMatrix, setCorrelationMatrix] = useState<CorrelationMatrix>({});
  const [selectedPair, setSelectedPair] = useState<{ asset1: string; asset2: string; correlation: number } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Get market data for correlation calculation
  const { marketData, loadCorrelationMatrix } = useHeatMapData();

  // Load correlation data
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Use provided assets or top market cap assets
        const assetsToUse = assets.length > 0 ? assets : ['BTC', 'ETH', 'ADA', 'DOT', 'LINK', 'SOL', 'MATIC', 'AVAX'];
        
        // Generate mock correlation matrix
        const matrix: CorrelationMatrix = {};
        assetsToUse.forEach(asset1 => {
          matrix[asset1] = {};
          assetsToUse.forEach(asset2 => {
            if (asset1 === asset2) {
              matrix[asset1][asset2] = 1.0;
            } else {
              // Generate realistic correlations
              let correlation = 0;
              
              // Major assets tend to be more correlated
              if ((asset1 === 'BTC' && asset2 === 'ETH') || (asset1 === 'ETH' && asset2 === 'BTC')) {
                correlation = 0.65 + Math.random() * 0.2; // 0.65-0.85
              } else if (
                ['BTC', 'ETH'].includes(asset1) && ['BTC', 'ETH'].includes(asset2)
              ) {
                correlation = 0.5 + Math.random() * 0.3; // 0.5-0.8
              } else if (
                ['ADA', 'DOT', 'LINK'].includes(asset1) && ['ADA', 'DOT', 'LINK'].includes(asset2)
              ) {
                correlation = 0.3 + Math.random() * 0.4; // 0.3-0.7
              } else {
                correlation = -0.2 + Math.random() * 0.6; // -0.2-0.4
              }

              // Add some randomness and ensure symmetry
              const normalizedCorr = Math.max(-1, Math.min(1, correlation));
              matrix[asset1][asset2] = normalizedCorr;
              if (matrix[asset2]) {
                matrix[asset2][asset1] = normalizedCorr;
              }
            }
          });
        });

        setCorrelationMatrix(matrix);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load correlation data');
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [assets, timeframe]);

  // Get asset list from correlation matrix
  const assetList = useMemo(() => {
    return Object.keys(correlationMatrix).sort();
  }, [correlationMatrix]);

  // Color scale for correlations
  const colorScale = useMemo(() => {
    return d3.scaleSequential()
      .domain([-1, 1])
      .interpolator(d3.interpolateRdBu);
  }, []);

  // Calculate correlation statistics
  const correlationStats = useMemo(() => {
    if (!assetList.length) return null;
    return HeatMapCalculations.calculateCorrelationStats(correlationMatrix);
  }, [correlationMatrix, assetList]);

  // Draw correlation matrix
  const drawCorrelationMatrix = () => {
    if (!svgRef.current || !assetList.length) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const margin = { top: 60, right: 60, bottom: 60, left: 60 };
    const innerWidth = dimensions.width - margin.left - margin.right;
    const innerHeight = dimensions.height - margin.top - margin.bottom;

    const cellSize = Math.min(innerWidth, innerHeight) / assetList.length;

    const g = svg.append('g')
      .attr('transform', `translate(${margin.left}, ${margin.top})`);

    // Add title
    svg.append('text')
      .attr('x', dimensions.width / 2)
      .attr('y', 30)
      .attr('text-anchor', 'middle')
      .attr('font-size', '16px')
      .attr('font-weight', 'bold')
      .attr('fill', 'currentColor')
      .text(`Asset Correlation Matrix (${timeframe})`);

    // Create cells
    assetList.forEach((asset1, i) => {
      assetList.forEach((asset2, j) => {
        const correlation = correlationMatrix[asset1]?.[asset2] || 0;
        
        const cell = g.append('g')
          .attr('class', 'correlation-cell')
          .attr('transform', `translate(${j * cellSize}, ${i * cellSize})`);

        // Cell background
        cell.append('rect')
          .attr('width', cellSize - 1)
          .attr('height', cellSize - 1)
          .attr('fill', colorScale(correlation))
          .attr('stroke', '#fff')
          .attr('stroke-width', 1)
          .style('cursor', 'pointer')
          .on('mouseover', function(event) {
            d3.select(this)
              .attr('stroke', '#333')
              .attr('stroke-width', 2);
            
            showTooltip(event, asset1, asset2, correlation);
          })
          .on('mouseout', function() {
            d3.select(this)
              .attr('stroke', '#fff')
              .attr('stroke-width', 1);
            
            hideTooltip();
          })
          .on('click', function() {
            setSelectedPair({ asset1, asset2, correlation });
          });

        // Cell text
        if (showLabels && cellSize > 30) {
          cell.append('text')
            .attr('x', cellSize / 2)
            .attr('y', cellSize / 2)
            .attr('text-anchor', 'middle')
            .attr('dominant-baseline', 'middle')
            .attr('font-size', Math.min(10, cellSize / 4))
            .attr('font-weight', 'bold')
            .attr('fill', ColorUtils.getContrastingTextColor(colorScale(correlation)))
            .text(correlation.toFixed(2))
            .style('pointer-events', 'none');
        }
      });
    });

    // Add row labels
    assetList.forEach((asset, i) => {
      g.append('text')
        .attr('x', -10)
        .attr('y', i * cellSize + cellSize / 2)
        .attr('text-anchor', 'end')
        .attr('dominant-baseline', 'middle')
        .attr('font-size', Math.min(12, cellSize / 3))
        .attr('font-weight', 'bold')
        .attr('fill', 'currentColor')
        .text(asset);
    });

    // Add column labels
    assetList.forEach((asset, j) => {
      g.append('text')
        .attr('x', j * cellSize + cellSize / 2)
        .attr('y', -10)
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'middle')
        .attr('font-size', Math.min(12, cellSize / 3))
        .attr('font-weight', 'bold')
        .attr('fill', 'currentColor')
        .text(asset);
    });

    // Add color scale legend
    const legendWidth = 200;
    const legendHeight = 10;
    const legendX = (dimensions.width - legendWidth) / 2;
    const legendY = dimensions.height - 30;

    const legendScale = d3.scaleLinear()
      .domain([-1, 1])
      .range([0, legendWidth]);

    const legendAxis = d3.axisBottom(legendScale)
      .ticks(5)
      .tickFormat(d => d.toFixed(1));

    // Legend gradient
    const defs = svg.append('defs');
    const gradient = defs.append('linearGradient')
      .attr('id', 'correlation-gradient')
      .attr('gradientUnits', 'userSpaceOnUse')
      .attr('x1', 0).attr('y1', 0)
      .attr('x2', legendWidth).attr('y2', 0);

    const numStops = 20;
    for (let i = 0; i <= numStops; i++) {
      const t = i / numStops;
      const value = -1 + t * 2;
      gradient.append('stop')
        .attr('offset', `${t * 100}%`)
        .attr('stop-color', colorScale(value));
    }

    const legendG = svg.append('g')
      .attr('transform', `translate(${legendX}, ${legendY})`);

    legendG.append('rect')
      .attr('width', legendWidth)
      .attr('height', legendHeight)
      .attr('fill', 'url(#correlation-gradient)')
      .attr('stroke', '#ccc');

    legendG.append('g')
      .attr('transform', `translate(0, ${legendHeight})`)
      .call(legendAxis);

    legendG.append('text')
      .attr('x', legendWidth / 2)
      .attr('y', -5)
      .attr('text-anchor', 'middle')
      .attr('font-size', '12px')
      .attr('fill', 'currentColor')
      .text('Correlation Coefficient');
  };

  // Show tooltip
  const showTooltip = (event: any, asset1: string, asset2: string, correlation: number) => {
    if (!tooltipRef.current) return;

    const tooltip = tooltipRef.current;
    tooltip.style.display = 'block';
    tooltip.style.left = `${event.pageX + 10}px`;
    tooltip.style.top = `${event.pageY - 10}px`;

    const correlationStrength = Math.abs(correlation) > 0.7 ? 'Strong' :
                               Math.abs(correlation) > 0.4 ? 'Moderate' : 'Weak';
    const correlationDirection = correlation > 0 ? 'Positive' : 'Negative';

    tooltip.innerHTML = `
      <div class="font-bold text-white mb-2">${asset1} vs ${asset2}</div>
      <div class="text-gray-200 text-sm space-y-1">
        <div>Correlation: <span class="font-medium">${correlation.toFixed(3)}</span></div>
        <div>Strength: <span class="font-medium">${correlationStrength}</span></div>
        <div>Direction: <span class="font-medium">${correlationDirection}</span></div>
        <div class="text-xs text-gray-300 mt-2">
          ${Math.abs(correlation) > 0.7 ? 'Assets move together strongly' :
            Math.abs(correlation) > 0.4 ? 'Assets have moderate relationship' :
            'Assets have weak relationship'}
        </div>
      </div>
    `;
  };

  // Hide tooltip
  const hideTooltip = () => {
    if (tooltipRef.current) {
      tooltipRef.current.style.display = 'none';
    }
  };

  // Redraw when data changes
  useEffect(() => {
    drawCorrelationMatrix();
  }, [correlationMatrix, dimensions, assetList]);

  // Handle responsive sizing
  useEffect(() => {
    if (containerRef.current) {
      const resizeObserver = new ResizeObserver((entries) => {
        const entry = entries[0];
        if (entry) {
          const { width: containerWidth, height: containerHeight } = entry.contentRect;
          const size = Math.min(containerWidth || width, containerHeight || height);
          setDimensions({
            width: size,
            height: size
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
      <div className={`correlation-heatmap ${className}`}>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto text-blue-600 mb-4" />
            <p className="text-gray-600 dark:text-gray-400">Calculating correlations...</p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={`correlation-heatmap ${className}`}>
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-center">
            <AlertTriangle className="w-5 h-5 text-red-600 mr-2" />
            <div>
              <h3 className="font-medium text-red-800 dark:text-red-200">Error loading correlations</h3>
              <p className="text-sm text-red-600 dark:text-red-300 mt-1">{error}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`correlation-heatmap ${className}`} ref={containerRef}>
      {/* Correlation Statistics */}
      {correlationStats && (
        <div className="mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center space-x-2 mb-2">
                <BarChart3 className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Avg Correlation</span>
              </div>
              <div className="text-xl font-bold text-gray-900 dark:text-white">
                {correlationStats.avgCorrelation.toFixed(3)}
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center space-x-2 mb-2">
                <TrendingUp className="w-4 h-4 text-green-600" />
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Max Correlation</span>
              </div>
              <div className="text-xl font-bold text-green-600">
                {correlationStats.maxCorrelation.toFixed(3)}
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center space-x-2 mb-2">
                <TrendingDown className="w-4 h-4 text-red-600" />
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Min Correlation</span>
              </div>
              <div className="text-xl font-bold text-red-600">
                {correlationStats.minCorrelation.toFixed(3)}
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center space-x-2 mb-2">
                <Target className="w-4 h-4 text-purple-600" />
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Strong Pairs</span>
              </div>
              <div className="text-xl font-bold text-gray-900 dark:text-white">
                {correlationStats.strongCorrelations.length}
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
      </div>

      {/* Strong Correlations List */}
      {correlationStats && correlationStats.strongCorrelations.length > 0 && (
        <div className="mt-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
            Strong Correlations (|r| &gt; 0.7)
          </h3>
          <div className="space-y-2">
            {correlationStats.strongCorrelations.slice(0, 5).map((pair, index) => (
              <div key={index} className="flex items-center justify-between text-sm">
                <span className="text-gray-700 dark:text-gray-300">
                  {pair.asset1} - {pair.asset2}
                </span>
                <span className={`font-medium ${pair.correlation > 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {pair.correlation.toFixed(3)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Selected Pair Details */}
      {selectedPair && (
        <div className="mt-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {selectedPair.asset1} - {selectedPair.asset2} Correlation
            </h3>
            <button
              onClick={() => setSelectedPair(null)}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              ×
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            <div>
              <div className="text-gray-500 dark:text-gray-400">Correlation</div>
              <div className={`text-xl font-bold ${selectedPair.correlation > 0 ? 'text-green-600' : 'text-red-600'}`}>
                {selectedPair.correlation.toFixed(4)}
              </div>
            </div>
            <div>
              <div className="text-gray-500 dark:text-gray-400">Strength</div>
              <div className="font-medium">
                {Math.abs(selectedPair.correlation) > 0.7 ? 'Strong' :
                 Math.abs(selectedPair.correlation) > 0.4 ? 'Moderate' : 'Weak'}
              </div>
            </div>
            <div>
              <div className="text-gray-500 dark:text-gray-400">Direction</div>
              <div className="font-medium">
                {selectedPair.correlation > 0 ? 'Positive' : 'Negative'}
              </div>
            </div>
          </div>
          <div className="mt-3 text-sm text-gray-600 dark:text-gray-400">
            {Math.abs(selectedPair.correlation) > 0.7 ? 
              `${selectedPair.asset1} and ${selectedPair.asset2} tend to move together strongly.` :
              Math.abs(selectedPair.correlation) > 0.4 ?
              `${selectedPair.asset1} and ${selectedPair.asset2} have a moderate relationship.` :
              `${selectedPair.asset1} and ${selectedPair.asset2} have a weak relationship.`
            }
          </div>
        </div>
      )}
    </div>
  );
};

export default CorrelationHeatMap;