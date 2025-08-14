import { AssetData } from '../../services/assetService';

/**
 * Asset utility functions for calculations, formatting, and operations
 */

/**
 * Calculate price change color based on percentage
 */
export const getPriceChangeColor = (changePercentage: number): string => {
  if (changePercentage > 0) return '#10b981'; // green
  if (changePercentage < 0) return '#ef4444'; // red
  return '#6b7280'; // gray
};

/**
 * Get price change direction
 */
export const getPriceChangeDirection = (changePercentage: number): 'up' | 'down' | 'neutral' => {
  if (changePercentage > 0) return 'up';
  if (changePercentage < 0) return 'down';
  return 'neutral';
};

/**
 * Calculate asset performance rating based on various metrics
 */
export const calculateAssetRating = (asset: AssetData): number => {
  let score = 0;
  let factors = 0;

  // Market cap rank (lower is better)
  if (asset.marketCapRank) {
    if (asset.marketCapRank <= 10) score += 5;
    else if (asset.marketCapRank <= 50) score += 4;
    else if (asset.marketCapRank <= 100) score += 3;
    else if (asset.marketCapRank <= 500) score += 2;
    else score += 1;
    factors++;
  }

  // 24h price change
  if (asset.priceChangePercentage24h !== undefined) {
    if (asset.priceChangePercentage24h > 10) score += 5;
    else if (asset.priceChangePercentage24h > 5) score += 4;
    else if (asset.priceChangePercentage24h > 0) score += 3;
    else if (asset.priceChangePercentage24h > -5) score += 2;
    else score += 1;
    factors++;
  }

  // 7d price change (if available)
  if (asset.priceChangePercentage7d !== undefined) {
    if (asset.priceChangePercentage7d > 20) score += 5;
    else if (asset.priceChangePercentage7d > 10) score += 4;
    else if (asset.priceChangePercentage7d > 0) score += 3;
    else if (asset.priceChangePercentage7d > -10) score += 2;
    else score += 1;
    factors++;
  }

  // Volume (relative to market cap)
  if (asset.volume24h && asset.marketCap) {
    const volumeRatio = asset.volume24h / asset.marketCap;
    if (volumeRatio > 0.1) score += 5;
    else if (volumeRatio > 0.05) score += 4;
    else if (volumeRatio > 0.02) score += 3;
    else if (volumeRatio > 0.01) score += 2;
    else score += 1;
    factors++;
  }

  return factors > 0 ? Math.round((score / factors) * 2) / 2 : 3; // Return average scaled to 5, rounded to nearest 0.5
};

/**
 * Determine risk level based on asset metrics
 */
export const getAssetRiskLevel = (asset: AssetData): 'low' | 'medium' | 'high' | 'very-high' => {
  let riskScore = 0;

  // Market cap (higher = lower risk)
  if (asset.marketCap > 100000000000) riskScore += 1; // > $100B
  else if (asset.marketCap > 10000000000) riskScore += 2; // > $10B
  else if (asset.marketCap > 1000000000) riskScore += 3; // > $1B
  else riskScore += 4; // < $1B

  // Volatility based on 24h change
  const volatility = Math.abs(asset.priceChangePercentage24h || 0);
  if (volatility > 20) riskScore += 3;
  else if (volatility > 10) riskScore += 2;
  else if (volatility > 5) riskScore += 1;

  // Market cap rank (lower rank = lower risk)
  if (asset.marketCapRank) {
    if (asset.marketCapRank > 500) riskScore += 2;
    else if (asset.marketCapRank > 100) riskScore += 1;
  }

  if (riskScore <= 2) return 'low';
  if (riskScore <= 4) return 'medium';
  if (riskScore <= 6) return 'high';
  return 'very-high';
};

/**
 * Get asset category based on market cap and rank
 */
export const getAssetCategory = (asset: AssetData): 'blue-chip' | 'large-cap' | 'mid-cap' | 'small-cap' | 'micro-cap' => {
  if (asset.marketCapRank <= 10 && asset.marketCap > 50000000000) {
    return 'blue-chip';
  }
  
  if (asset.marketCap > 10000000000) return 'large-cap';
  if (asset.marketCap > 1000000000) return 'mid-cap';
  if (asset.marketCap > 100000000) return 'small-cap';
  return 'micro-cap';
};

/**
 * Calculate technical indicators
 */
export const calculateTechnicalIndicators = (priceHistory: { price: number; timestamp: number }[]) => {
  if (!priceHistory || priceHistory.length < 2) {
    return {
      trend: 'neutral' as const,
      momentum: 0,
      volatility: 0,
      support: 0,
      resistance: 0
    };
  }

  const prices = priceHistory.map(p => p.price);
  const currentPrice = prices[prices.length - 1];
  const firstPrice = prices[0];
  
  // Simple trend calculation
  const trend = currentPrice > firstPrice ? 'bullish' : currentPrice < firstPrice ? 'bearish' : 'neutral';
  
  // Momentum (rate of change)
  const momentum = ((currentPrice - firstPrice) / firstPrice) * 100;
  
  // Volatility (standard deviation)
  const mean = prices.reduce((a, b) => a + b, 0) / prices.length;
  const variance = prices.reduce((sum, price) => sum + Math.pow(price - mean, 2), 0) / prices.length;
  const volatility = Math.sqrt(variance) / mean * 100; // Coefficient of variation
  
  // Support and resistance (simple min/max)
  const support = Math.min(...prices);
  const resistance = Math.max(...prices);
  
  return {
    trend,
    momentum: Number(momentum.toFixed(2)),
    volatility: Number(volatility.toFixed(2)),
    support,
    resistance
  };
};

