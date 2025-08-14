interface VolumeData {
  timestamp: number;
  volume: number;
  price: number;
  high: number;
  low: number;
  open: number;
  buyVolume: number;
  sellVolume: number;
}

interface VolumeProfileLevel {
  price: number;
  priceRange: number;
  volume: number;
  count: number;
}

interface VWAPData {
  current: number;
  deviation: number;
  series: Array<{
    timestamp: number;
    vwap: number;
    price: number;
    deviation: number;
  }>;
}

interface VolumeIndicatorPoint {
  timestamp: number;
  value: number;
}

interface VolumeIndicators {
  obv: VolumeIndicatorPoint[];
  ad: VolumeIndicatorPoint[];
  cmf: VolumeIndicatorPoint[];
  vpt: VolumeIndicatorPoint[];
  nvi: VolumeIndicatorPoint[];
  pvi: VolumeIndicatorPoint[];
}

interface VolumeTrends {
  trend: 'increasing' | 'decreasing' | 'neutral';
  strength: 'weak' | 'moderate' | 'strong';
  volumeChange: number;
  recentAverage: number;
  historicalAverage: number;
}

interface OrderBookLevel {
  price: number;
  quantity: number;
  total: number;
}

interface OrderBook {
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  spread: number;
  mid: number;
  timestamp: number;
}

interface MarketDepth {
  levels: Array<{
    price: number;
    bidQuantity: number;
    askQuantity: number;
    bidTotal: number;
    askTotal: number;
  }>;
  maxQuantity: number;
  liquidityScore: number;
}

interface TimeAndSalesEntry {
  timestamp: number;
  price: number;
  quantity: number;
  side: 'buy' | 'sell';
  id: string;
}

interface LiquidityMetrics {
  spread: number;
  spreadPercentage: number;
  marketImpact: number;
  liquidityScore: number;
  totalDepth: number;
  imbalance: number;
}

class VolumeAnalysisService {
  private baseURL: string;

  constructor(baseURL: string = '/api') {
    this.baseURL = baseURL;
  }

  // Mock data generation for development
  private generateMockVolumeData(symbol: string, timeframe: string, limit: number = 1000): VolumeData[] {
    const data: VolumeData[] = [];
    const now = Date.now();
    const interval = this.getTimeframeInterval(timeframe);
    
    let price = 50000; // Starting price for BTC
    
    for (let i = limit - 1; i >= 0; i--) {
      const timestamp = now - (i * interval);
      
      // Generate realistic price movement
      const priceChange = (Math.random() - 0.5) * 0.02 * price;
      price = Math.max(price + priceChange, price * 0.95);
      
      const high = price + Math.random() * 0.01 * price;
      const low = price - Math.random() * 0.01 * price;
      const open = low + Math.random() * (high - low);
      
      // Generate volume with realistic patterns
      const baseVolume = 1000 + Math.random() * 5000;
      const volumeMultiplier = 1 + Math.sin(i / 20) * 0.5 + Math.random() * 0.3;
      const volume = baseVolume * volumeMultiplier;
      
      const buyRatio = 0.4 + Math.random() * 0.2;
      const buyVolume = volume * buyRatio;
      const sellVolume = volume * (1 - buyRatio);
      
      data.push({
        timestamp,
        volume,
        price,
        high,
        low,
        open,
        buyVolume,
        sellVolume
      });
    }
    
    return data;
  }

  private getTimeframeInterval(timeframe: string): number {
    const intervals: { [key: string]: number } = {
      '1m': 60 * 1000,
      '5m': 5 * 60 * 1000,
      '15m': 15 * 60 * 1000,
      '1h': 60 * 60 * 1000,
      '4h': 4 * 60 * 60 * 1000,
      '1d': 24 * 60 * 60 * 1000
    };
    return intervals[timeframe] || intervals['1h'];
  }

  async getVolumeData(symbol: string, timeframe: string, limit: number = 1000): Promise<VolumeData[]> {
    try {
      // For development, return mock data
      return this.generateMockVolumeData(symbol, timeframe, limit);
      
      // In production, this would make an API call:
      // const response = await fetch(`${this.baseURL}/market-data/volume`, {
      //   method: 'GET',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ symbol, timeframe, limit })
      // });
      // return await response.json();
    } catch (error) {
      console.error('Error fetching volume data:', error);
      throw error;
    }
  }

