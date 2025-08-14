export interface ColorScale {
  name: string;
  description: string;
  positive: string[];
  negative: string[];
  neutral: string;
  interpolator?: (t: number) => string;
}

export interface ColorScheme {
  id: string;
  name: string;
  description: string;
  colors: string[];
  domain: [number, number];
  type: 'diverging' | 'sequential' | 'categorical';
}

// Predefined color scales for heat maps
export const colorScales: { [key: string]: ColorScale } = {
  redGreen: {
    name: 'Red-Green',
    description: 'Traditional red (negative) to green (positive) scale',
    positive: ['#10b981', '#059669', '#047857'], // green-500, green-600, green-700
    negative: ['#ef4444', '#dc2626', '#b91c1c'], // red-500, red-600, red-700
    neutral: '#6b7280' // gray-500
  },

  blueOrange: {
    name: 'Blue-Orange',
    description: 'Blue (negative) to orange (positive) diverging scale',
    positive: ['#f97316', '#ea580c', '#c2410c'], // orange-500, orange-600, orange-700
    negative: ['#3b82f6', '#2563eb', '#1d4ed8'], // blue-500, blue-600, blue-700
    neutral: '#64748b' // slate-500
  },

  purpleGreen: {
    name: 'Purple-Green',
    description: 'Purple (negative) to green (positive) diverging scale',
    positive: ['#22c55e', '#16a34a', '#15803d'], // green-500, green-600, green-700
    negative: ['#a855f7', '#9333ea', '#7c3aed'], // purple-500, purple-600, purple-700
    neutral: '#71717a' // zinc-500
  },

  viridis: {
    name: 'Viridis',
    description: 'Perceptually uniform colormap from purple to yellow',
    positive: ['#fde047', '#facc15', '#eab308'], // yellow-300, yellow-400, yellow-500
    negative: ['#8b5cf6', '#7c3aed', '#6d28d9'], // violet-400, violet-600, violet-700
    neutral: '#10b981' // emerald-500
  },

  plasma: {
    name: 'Plasma',
    description: 'Perceptually uniform colormap from purple to pink to yellow',
    positive: ['#fbbf24', '#f59e0b', '#d97706'], // amber-400, amber-500, amber-600
    negative: ['#ec4899', '#db2777', '#be185d'], // pink-400, pink-500, pink-600
    neutral: '#8b5cf6' // violet-400
  },

  monochrome: {
    name: 'Monochrome',
    description: 'Grayscale with intensity representing magnitude',
    positive: ['#374151', '#1f2937', '#111827'], // gray-700, gray-800, gray-900
    negative: ['#9ca3af', '#6b7280', '#4b5563'], // gray-400, gray-500, gray-600
    neutral: '#d1d5db' // gray-300
  }
};

// Color schemes for different use cases
export const colorSchemes: { [key: string]: ColorScheme } = {
  performance: {
    id: 'performance',
    name: 'Performance',
    description: 'Red-green diverging scale for performance metrics',
    colors: ['#dc2626', '#ef4444', '#f87171', '#fecaca', '#f3f4f6', '#dcfce7', '#86efac', '#22c55e', '#16a34a'],
    domain: [-10, 10],
    type: 'diverging'
  },

  marketCap: {
    id: 'marketCap',
    name: 'Market Cap',
    description: 'Blue sequential scale for market capitalization',
    colors: ['#dbeafe', '#bfdbfe', '#93c5fd', '#60a5fa', '#3b82f6', '#2563eb', '#1d4ed8', '#1e40af'],
    domain: [0, 1],
    type: 'sequential'
  },

  volume: {
    id: 'volume',
    name: 'Volume',
    description: 'Purple sequential scale for trading volume',
    colors: ['#f3e8ff', '#e9d5ff', '#d8b4fe', '#c084fc', '#a855f7', '#9333ea', '#7c3aed', '#6d28d9'],
    domain: [0, 1],
    type: 'sequential'
  },

  volatility: {
    id: 'volatility',
    name: 'Volatility',
    description: 'Orange sequential scale for volatility metrics',
    colors: ['#fed7aa', '#fdba74', '#fb923c', '#f97316', '#ea580c', '#dc2626', '#c2410c', '#9a3412'],
    domain: [0, 1],
    type: 'sequential'
  },

  correlation: {
    id: 'correlation',
    name: 'Correlation',
    description: 'Blue-white-red diverging scale for correlations',
    colors: ['#1e40af', '#3b82f6', '#60a5fa', '#93c5fd', '#f8fafc', '#fca5a5', '#f87171', '#ef4444', '#dc2626'],
    domain: [-1, 1],
    type: 'diverging'
  },

  sectors: {
    id: 'sectors',
    name: 'Sectors',
    description: 'Categorical colors for different sectors',
    colors: [
      '#ef4444', // red-500
      '#f97316', // orange-500
      '#eab308', // yellow-500
      '#22c55e', // green-500
      '#06b6d4', // cyan-500
      '#3b82f6', // blue-500
      '#8b5cf6', // violet-500
      '#ec4899', // pink-500
      '#6b7280', // gray-500
      '#84cc16'  // lime-500
    ],
    domain: [0, 10],
    type: 'categorical'
  }
};

