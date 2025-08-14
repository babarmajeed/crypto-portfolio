import React, { useRef, useEffect, useCallback } from 'react';

interface PricePoint {
  timestamp: number;
  price: number;
}

interface AssetSparklineProps {
  data: PricePoint[];
  width?: number;
  height?: number;
  color?: string;
  showTooltip?: boolean;
  className?: string;
}

const AssetSparkline: React.FC<AssetSparklineProps> = ({
  data,
  width = 120,
  height = 40,
  color = '#3b82f6',
  showTooltip = false,
  className = ''
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const drawSparkline = useCallback(() => {
    if (!data || data.length === 0 || !svgRef.current) return;

    const svg = svgRef.current;
    
    // Clear previous content
    while (svg.firstChild) {
      svg.removeChild(svg.firstChild);
    }

    const margin = { top: 5, right: 5, bottom: 5, left: 5 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // Find min and max values
    const prices = data.map(d => d.price);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const priceRange = maxPrice - minPrice;

    // Create scales
    const xScale = (index: number) => (index / (data.length - 1)) * innerWidth;
    const yScale = (price: number) => {
      if (priceRange === 0) return innerHeight / 2;
      return innerHeight - ((price - minPrice) / priceRange) * innerHeight;
    };

    // Create gradient
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    const gradientId = `sparkline-gradient-${Math.random().toString(36).substr(2, 9)}`;
    const gradient = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
    
    gradient.setAttribute('id', gradientId);
    gradient.setAttribute('x1', '0%');
    gradient.setAttribute('y1', '0%');
    gradient.setAttribute('x2', '0%');
    gradient.setAttribute('y2', '100%');

    const stop1 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
    stop1.setAttribute('offset', '0%');
    stop1.setAttribute('stop-color', color);
    stop1.setAttribute('stop-opacity', '0.3');

    const stop2 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
    stop2.setAttribute('offset', '100%');
    stop2.setAttribute('stop-color', color);
    stop2.setAttribute('stop-opacity', '0');

    gradient.appendChild(stop1);
    gradient.appendChild(stop2);
    defs.appendChild(gradient);
    svg.appendChild(defs);

    // Create container group
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('transform', `translate(${margin.left}, ${margin.top})`);

    // Create path data
    let pathData = '';
    let areaData = '';

    data.forEach((point, index) => {
      const x = xScale(index);
      const y = yScale(point.price);
      
      if (index === 0) {
        pathData += `M ${x} ${y}`;
        areaData += `M ${x} ${innerHeight} L ${x} ${y}`;
      } else {
        pathData += ` L ${x} ${y}`;
        areaData += ` L ${x} ${y}`;
      }
    });

    // Close the area path
    const lastX = xScale(data.length - 1);
    areaData += ` L ${lastX} ${innerHeight} Z`;

    // Create area path
    const areaPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    areaPath.setAttribute('d', areaData);
    areaPath.setAttribute('fill', `url(#${gradientId})`);
    g.appendChild(areaPath);

    // Create line path
    const linePath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    linePath.setAttribute('d', pathData);
    linePath.setAttribute('fill', 'none');
    linePath.setAttribute('stroke', color);
    linePath.setAttribute('stroke-width', '1.5');
    linePath.setAttribute('stroke-linecap', 'round');
    linePath.setAttribute('stroke-linejoin', 'round');
    g.appendChild(linePath);

    // Add hover circles if tooltip is enabled
    if (showTooltip) {
      data.forEach((point, index) => {
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', xScale(index).toString());
        circle.setAttribute('cy', yScale(point.price).toString());
        circle.setAttribute('r', '3');
        circle.setAttribute('fill', color);
        circle.setAttribute('opacity', '0');
        circle.style.cursor = 'pointer';
        
        circle.addEventListener('mouseenter', (e) => {
          circle.setAttribute('opacity', '1');
          if (tooltipRef.current) {
            tooltipRef.current.style.display = 'block';
            tooltipRef.current.innerHTML = `
              <div class="tooltip-price">$${point.price.toFixed(2)}</div>
              <div class="tooltip-time">${new Date(point.timestamp).toLocaleTimeString()}</div>
            `;
            
            const rect = svg.getBoundingClientRect();
            const tooltipRect = tooltipRef.current.getBoundingClientRect();
            
            tooltipRef.current.style.left = `${e.clientX - tooltipRect.width / 2}px`;
            tooltipRef.current.style.top = `${rect.top - tooltipRect.height - 8}px`;
          }
        });
        
        circle.addEventListener('mouseleave', () => {
          circle.setAttribute('opacity', '0');
          if (tooltipRef.current) {
            tooltipRef.current.style.display = 'none';
          }
        });
        
        g.appendChild(circle);
      });
    }

    svg.appendChild(g);
  }, [data, width, height, color, showTooltip]);

  useEffect(() => {
    drawSparkline();
  }, [drawSparkline]);

  if (!data || data.length === 0) {
    return (
      <div className={`sparkline-empty ${className}`} style={{ width, height }}>
        <div className="empty-message">No data</div>
      </div>
    );
  }

  return (
    <div className={`sparkline-container ${className}`} style={{ position: 'relative' }}>
      <svg
        ref={svgRef}
        width={width}
        height={height}
        className="asset-sparkline"
        style={{ display: 'block' }}
      />
      
      {showTooltip && (
        <div
          ref={tooltipRef}
          className="sparkline-tooltip"
          style={{
            position: 'fixed',
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            color: 'white',
            padding: '4px 8px',
            borderRadius: '4px',
            fontSize: '12px',
            pointerEvents: 'none',
            zIndex: 1000,
            display: 'none'
          }}
        />
      )}
    </div>
  );
};

export default AssetSparkline;