  async calculateVolumeProfile(symbol: string, timeframe: string, periods: number = 100): Promise<VolumeProfileLevel[]> {
    try {
      const priceVolumeData = await this.getVolumeData(symbol, timeframe);
      
      if (priceVolumeData.length === 0) return [];

      // Calculate price levels and volume distribution
      const priceRange = {
        min: Math.min(...priceVolumeData.map(d => d.low)),
        max: Math.max(...priceVolumeData.map(d => d.high))
      };

      const priceStep = (priceRange.max - priceRange.min) / periods;
      const volumeProfile: VolumeProfileLevel[] = [];

      for (let i = 0; i < periods; i++) {
        const priceLevel = priceRange.min + (i * priceStep);
        const priceUpperBound = priceLevel + priceStep;
        
        let totalVolume = 0;
        let count = 0;

        priceVolumeData.forEach(point => {
          // Check if this price level intersects with the candle
          if (priceLevel <= point.high && priceUpperBound >= point.low) {
            // Distribute volume proportionally if candle spans multiple levels
            const intersection = Math.min(point.high, priceUpperBound) - Math.max(point.low, priceLevel);
            const candleRange = point.high - point.low;
            const volumeRatio = candleRange > 0 ? intersection / candleRange : 1;
            
            totalVolume += point.volume * volumeRatio;
            count++;
          }
        });

        if (totalVolume > 0) {
          volumeProfile.push({
            price: priceLevel + priceStep / 2, // Mid-point of level
            priceRange: priceStep,
            volume: totalVolume,
            count: count
          });
        }
      }

      return volumeProfile.sort((a, b) => b.volume - a.volume);
    } catch (error) {
      console.error('Error calculating volume profile:', error);
      throw error;
    }
  }

  async calculateVWAP(symbol: string, timeframe: string): Promise<VWAPData> {
    try {
      const volumeData = await this.getVolumeData(symbol, timeframe);
      
      if (volumeData.length === 0) {
        throw new Error('No volume data available for VWAP calculation');
      }

      let cumulativeVolumePrice = 0;
      let cumulativeVolume = 0;
      const vwapSeries: Array<{
        timestamp: number;
        vwap: number;
        price: number;
        deviation: number;
      }> = [];

      volumeData.forEach(point => {
        const typicalPrice = (point.high + point.low + point.price) / 3;
        cumulativeVolumePrice += typicalPrice * point.volume;
        cumulativeVolume += point.volume;
        
        const vwap = cumulativeVolume > 0 ? cumulativeVolumePrice / cumulativeVolume : 0;
        
        vwapSeries.push({
          timestamp: point.timestamp,
          vwap: vwap,
          price: point.price,
          deviation: vwap > 0 ? ((point.price - vwap) / vwap) * 100 : 0
        });
      });

      const currentVwap = vwapSeries[vwapSeries.length - 1];
      
      return {
        current: currentVwap.vwap,
        deviation: currentVwap.deviation,
        series: vwapSeries
      };
    } catch (error) {
      console.error('Error calculating VWAP:', error);
      throw error;
    }
  }

  async calculateVolumeIndicators(symbol: string, timeframe: string): Promise<VolumeIndicators> {
    try {
      const volumeData = await this.getVolumeData(symbol, timeframe);
      
      if (volumeData.length < 20) {
        throw new Error('Insufficient data for volume indicator calculations');
      }

      const indicators: VolumeIndicators = {
        obv: this.calculateOBV(volumeData),
        ad: this.calculateAccumulationDistribution(volumeData),
        cmf: this.calculateChaikinMoneyFlow(volumeData),
        vpt: this.calculateVolumePercentTrend(volumeData),
        nvi: this.calculateNegativeVolumeIndex(volumeData),
        pvi: this.calculatePositiveVolumeIndex(volumeData)
      };

      return indicators;
    } catch (error) {
      console.error('Error calculating volume indicators:', error);
      throw error;
    }
  }