// Color utility functions
export class ColorUtils {
  // Get color scale based on metric type
  static getColorScale(metric: string): ColorScale {
    const metricMap: { [key: string]: string } = {
      'change24h': 'redGreen',
      'change7d': 'redGreen',
      'change30d': 'redGreen',
      'priceChangePercentage24h': 'redGreen',
      'marketCapChangePercentage24h': 'redGreen',
      'marketCap': 'viridis',
      'volume24h': 'viridis',
      'correlation': 'blueOrange',
      'volatility': 'plasma',
      'allocation': 'purpleGreen'
    };

    const scaleKey = metricMap[metric] || 'redGreen';
    return colorScales[scaleKey];
  }

  // Generate color from value and scale
  static getColor(value: number, scale: ColorScale, domain: [number, number]): string {
    const [min, max] = domain;
    const normalized = (value - min) / (max - min);

    if (value === 0 || (normalized > 0.45 && normalized < 0.55)) {
      return scale.neutral;
    }

    if (value > 0) {
      const intensity = Math.min(1, Math.abs(normalized - 0.5) * 2);
      const colorIndex = Math.floor(intensity * (scale.positive.length - 1));
      return scale.positive[colorIndex];
    } else {
      const intensity = Math.min(1, Math.abs(normalized - 0.5) * 2);
      const colorIndex = Math.floor(intensity * (scale.negative.length - 1));
      return scale.negative[colorIndex];
    }
  }

  // Create D3 color scale
  static createD3ColorScale(scheme: ColorScheme): any {
    // This would integrate with D3.js color scales
    // For now, return a function that maps values to colors
    return (value: number) => {
      const [min, max] = scheme.domain;
      const normalized = (value - min) / (max - min);
      
      if (scheme.type === 'categorical') {
        const index = Math.floor(normalized * scheme.colors.length);
        return scheme.colors[Math.min(index, scheme.colors.length - 1)];
      }

      // Linear interpolation for sequential and diverging scales
      const colorIndex = normalized * (scheme.colors.length - 1);
      const lowerIndex = Math.floor(colorIndex);
      const upperIndex = Math.ceil(colorIndex);
      
      if (lowerIndex === upperIndex) {
        return scheme.colors[lowerIndex];
      }

      // Simple interpolation between two colors
      const lowerColor = scheme.colors[lowerIndex];
      const upperColor = scheme.colors[upperIndex];
      const factor = colorIndex - lowerIndex;

      return this.interpolateColor(lowerColor, upperColor, factor);
    };
  }

  // Simple color interpolation
  static interpolateColor(color1: string, color2: string, factor: number): string {
    // Convert hex to RGB
    const hex1 = color1.replace('#', '');
    const hex2 = color2.replace('#', '');

    const r1 = parseInt(hex1.substr(0, 2), 16);
    const g1 = parseInt(hex1.substr(2, 2), 16);
    const b1 = parseInt(hex1.substr(4, 2), 16);

    const r2 = parseInt(hex2.substr(0, 2), 16);
    const g2 = parseInt(hex2.substr(2, 2), 16);
    const b2 = parseInt(hex2.substr(4, 2), 16);

    // Interpolate
    const r = Math.round(r1 + (r2 - r1) * factor);
    const g = Math.round(g1 + (g2 - g1) * factor);
    const b = Math.round(b1 + (b2 - b1) * factor);

    // Convert back to hex
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  }

  // Get contrasting text color
  static getContrastingTextColor(backgroundColor: string): string {
    const hex = backgroundColor.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);

    // Calculate luminance
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

    return luminance > 0.5 ? '#000000' : '#ffffff';
  }

  // Generate color legend
  static generateColorLegend(scheme: ColorScheme, steps: number = 10): Array<{ value: number; color: string; label: string }> {
    const [min, max] = scheme.domain;
    const stepSize = (max - min) / (steps - 1);
    const colorScale = this.createD3ColorScale(scheme);

    return Array.from({ length: steps }, (_, i) => {
      const value = min + stepSize * i;
      const color = colorScale(value);
      let label: string;

      if (scheme.type === 'diverging' && min < 0 && max > 0) {
        label = `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;
      } else if (scheme.id === 'marketCap' || scheme.id === 'volume') {
        label = value >= 1e9 ? `$${(value / 1e9).toFixed(1)}B` : `$${(value / 1e6).toFixed(0)}M`;
      } else {
        label = value.toFixed(2);
      }

      return { value, color, label };
    });
  }

  // Get adaptive color scheme based on data characteristics
  static getAdaptiveColorScheme(data: number[], metric: string): ColorScheme {
    const min = Math.min(...data);
    const max = Math.max(...data);
    const hasNegative = min < 0;
    const hasPositive = max > 0;

    // For performance metrics, use diverging scale
    if (metric.includes('change') || metric.includes('percentage')) {
      return {
        ...colorSchemes.performance,
        domain: [min, max]
      };
    }

    // For correlation, always use correlation scheme
    if (metric === 'correlation') {
      return colorSchemes.correlation;
    }

    // For volume/market cap, use sequential scale
    if (metric.includes('volume') || metric.includes('marketCap')) {
      return {
        ...colorSchemes.marketCap,
        domain: [min, max]
      };
    }

    // Default to performance scheme for mixed data
    return {
      ...colorSchemes.performance,
      domain: [min, max]
    };
  }
}

export default ColorUtils;