import { MarketAsset, PortfolioHolding, SectorData, CorrelationMatrix } from '../services/HeatMapDataService';

export interface HeatMapNode {
  id: string;
  name: string;
  symbol: string;
  value: number;
  size: number;
  color: number;
  category?: string;
  children?: HeatMapNode[];
  parent?: HeatMapNode;
  depth: number;
  x0?: number;
  y0?: number;
  x1?: number;
  y1?: number;
}

export interface TreeMapData {
  name: string;
  children: HeatMapNode[];
}

export interface GridLayout {
  rows: number;
  cols: number;
  cellWidth: number;
  cellHeight: number;
  positions: Array<{ x: number; y: number; width: number; height: number }>;
}

export interface HeatMapDimensions {
  width: number;
  height: number;
  margin: { top: number; right: number; bottom: number; left: number };
  innerWidth: number;
  innerHeight: number;
}

export interface PerformanceMetrics {
  totalReturn: number;
  annualizedReturn: number;
  volatility: number;
  sharpeRatio: number;
  maxDrawdown: number;
  winRate: number;
}

export class HeatMapCalculations {
  // Convert market data to heat map nodes
  static marketDataToNodes(
    data: MarketAsset[],
    sizeMetric: keyof MarketAsset = 'marketCap',
    colorMetric: keyof MarketAsset = 'priceChangePercentage24h'
  ): HeatMapNode[] {
    return data.map((asset, index) => ({
      id: asset.id,
      name: asset.name,
      symbol: asset.symbol,
      value: Number(asset[sizeMetric]) || 0,
      size: Number(asset[sizeMetric]) || 0,
      color: Number(asset[colorMetric]) || 0,
      category: asset.category,
      depth: 0
    }));
  }

  // Convert portfolio data to heat map nodes
  static portfolioDataToNodes(
    data: PortfolioHolding[],
    sizeMetric: keyof PortfolioHolding = 'value',
    colorMetric: keyof PortfolioHolding = 'profitPercentage'
  ): HeatMapNode[] {
    return data.map((holding, index) => ({
      id: holding.symbol,
      name: holding.name,
      symbol: holding.symbol,
      value: Number(holding[sizeMetric]) || 0,
      size: Number(holding[sizeMetric]) || 0,
      color: Number(holding[colorMetric]) || 0,
      category: holding.category,
      depth: 0
    }));
  }

  // Convert sector data to heat map nodes
  static sectorDataToNodes(
    data: SectorData[],
    sizeMetric: keyof SectorData = 'marketCap',
    colorMetric: keyof SectorData = 'change24h'
  ): HeatMapNode[] {
    return data.map((sector, index) => ({
      id: sector.id,
      name: sector.name,
      symbol: sector.id.toUpperCase(),
      value: Number(sector[sizeMetric]) || 0,
      size: Number(sector[sizeMetric]) || 0,
      color: Number(sector[colorMetric]) || 0,
      category: 'sector',
      depth: 0
    }));
  }

  // Create hierarchical data structure for treemap
  static createHierarchicalData(nodes: HeatMapNode[], groupBy?: string): TreeMapData {
    if (!groupBy) {
      return {
        name: 'root',
        children: nodes
      };
    }

    // Group nodes by category
    const groups = new Map<string, HeatMapNode[]>();
    
    nodes.forEach(node => {
      const groupKey = node.category || 'uncategorized';
      if (!groups.has(groupKey)) {
        groups.set(groupKey, []);
      }
      groups.get(groupKey)!.push(node);
    });

    const children: HeatMapNode[] = Array.from(groups.entries()).map(([category, categoryNodes]) => ({
      id: category,
      name: category.charAt(0).toUpperCase() + category.slice(1),
      symbol: category.toUpperCase(),
      value: categoryNodes.reduce((sum, node) => sum + node.value, 0),
      size: categoryNodes.reduce((sum, node) => sum + node.size, 0),
      color: this.calculateWeightedAverage(categoryNodes, 'color', 'size'),
      category,
      children: categoryNodes,
      depth: 0
    }));

    return {
      name: 'root',
      children
    };
  }