  private calculateOBV(volumeData: VolumeData[]): VolumeIndicatorPoint[] {
    // On-Balance Volume
    const obv: VolumeIndicatorPoint[] = [{ timestamp: volumeData[0].timestamp, value: 0 }];
    
    for (let i = 1; i < volumeData.length; i++) {
      const current = volumeData[i];
      const previous = volumeData[i - 1];
      const prevOBV = obv[obv.length - 1].value;
      
      let newOBV: number;
      if (current.price > previous.price) {
        newOBV = prevOBV + current.volume;
      } else if (current.price < previous.price) {
        newOBV = prevOBV - current.volume;
      } else {
        newOBV = prevOBV;
      }
      
      obv.push({
        timestamp: current.timestamp,
        value: newOBV
      });
    }
    
    return obv;
  }

  private calculateAccumulationDistribution(volumeData: VolumeData[]): VolumeIndicatorPoint[] {
    // Accumulation/Distribution Line
    const ad: VolumeIndicatorPoint[] = [{ timestamp: volumeData[0].timestamp, value: 0 }];
    
    for (let i = 1; i < volumeData.length; i++) {
      const current = volumeData[i];
      const range = current.high - current.low;
      
      let clv = 0; // Close Location Value
      if (range > 0) {
        clv = ((current.price - current.low) - (current.high - current.price)) / range;
      }
      
      const adValue = ad[ad.length - 1].value + (clv * current.volume);
      
      ad.push({
        timestamp: current.timestamp,
        value: adValue
      });
    }
    
    return ad;
  }

  private calculateChaikinMoneyFlow(volumeData: VolumeData[], period: number = 20): VolumeIndicatorPoint[] {
    // Chaikin Money Flow
    const cmf: VolumeIndicatorPoint[] = [];
    
    for (let i = period - 1; i < volumeData.length; i++) {
      let sumMoneyFlowVolume = 0;
      let sumVolume = 0;
      
      for (let j = i - period + 1; j <= i; j++) {
        const point = volumeData[j];
        const range = point.high - point.low;
        
        let moneyFlowMultiplier = 0;
        if (range > 0) {
          moneyFlowMultiplier = ((point.price - point.low) - (point.high - point.price)) / range;
        }
        
        const moneyFlowVolume = moneyFlowMultiplier * point.volume;
        sumMoneyFlowVolume += moneyFlowVolume;
        sumVolume += point.volume;
      }
      
      const cmfValue = sumVolume > 0 ? sumMoneyFlowVolume / sumVolume : 0;
      
      cmf.push({
        timestamp: volumeData[i].timestamp,
        value: cmfValue
      });
    }
    
    return cmf;
  }

  private calculateVolumePercentTrend(volumeData: VolumeData[]): VolumeIndicatorPoint[] {
    // Volume Price Trend
    const vpt: VolumeIndicatorPoint[] = [{ timestamp: volumeData[0].timestamp, value: 0 }];
    
    for (let i = 1; i < volumeData.length; i++) {
      const current = volumeData[i];
      const previous = volumeData[i - 1];
      const prevVPT = vpt[vpt.length - 1].value;
      
      const percentChange = previous.price > 0 ? (current.price - previous.price) / previous.price : 0;
      const vptValue = prevVPT + (current.volume * percentChange);
      
      vpt.push({
        timestamp: current.timestamp,
        value: vptValue
      });
    }
    
    return vpt;
  }

  private calculateNegativeVolumeIndex(volumeData: VolumeData[]): VolumeIndicatorPoint[] {
    // Negative Volume Index
    const nvi: VolumeIndicatorPoint[] = [{ timestamp: volumeData[0].timestamp, value: 1000 }];
    
    for (let i = 1; i < volumeData.length; i++) {
      const current = volumeData[i];
      const previous = volumeData[i - 1];
      const prevNVI = nvi[nvi.length - 1].value;
      
      let nviValue: number;
      if (current.volume < previous.volume) {
        const percentChange = previous.price > 0 ? (current.price - previous.price) / previous.price : 0;
        nviValue = prevNVI + (prevNVI * percentChange);
      } else {
        nviValue = prevNVI;
      }
      
      nvi.push({
        timestamp: current.timestamp,
        value: nviValue
      });
    }
    
    return nvi;
  }

