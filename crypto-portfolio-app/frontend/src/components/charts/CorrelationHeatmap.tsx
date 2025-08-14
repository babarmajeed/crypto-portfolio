import React, { useRef, useEffect, useState } from 'react';

interface CorrelationHeatmapProps {
  correlationMatrix: Record<string, Record<string, number>>;
  assets: string[];
  width?: number;
  height?: number;
  onCellClick?: (asset1: string, asset2: string, correlation: number) => void;
  className?: string;
}

const CorrelationHeatmap: React.FC<CorrelationHeatmapProps> = ({
  correlationMatrix,
  assets,
  width = 400,
  height = 400,
  onCellClick,
  className = ''
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [hoveredCell, setHoveredCell] = useState<{
    asset1: string;
    asset2: string;
    correlation: number;
    x: number;
    y: number;
  } | null>(null);

  // Color scale function
  const getColor = (correlation: number): string => {
    // Use a blue-white-red color scale
    const absCorr = Math.abs(correlation);
    
    if (correlation > 0) {
      // Positive correlation: white to blue
      const intensity = Math.floor(255 * (1 - absCorr));
      return `rgb(${intensity}, ${intensity}, 255)`;
    } else {
      // Negative correlation: white to red
      const intensity = Math.floor(255 * (1 - absCorr));
      return `rgb(255, ${intensity}, ${intensity})`;
    }
  };

  // Get text color based on background
  const getTextColor = (correlation: number): string => {
    return Math.abs(correlation) > 0.6 ? '#ffffff' : '#000000';
  };

  // Draw heatmap
  const drawHeatmap = () => {
    const canvas = canvasRef.current;
    if (!canvas || assets.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    canvas.width = width;
    canvas.height = height;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    const margin = { top: 60, right: 20, bottom: 20, left: 60 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    
    const cellWidth = innerWidth / assets.length;
    const cellHeight = innerHeight / assets.length;

    // Set font for labels
    ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Draw column labels
    ctx.fillStyle = '#374151';
    assets.forEach((asset, i) => {
      const x = margin.left + (i + 0.5) * cellWidth;
      const y = margin.top - 10;
      ctx.fillText(asset, x, y);
    });

    // Draw row labels
    ctx.textAlign = 'right';
    assets.forEach((asset, i) => {
      const x = margin.left - 10;
      const y = margin.top + (i + 0.5) * cellHeight;
      ctx.fillText(asset, x, y);
    });

    // Draw correlation cells
    ctx.textAlign = 'center';
    assets.forEach((asset1, i) => {
      assets.forEach((asset2, j) => {
        const correlation = correlationMatrix[asset1]?.[asset2] ?? 0;
        
        const x = margin.left + j * cellWidth;
        const y = margin.top + i * cellHeight;

        // Draw cell background
        ctx.fillStyle = getColor(correlation);
        ctx.fillRect(x, y, cellWidth, cellHeight);

        // Draw cell border
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, cellWidth, cellHeight);

        // Draw correlation value
        ctx.fillStyle = getTextColor(correlation);
        ctx.font = '10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillText(
          correlation.toFixed(2),
          x + cellWidth / 2,
          y + cellHeight / 2
        );
      });
    });

    // Draw color legend
    drawColorLegend(ctx, margin, width, height);
  };

  // Draw color legend
  const drawColorLegend = (
    ctx: CanvasRenderingContext2D,
    margin: { top: number; right: number; bottom: number; left: number },
    canvasWidth: number,
    canvasHeight: number
  ) => {
    const legendWidth = 200;
    const legendHeight = 15;
    const legendX = canvasWidth - legendWidth - 20;
    const legendY = canvasHeight - legendHeight - 30;

    // Draw legend gradient
    const gradient = ctx.createLinearGradient(legendX, 0, legendX + legendWidth, 0);
    gradient.addColorStop(0, 'rgb(255, 100, 100)');
    gradient.addColorStop(0.5, 'rgb(255, 255, 255)');
    gradient.addColorStop(1, 'rgb(100, 100, 255)');

    ctx.fillStyle = gradient;
    ctx.fillRect(legendX, legendY, legendWidth, legendHeight);

    // Draw legend border
    ctx.strokeStyle = '#cccccc';
    ctx.lineWidth = 1;
    ctx.strokeRect(legendX, legendY, legendWidth, legendHeight);

    // Draw legend labels
    ctx.fillStyle = '#374151';
    ctx.font = '10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';
    
    // -1 label
    ctx.fillText('-1', legendX, legendY + legendHeight + 15);
    
    // 0 label
    ctx.fillText('0', legendX + legendWidth / 2, legendY + legendHeight + 15);
    
    // +1 label
    ctx.fillText('+1', legendX + legendWidth, legendY + legendHeight + 15);

    // Legend title
    ctx.textAlign = 'left';
    ctx.fillText('Correlation', legendX, legendY - 10);
  };

  // Handle mouse events
  const handleMouseMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || assets.length === 0) return;

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const margin = { top: 60, right: 20, bottom: 20, left: 60 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    
    const cellWidth = innerWidth / assets.length;
    const cellHeight = innerHeight / assets.length;

    // Check if mouse is over a cell
    if (x >= margin.left && x < margin.left + innerWidth &&
        y >= margin.top && y < margin.top + innerHeight) {
      
      const col = Math.floor((x - margin.left) / cellWidth);
      const row = Math.floor((y - margin.top) / cellHeight);
      
      if (col >= 0 && col < assets.length && row >= 0 && row < assets.length) {
        const asset1 = assets[row];
        const asset2 = assets[col];
        const correlation = correlationMatrix[asset1]?.[asset2] ?? 0;
        
        setHoveredCell({
          asset1,
          asset2,
          correlation,
          x: event.clientX,
          y: event.clientY
        });
        return;
      }
    }

    setHoveredCell(null);
  };

  const handleMouseLeave = () => {
    setHoveredCell(null);
  };

  const handleClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!onCellClick || !hoveredCell) return;
    
    onCellClick(hoveredCell.asset1, hoveredCell.asset2, hoveredCell.correlation);
  };

  // Redraw when data changes
  useEffect(() => {
    drawHeatmap();
  }, [correlationMatrix, assets, width, height]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      drawHeatmap();
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (assets.length === 0) {
    return (
      <div className={`flex items-center justify-center ${className}`} style={{ width, height }}>
        <p className="text-gray-500 dark:text-gray-400 text-sm">
          No assets selected for correlation analysis
        </p>
      </div>
    );
  }

  return (
    <div className={`correlation-heatmap relative ${className}`}>
      <div className="mb-2">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
          Asset Correlation Matrix
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Correlation coefficients between selected assets
        </p>
      </div>
      
      <div className="relative">
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          onClick={handleClick}
          className="border border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer"
          style={{ maxWidth: '100%', height: 'auto' }}
        />

        {/* Tooltip */}
        {hoveredCell && (
          <div
            className="fixed bg-gray-900 text-white text-xs rounded-lg px-3 py-2 pointer-events-none z-50 shadow-lg"
            style={{
              left: hoveredCell.x + 10,
              top: hoveredCell.y - 10,
              transform: 'translateY(-100%)'
            }}
          >
            <div className="font-semibold">
              {hoveredCell.asset1} × {hoveredCell.asset2}
            </div>
            <div className="text-gray-300">
              Correlation: {hoveredCell.correlation.toFixed(3)}
            </div>
            <div className="text-gray-400 text-xs">
              {Math.abs(hoveredCell.correlation) > 0.7 ? 'Strong' :
               Math.abs(hoveredCell.correlation) > 0.3 ? 'Moderate' : 'Weak'} 
              {hoveredCell.correlation > 0.1 ? ' positive' : 
               hoveredCell.correlation < -0.1 ? ' negative' : ' neutral'}
            </div>
          </div>
        )}
      </div>

      {/* Interpretation Guide */}
      <div className="mt-3 text-xs text-gray-500 dark:text-gray-400">
        <div className="grid grid-cols-3 gap-2">
          <div className="flex items-center space-x-1">
            <div className="w-3 h-3 bg-blue-200 rounded"></div>
            <span>Positive</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-3 h-3 bg-white border rounded"></div>
            <span>Neutral</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-3 h-3 bg-red-200 rounded"></div>
            <span>Negative</span>
          </div>
        </div>
        <div className="mt-1 text-xs">
          <strong>|ρ| &gt; 0.7:</strong> Strong, 
          <strong> 0.3-0.7:</strong> Moderate, 
          <strong> &lt; 0.3:</strong> Weak
        </div>
      </div>
    </div>
  );
};

export default CorrelationHeatmap;