/**
 * Compare two assets for sorting
 */
export const compareAssets = (
  a: AssetData,
  b: AssetData,
  sortBy: string,
  direction: 'asc' | 'desc' = 'asc'
): number => {
  let comparison = 0;

  switch (sortBy) {
    case 'rank':
    case 'marketCapRank':
      comparison = (a.marketCapRank || Infinity) - (b.marketCapRank || Infinity);
      break;
    case 'name':
      comparison = a.name.localeCompare(b.name);
      break;
    case 'symbol':
      comparison = a.symbol.localeCompare(b.symbol);
      break;
    case 'price':
    case 'currentPrice':
      comparison = a.currentPrice - b.currentPrice;
      break;
    case 'change24h':
    case 'priceChangePercentage24h':
      comparison = (a.priceChangePercentage24h || 0) - (b.priceChangePercentage24h || 0);
      break;
    case 'marketCap':
      comparison = a.marketCap - b.marketCap;
      break;
    case 'volume24h':
    case 'volume':
      comparison = a.volume24h - b.volume24h;
      break;
    default:
      comparison = 0;
  }

  return direction === 'desc' ? -comparison : comparison;
};

/**
 * Filter assets based on criteria
 */
export const filterAssets = (
  assets: AssetData[],
  filters: {
    category?: string;
    riskLevel?: string;
    minMarketCap?: number;
    maxMarketCap?: number;
    minPrice?: number;
    maxPrice?: number;
    minChange24h?: number;
    maxChange24h?: number;
    search?: string;
  }
): AssetData[] => {
  return assets.filter(asset => {
    // Category filter
    if (filters.category && filters.category !== 'all') {
      const category = getAssetCategory(asset);
      if (category !== filters.category) return false;
    }

    // Risk level filter
    if (filters.riskLevel && filters.riskLevel !== 'all') {
      const riskLevel = getAssetRiskLevel(asset);
      if (riskLevel !== filters.riskLevel) return false;
    }

    // Market cap range
    if (filters.minMarketCap && asset.marketCap < filters.minMarketCap) return false;
    if (filters.maxMarketCap && asset.marketCap > filters.maxMarketCap) return false;

    // Price range
    if (filters.minPrice && asset.currentPrice < filters.minPrice) return false;
    if (filters.maxPrice && asset.currentPrice > filters.maxPrice) return false;

    // 24h change range
    if (filters.minChange24h && (asset.priceChangePercentage24h || 0) < filters.minChange24h) return false;
    if (filters.maxChange24h && (asset.priceChangePercentage24h || 0) > filters.maxChange24h) return false;

    // Search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      const nameMatch = asset.name.toLowerCase().includes(searchLower);
      const symbolMatch = asset.symbol.toLowerCase().includes(searchLower);
      if (!nameMatch && !symbolMatch) return false;
    }

    return true;
  });
};

/**
 * Get asset performance summary
 */
export const getAssetPerformanceSummary = (asset: AssetData) => {
  const rating = calculateAssetRating(asset);
  const riskLevel = getAssetRiskLevel(asset);
  const category = getAssetCategory(asset);
  const direction = getPriceChangeDirection(asset.priceChangePercentage24h || 0);

  return {
    rating,
    riskLevel,
    category,
    direction,
    isGainer: (asset.priceChangePercentage24h || 0) > 5,
    isLoser: (asset.priceChangePercentage24h || 0) < -5,
    isVolatile: Math.abs(asset.priceChangePercentage24h || 0) > 10,
    isTopRanked: (asset.marketCapRank || Infinity) <= 50,
    hasHighVolume: asset.volume24h && asset.marketCap && (asset.volume24h / asset.marketCap) > 0.1
  };
};

/**
 * Generate asset insights and recommendations
 */
export const generateAssetInsights = (asset: AssetData): string[] => {
  const insights: string[] = [];
  const summary = getAssetPerformanceSummary(asset);

  // Ranking insights
  if (asset.marketCapRank && asset.marketCapRank <= 10) {
    insights.push('Top 10 cryptocurrency by market cap');
  } else if (asset.marketCapRank && asset.marketCapRank <= 50) {
    insights.push('Major cryptocurrency with strong market position');
  }

  // Performance insights
  if (summary.isGainer) {
    insights.push('Strong 24h performance with significant gains');
  } else if (summary.isLoser) {
    insights.push('Experiencing 24h decline - potential buying opportunity');
  }

  // Volatility insights
  if (summary.isVolatile) {
    insights.push('High volatility - suitable for experienced traders');
  }

  // Volume insights
  if (summary.hasHighVolume) {
    insights.push('High trading volume indicates strong market activity');
  }

  // Risk insights
  switch (summary.riskLevel) {
    case 'low':
      insights.push('Low risk investment with stable market position');
      break;
    case 'high':
    case 'very-high':
      insights.push('High risk investment - requires careful consideration');
      break;
  }

  // All-time high insights
  if (asset.ath && asset.currentPrice) {
    const athDistance = ((asset.currentPrice - asset.ath) / asset.ath) * 100;
    if (athDistance > -20) {
      insights.push('Trading near all-time high levels');
    } else if (athDistance < -50) {
      insights.push('Significant discount from all-time high');
    }
  }

  return insights;
};