  private calculatePositiveVolumeIndex(volumeData: VolumeData[]): VolumeIndicatorPoint[] {
    // Positive Volume Index
    const pvi: VolumeIndicatorPoint[] = [{ timestamp: volumeData[0].timestamp, value: 1000 }];
    
    for (let i = 1; i < volumeData.length; i++) {
      const current = volumeData[i];
      const previous = volumeData[i - 1];
      const prevPVI = pvi[pvi.length - 1].value;
      
      let pviValue: number;
      if (current.volume > previous.volume) {
        const percentChange = previous.price > 0 ? (current.price - previous.price) / previous.price : 0;
        pviValue = prevPVI + (prevPVI * percentChange);
      } else {
        pviValue = prevPVI;
      }
      
      pvi.push({
        timestamp: current.timestamp,
        value: pviValue
      });
    }
    
    return pvi;
  }

  async analyzeVolumeTrends(symbol: string, timeframe: string): Promise<VolumeTrends> {
    try {
      const volumeData = await this.getVolumeData(symbol, timeframe, 50);
      
      if (volumeData.length < 10) {
        throw new Error('Insufficient data for volume trend analysis');
      }

      // Calculate volume trend
      const recentVolume = volumeData.slice(-10);
      const earlierVolume = volumeData.slice(-20, -10);
      
      const recentAvg = recentVolume.reduce((sum, v) => sum + v.volume, 0) / recentVolume.length;
      const earlierAvg = earlierVolume.reduce((sum, v) => sum + v.volume, 0) / earlierVolume.length;
      
      const volumeChange = (recentAvg - earlierAvg) / earlierAvg;
      
      let trend: 'increasing' | 'decreasing' | 'neutral' = 'neutral';
      let strength: 'weak' | 'moderate' | 'strong' = 'weak';
      
      if (Math.abs(volumeChange) > 0.2) {
        strength = 'strong';
      } else if (Math.abs(volumeChange) > 0.1) {
        strength = 'moderate';
      }
      
      if (volumeChange > 0.05) {
        trend = 'increasing';
      } else if (volumeChange < -0.05) {
        trend = 'decreasing';
      }

      return {
        trend,
        strength,
        volumeChange: volumeChange * 100,
        recentAverage: recentAvg,
        historicalAverage: earlierAvg
      };
    } catch (error) {
      console.error('Error analyzing volume trends:', error);
      throw error;
    }
  }