  // Calculate grid layout for uniform heat map
  static calculateGridLayout(nodeCount: number, dimensions: HeatMapDimensions): GridLayout {
    const { innerWidth, innerHeight } = dimensions;
    const aspectRatio = innerWidth / innerHeight;
    
    // Calculate optimal grid dimensions
    const cols = Math.ceil(Math.sqrt(nodeCount * aspectRatio));
    const rows = Math.ceil(nodeCount / cols);
    
    const cellWidth = innerWidth / cols;
    const cellHeight = innerHeight / rows;

    // Calculate positions for each cell
    const positions: Array<{ x: number; y: number; width: number; height: number }> = [];
    
    for (let i = 0; i < nodeCount; i++) {
      const row = Math.floor(i / cols);
      const col = i % cols;
      
      positions.push({
        x: col * cellWidth,
        y: row * cellHeight,
        width: cellWidth - 2, // Small gap between cells
        height: cellHeight - 2
      });
    }

    return {
      rows,
      cols,
      cellWidth,
      cellHeight,
      positions
    };
  }

  // Calculate correlation matrix statistics
  static calculateCorrelationStats(matrix: CorrelationMatrix): {
    avgCorrelation: number;
    maxCorrelation: number;
    minCorrelation: number;
    strongCorrelations: Array<{ asset1: string; asset2: string; correlation: number }>;
  } {
    const correlations: number[] = [];
    const strongCorrelations: Array<{ asset1: string; asset2: string; correlation: number }> = [];

    Object.entries(matrix).forEach(([asset1, correlations1]) => {
      Object.entries(correlations1).forEach(([asset2, correlation]) => {
        if (asset1 !== asset2) {
          correlations.push(correlation);
          
          if (Math.abs(correlation) > 0.7) {
            strongCorrelations.push({ asset1, asset2, correlation });
          }
        }
      });
    });

    return {
      avgCorrelation: correlations.reduce((sum, corr) => sum + corr, 0) / correlations.length,
      maxCorrelation: Math.max(...correlations),
      minCorrelation: Math.min(...correlations),
      strongCorrelations: strongCorrelations.sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation))
    };
  }

  // Calculate portfolio performance metrics
  static calculatePortfolioMetrics(holdings: PortfolioHolding[]): PerformanceMetrics {
    const totalValue = holdings.reduce((sum, holding) => sum + holding.value, 0);
    const totalProfit = holdings.reduce((sum, holding) => sum + holding.profit, 0);
    const totalReturn = (totalProfit / (totalValue - totalProfit)) * 100;

    // Calculate weighted return for each holding
    const weightedReturns = holdings.map(holding => {
      const weight = holding.value / totalValue;
      return weight * holding.profitPercentage;
    });

    const portfolioReturn = weightedReturns.reduce((sum, ret) => sum + ret, 0);

    // Calculate volatility (simplified - would need historical data in practice)
    const variance = holdings.reduce((sum, holding) => {
      const weight = holding.value / totalValue;
      const deviation = holding.profitPercentage - portfolioReturn;
      return sum + weight * Math.pow(deviation, 2);
    }, 0);

    const volatility = Math.sqrt(variance);

    // Calculate other metrics
    const riskFreeRate = 2; // Assume 2% risk-free rate
    const sharpeRatio = volatility > 0 ? (portfolioReturn - riskFreeRate) / volatility : 0;
    
    const profitableHoldings = holdings.filter(h => h.profit > 0);
    const winRate = (profitableHoldings.length / holdings.length) * 100;

    // Simplified max drawdown calculation
    const maxDrawdown = Math.min(...holdings.map(h => h.profitPercentage));

    return {
      totalReturn,
      annualizedReturn: totalReturn, // Simplified - would need time period for proper calculation
      volatility,
      sharpeRatio,
      maxDrawdown: Math.abs(maxDrawdown),
      winRate
    };
  }

  // Calculate value-weighted average
  static calculateWeightedAverage(nodes: HeatMapNode[], valueKey: keyof HeatMapNode, weightKey: keyof HeatMapNode): number {
    const totalWeight = nodes.reduce((sum, node) => sum + Number(node[weightKey]), 0);
    
    if (totalWeight === 0) return 0;

    const weightedSum = nodes.reduce((sum, node) => {
      return sum + (Number(node[valueKey]) * Number(node[weightKey]));
    }, 0);

    return weightedSum / totalWeight;
  }

  // Calculate heat map statistics
  static calculateHeatMapStats(nodes: HeatMapNode[]): {
    totalValue: number;
    avgValue: number;
    medianValue: number;
    totalChange: number;
    avgChange: number;
    positiveCount: number;
    negativeCount: number;
    neutralCount: number;
    distribution: { [key: string]: number };
  } {
    const values = nodes.map(n => n.size);
    const changes = nodes.map(n => n.color);

    const totalValue = values.reduce((sum, val) => sum + val, 0);
    const avgValue = totalValue / values.length;
    
    const sortedValues = [...values].sort((a, b) => a - b);
    const medianValue = sortedValues[Math.floor(sortedValues.length / 2)];

    const totalChange = changes.reduce((sum, change) => sum + change, 0);
    const avgChange = totalChange / changes.length;

    const positiveCount = changes.filter(c => c > 0).length;
    const negativeCount = changes.filter(c => c < 0).length;
    const neutralCount = changes.filter(c => c === 0).length;

    // Calculate distribution by ranges
    const distribution: { [key: string]: number } = {
      'very_negative': changes.filter(c => c < -5).length,
      'negative': changes.filter(c => c >= -5 && c < -1).length,
      'slightly_negative': changes.filter(c => c >= -1 && c < 0).length,
      'neutral': neutralCount,
      'slightly_positive': changes.filter(c => c > 0 && c <= 1).length,
      'positive': changes.filter(c => c > 1 && c <= 5).length,
      'very_positive': changes.filter(c => c > 5).length
    };

    return {
      totalValue,
      avgValue,
      medianValue,
      totalChange,
      avgChange,
      positiveCount,
      negativeCount,
      neutralCount,
      distribution
    };
  }

  // Generate heat map legend data
  static generateLegendData(nodes: HeatMapNode[], steps: number = 7): Array<{ value: number; label: string; percentage: number }> {
    const values = nodes.map(n => n.color);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min;

    if (range === 0) {
      return [{ value: min, label: `${min.toFixed(1)}%`, percentage: 100 }];
    }

    return Array.from({ length: steps }, (_, i) => {
      const value = min + (range * i) / (steps - 1);
      const label = `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;
      const percentage = (i / (steps - 1)) * 100;

      return { value, label, percentage };
    });
  }

  // Filter nodes by various criteria
  static filterNodes(
    nodes: HeatMapNode[],
    filters: {
      minSize?: number;
      maxSize?: number;
      minColor?: number;
      maxColor?: number;
      categories?: string[];
      searchTerm?: string;
    }
  ): HeatMapNode[] {
    return nodes.filter(node => {
      // Size filters
      if (filters.minSize !== undefined && node.size < filters.minSize) return false;
      if (filters.maxSize !== undefined && node.size > filters.maxSize) return false;

      // Color filters
      if (filters.minColor !== undefined && node.color < filters.minColor) return false;
      if (filters.maxColor !== undefined && node.color > filters.maxColor) return false;

      // Category filter
      if (filters.categories && filters.categories.length > 0) {
        if (!node.category || !filters.categories.includes(node.category)) return false;
      }

      // Search term filter
      if (filters.searchTerm) {
        const term = filters.searchTerm.toLowerCase();
        if (!node.name.toLowerCase().includes(term) && 
            !node.symbol.toLowerCase().includes(term)) {
          return false;
        }
      }

      return true;
    });
  }

  // Sort nodes by various criteria
  static sortNodes(nodes: HeatMapNode[], sortBy: 'size' | 'color' | 'name' | 'symbol', direction: 'asc' | 'desc' = 'desc'): HeatMapNode[] {
    const sorted = [...nodes];

    sorted.sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'size':
          comparison = a.size - b.size;
          break;
        case 'color':
          comparison = a.color - b.color;
          break;
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'symbol':
          comparison = a.symbol.localeCompare(b.symbol);
          break;
      }

      return direction === 'desc' ? -comparison : comparison;
    });

    return sorted;
  }

  // Calculate optimal dimensions for heat map
  static calculateOptimalDimensions(
    containerWidth: number,
    containerHeight: number,
    nodeCount: number,
    minCellSize: number = 50
  ): HeatMapDimensions {
    const margin = {
      top: 40,
      right: 40,
      bottom: 60,
      left: 40
    };

    let width = containerWidth;
    let height = containerHeight;

    // Ensure minimum dimensions
    const minWidth = margin.left + margin.right + minCellSize * 2;
    const minHeight = margin.top + margin.bottom + minCellSize * 2;

    width = Math.max(width, minWidth);
    height = Math.max(height, minHeight);

    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    return {
      width,
      height,
      margin,
      innerWidth,
      innerHeight
    };
  }

  // Generate drill-down path for hierarchical navigation
  static generateDrillDownPath(node: HeatMapNode): HeatMapNode[] {
    const path: HeatMapNode[] = [];
    let current: HeatMapNode | undefined = node;

    while (current) {
      path.unshift(current);
      current = current.parent;
    }

    return path;
  }
}

export default HeatMapCalculations;