  // Order book and market depth functionality
  async getOrderBook(symbol: string): Promise<OrderBook> {
    try {
      // Mock order book data for development
      const bids: OrderBookLevel[] = [];
      const asks: OrderBookLevel[] = [];
      
      const midPrice = 50000; // Mock BTC price
      let bidTotal = 0;
      let askTotal = 0;
      
      // Generate realistic order book data
      for (let i = 0; i < 20; i++) {
        const bidPrice = midPrice - (i + 1) * 0.5;
        const askPrice = midPrice + (i + 1) * 0.5;
        
        const bidQuantity = 0.1 + Math.random() * 2;
        const askQuantity = 0.1 + Math.random() * 2;
        
        bidTotal += bidQuantity;
        askTotal += askQuantity;
        
        bids.push({
          price: bidPrice,
          quantity: bidQuantity,
          total: bidTotal
        });
        
        asks.push({
          price: askPrice,
          quantity: askQuantity,
          total: askTotal
        });
      }
      
      return {
        bids: bids.reverse(), // Highest bids first
        asks: asks, // Lowest asks first
        spread: asks[0].price - bids[0].price,
        mid: (asks[0].price + bids[0].price) / 2,
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('Error fetching order book:', error);
      throw error;
    }
  }

  async getMarketDepth(symbol: string, levels: number = 50): Promise<MarketDepth> {
    try {
      const orderBook = await this.getOrderBook(symbol);
      
      const depthLevels = [];
      let maxQuantity = 0;
      
      const maxLevels = Math.min(levels, Math.max(orderBook.bids.length, orderBook.asks.length));
      
      for (let i = 0; i < maxLevels; i++) {
        const bid = orderBook.bids[i] || { price: 0, quantity: 0, total: 0 };
        const ask = orderBook.asks[i] || { price: 0, quantity: 0, total: 0 };
        
        const level = {
          price: ask.price || bid.price,
          bidQuantity: bid.quantity,
          askQuantity: ask.quantity,
          bidTotal: bid.total,
          askTotal: ask.total
        };
        
        maxQuantity = Math.max(maxQuantity, bid.quantity, ask.quantity);
        depthLevels.push(level);
      }
      
      // Calculate liquidity score (0-10)
      const totalDepth = orderBook.bids.reduce((sum, bid) => sum + bid.quantity, 0) +
                         orderBook.asks.reduce((sum, ask) => sum + ask.quantity, 0);
      const liquidityScore = Math.min(10, Math.max(0, Math.log10(totalDepth)));
      
      return {
        levels: depthLevels,
        maxQuantity,
        liquidityScore
      };
    } catch (error) {
      console.error('Error calculating market depth:', error);
      throw error;
    }
  }

  async getTimeAndSales(symbol: string, limit: number = 100): Promise<TimeAndSalesEntry[]> {
    try {
      // Mock time and sales data
      const entries: TimeAndSalesEntry[] = [];
      const now = Date.now();
      const midPrice = 50000;
      
      for (let i = 0; i < limit; i++) {
        const timestamp = now - (i * 1000); // 1 second intervals
        const price = midPrice + (Math.random() - 0.5) * 100;
        const quantity = 0.01 + Math.random() * 0.5;
        const side: 'buy' | 'sell' = Math.random() > 0.5 ? 'buy' : 'sell';
        
        entries.push({
          timestamp,
          price,
          quantity,
          side,
          id: `${timestamp}-${Math.random().toString(36).substr(2, 9)}`
        });
      }
      
      return entries.sort((a, b) => b.timestamp - a.timestamp);
    } catch (error) {
      console.error('Error fetching time and sales:', error);
      throw error;
    }
  }

  async getLiquidityMetrics(symbol: string): Promise<LiquidityMetrics> {
    try {
      const orderBook = await this.getOrderBook(symbol);
      
      const bestBid = orderBook.bids[0];
      const bestAsk = orderBook.asks[0];
      
      const spread = bestAsk.price - bestBid.price;
      const spreadPercentage = (spread / orderBook.mid) * 100;
      
      // Calculate market impact for a $10,000 trade
      const tradeSize = 10000;
      const shareSize = tradeSize / orderBook.mid;
      
      let marketImpact = 0;
      let remainingShares = shareSize;
      
      for (const ask of orderBook.asks) {
        if (remainingShares <= 0) break;
        
        const sharesToTake = Math.min(remainingShares, ask.quantity);
        const impactPrice = ask.price;
        const impact = ((impactPrice - orderBook.mid) / orderBook.mid) * 100;
        
        marketImpact += impact * (sharesToTake / shareSize);
        remainingShares -= sharesToTake;
      }
      
      // Calculate total depth within 2% of mid price
      const priceRange = orderBook.mid * 0.02;
      const bidDepth = orderBook.bids
        .filter(bid => bid.price >= orderBook.mid - priceRange)
        .reduce((sum, bid) => sum + bid.quantity * bid.price, 0);
      const askDepth = orderBook.asks
        .filter(ask => ask.price <= orderBook.mid + priceRange)
        .reduce((sum, ask) => sum + ask.quantity * ask.price, 0);
      
      const totalDepth = bidDepth + askDepth;
      
      // Calculate order book imbalance
      const bidQuantity = orderBook.bids.slice(0, 10).reduce((sum, bid) => sum + bid.quantity, 0);
      const askQuantity = orderBook.asks.slice(0, 10).reduce((sum, ask) => sum + ask.quantity, 0);
      const imbalance = (bidQuantity - askQuantity) / (bidQuantity + askQuantity);
      
      // Liquidity score (0-10)
      const liquidityScore = Math.min(10, Math.max(0, 
        10 - (spreadPercentage * 2) - (marketImpact * 0.5) + Math.log10(totalDepth / 1000000)
      ));
      
      return {
        spread,
        spreadPercentage,
        marketImpact,
        liquidityScore,
        totalDepth,
        imbalance
      };
    } catch (error) {
      console.error('Error calculating liquidity metrics:', error);
      throw error;
    }
  }
}

export default VolumeAnalysisService;
export type {
  VolumeData,
  VolumeProfileLevel,
  VWAPData,
  VolumeIndicators,
  VolumeTrends,
  OrderBook,
  MarketDepth,
  TimeAndSalesEntry,
  LiquidityMetrics
};