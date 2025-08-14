import VolumeAnalysisService, { VolumeData } from '../services/VolumeAnalysisService';

describe('VolumeAnalysisService', () => {
  let service: VolumeAnalysisService;
  let mockVolumeData: VolumeData[];

  beforeEach(() => {
    service = new VolumeAnalysisService();
    
    // Create mock volume data for testing
    mockVolumeData = [
      {
        timestamp: 1640995200000, // 2022-01-01 00:00:00
        volume: 1000,
        price: 50000,
        high: 50500,
        low: 49500,
        open: 50000,
        buyVolume: 600,
        sellVolume: 400
      },
      {
        timestamp: 1641081600000, // 2022-01-02 00:00:00
        volume: 1500,
        price: 51000,
        high: 51200,
        low: 49800,
        open: 50000,
        buyVolume: 900,
        sellVolume: 600
      },
      {
        timestamp: 1641168000000, // 2022-01-03 00:00:00
        volume: 800,
        price: 49000,
        high: 51000,
        low: 48500,
        open: 51000,
        buyVolume: 320,
        sellVolume: 480
      },
      {
        timestamp: 1641254400000, // 2022-01-04 00:00:00
        volume: 1200,
        price: 52000,
        high: 52500,
        low: 48800,
        open: 49000,
        buyVolume: 720,
        sellVolume: 480
      },
      {
        timestamp: 1641340800000, // 2022-01-05 00:00:00
        volume: 2000,
        price: 53000,
        high: 53500,
        low: 51800,
        open: 52000,
        buyVolume: 1400,
        sellVolume: 600
      }
    ];
  });

  describe('Volume Data Generation', () => {
    it('should generate mock volume data with correct structure', async () => {
      const data = await service.getVolumeData('BTC/USD', '1h', 10);
      
      expect(data).toHaveLength(10);
      expect(data[0]).toHaveProperty('timestamp');
      expect(data[0]).toHaveProperty('volume');
      expect(data[0]).toHaveProperty('price');
      expect(data[0]).toHaveProperty('high');
      expect(data[0]).toHaveProperty('low');
      expect(data[0]).toHaveProperty('open');
      expect(data[0]).toHaveProperty('buyVolume');
      expect(data[0]).toHaveProperty('sellVolume');
    });

    it('should generate realistic price movements', async () => {
      const data = await service.getVolumeData('BTC/USD', '1h', 100);
      
      // Check that prices are within reasonable bounds
      const prices = data.map(d => d.price);
      const minPrice = Math.min(...prices);
      const maxPrice = Math.max(...prices);
      
      expect(minPrice).toBeGreaterThan(0);
      expect(maxPrice / minPrice).toBeLessThan(2); // Price shouldn't double in 100 periods
    });

    it('should have buy and sell volumes sum to total volume', async () => {
      const data = await service.getVolumeData('BTC/USD', '1h', 10);
      
      data.forEach(d => {
        expect(Math.abs(d.volume - (d.buyVolume + d.sellVolume))).toBeLessThan(0.01);
      });
    });
  });

  describe('VWAP Calculations', () => {
    it('should calculate VWAP correctly', async () => {
      // Mock the getVolumeData method to return our test data
      jest.spyOn(service, 'getVolumeData').mockResolvedValue(mockVolumeData);
      
      const vwapData = await service.calculateVWAP('BTC/USD', '1h');
      
      expect(vwapData).toBeDefined();
      expect(vwapData.current).toBeGreaterThan(0);
      expect(vwapData.series).toHaveLength(mockVolumeData.length);
      
      // Calculate expected VWAP manually for first data point
      const firstPoint = mockVolumeData[0];
      const typicalPrice = (firstPoint.high + firstPoint.low + firstPoint.price) / 3;
      const expectedVWAP = (typicalPrice * firstPoint.volume) / firstPoint.volume;
      
      expect(Math.abs(vwapData.series[0].vwap - expectedVWAP)).toBeLessThan(0.01);
    });

    it('should calculate VWAP deviation correctly', async () => {
      jest.spyOn(service, 'getVolumeData').mockResolvedValue(mockVolumeData);
      
      const vwapData = await service.calculateVWAP('BTC/USD', '1h');
      const lastPoint = vwapData.series[vwapData.series.length - 1];
      const lastPrice = mockVolumeData[mockVolumeData.length - 1].price;
      
      const expectedDeviation = ((lastPrice - lastPoint.vwap) / lastPoint.vwap) * 100;
      expect(Math.abs(vwapData.deviation - expectedDeviation)).toBeLessThan(0.01);
    });
  });

  describe('Volume Indicators', () => {
    beforeEach(() => {
      jest.spyOn(service, 'getVolumeData').mockResolvedValue(mockVolumeData);
    });

    it('should calculate OBV correctly', async () => {
      const indicators = await service.calculateVolumeIndicators('BTC/USD', '1h');
      
      expect(indicators.obv).toHaveLength(mockVolumeData.length);
      expect(indicators.obv[0].value).toBe(0); // First OBV value should be 0
      
      // Manually calculate expected OBV values
      let expectedOBV = 0;
      for (let i = 1; i < mockVolumeData.length; i++) {
        const current = mockVolumeData[i];
        const previous = mockVolumeData[i - 1];
        
        if (current.price > previous.price) {
          expectedOBV += current.volume;
        } else if (current.price < previous.price) {
          expectedOBV -= current.volume;
        }
        
        expect(Math.abs(indicators.obv[i].value - expectedOBV)).toBeLessThan(0.01);
      }
    });

    it('should calculate Accumulation/Distribution correctly', async () => {
      const indicators = await service.calculateVolumeIndicators('BTC/USD', '1h');
      
      expect(indicators.ad).toHaveLength(mockVolumeData.length);
      expect(indicators.ad[0].value).toBe(0); // First A/D value should be 0
      
      // Verify A/D calculation for second data point
      const point = mockVolumeData[1];
      const range = point.high - point.low;
      const clv = range > 0 ? ((point.price - point.low) - (point.high - point.price)) / range : 0;
      const expectedAD = clv * point.volume;
      
      expect(Math.abs(indicators.ad[1].value - expectedAD)).toBeLessThan(0.01);
    });

    it('should calculate CMF within valid range', async () => {
      const indicators = await service.calculateVolumeIndicators('BTC/USD', '1h');
      
      expect(indicators.cmf).toHaveLength(mockVolumeData.length - 19); // CMF uses 20-period window
      
      // CMF should be between -1 and 1
      indicators.cmf.forEach(point => {
        expect(point.value).toBeGreaterThanOrEqual(-1);
        expect(point.value).toBeLessThanOrEqual(1);
      });
    });

    it('should calculate VPT correctly', async () => {
      const indicators = await service.calculateVolumeIndicators('BTC/USD', '1h');
      
      expect(indicators.vpt).toHaveLength(mockVolumeData.length);
      expect(indicators.vpt[0].value).toBe(0); // First VPT value should be 0
      
      // Manually calculate expected VPT for second data point
      const current = mockVolumeData[1];
      const previous = mockVolumeData[0];
      const percentChange = (current.price - previous.price) / previous.price;
      const expectedVPT = current.volume * percentChange;
      
      expect(Math.abs(indicators.vpt[1].value - expectedVPT)).toBeLessThan(0.01);
    });
  });

  describe('Volume Profile', () => {
    it('should calculate volume profile correctly', async () => {
      jest.spyOn(service, 'getVolumeData').mockResolvedValue(mockVolumeData);
      
      const profile = await service.calculateVolumeProfile('BTC/USD', '1h', 10);
      
      expect(profile.length).toBeGreaterThan(0);
      expect(profile.length).toBeLessThanOrEqual(10);
      
      // Check that profile is sorted by volume (descending)
      for (let i = 1; i < profile.length; i++) {
        expect(profile[i].volume).toBeLessThanOrEqual(profile[i - 1].volume);
      }
      
      // Verify that all volume is accounted for
      const totalProfileVolume = profile.reduce((sum, level) => sum + level.volume, 0);
      const totalDataVolume = mockVolumeData.reduce((sum, d) => sum + d.volume, 0);
      
      // Allow for some rounding differences in volume distribution
      expect(Math.abs(totalProfileVolume - totalDataVolume)).toBeLessThan(totalDataVolume * 0.1);
    });

    it('should have Point of Control as highest volume level', async () => {
      jest.spyOn(service, 'getVolumeData').mockResolvedValue(mockVolumeData);
      
      const profile = await service.calculateVolumeProfile('BTC/USD', '1h', 10);
      
      if (profile.length > 0) {
        const poc = profile[0]; // First element should be POC (highest volume)
        
        profile.forEach(level => {
          expect(level.volume).toBeLessThanOrEqual(poc.volume);
        });
      }
    });
  });

  describe('Order Book Simulation', () => {
    it('should generate realistic order book', async () => {
      const orderBook = await service.getOrderBook('BTC/USD');
      
      expect(orderBook.bids).toHaveLength(20);
      expect(orderBook.asks).toHaveLength(20);
      expect(orderBook.spread).toBeGreaterThan(0);
      expect(orderBook.mid).toBeGreaterThan(0);
      
      // Bids should be sorted descending
      for (let i = 1; i < orderBook.bids.length; i++) {
        expect(orderBook.bids[i].price).toBeLessThan(orderBook.bids[i - 1].price);
      }
      
      // Asks should be sorted ascending
      for (let i = 1; i < orderBook.asks.length; i++) {
        expect(orderBook.asks[i].price).toBeGreaterThan(orderBook.asks[i - 1].price);
      }
      
      // Spread calculation should be correct
      const expectedSpread = orderBook.asks[0].price - orderBook.bids[0].price;
      expect(Math.abs(orderBook.spread - expectedSpread)).toBeLessThan(0.01);
      
      // Mid price should be between best bid and ask
      expect(orderBook.mid).toBeGreaterThan(orderBook.bids[0].price);
      expect(orderBook.mid).toBeLessThan(orderBook.asks[0].price);
    });

    it('should have cumulative totals in order book', async () => {
      const orderBook = await service.getOrderBook('BTC/USD');
      
      // Check cumulative totals for bids
      let cumulativeBid = 0;
      orderBook.bids.forEach(bid => {
        cumulativeBid += bid.quantity;
        expect(Math.abs(bid.total - cumulativeBid)).toBeLessThan(0.01);
      });
      
      // Check cumulative totals for asks
      let cumulativeAsk = 0;
      orderBook.asks.forEach(ask => {
        cumulativeAsk += ask.quantity;
        expect(Math.abs(ask.total - cumulativeAsk)).toBeLessThan(0.01);
      });
    });
  });

  describe('Market Depth', () => {
    it('should calculate market depth correctly', async () => {
      jest.spyOn(service, 'getOrderBook').mockResolvedValue({
        bids: [
          { price: 49995, quantity: 1.0, total: 1.0 },
          { price: 49990, quantity: 1.5, total: 2.5 }
        ],
        asks: [
          { price: 50005, quantity: 1.2, total: 1.2 },
          { price: 50010, quantity: 0.8, total: 2.0 }
        ],
        spread: 10,
        mid: 50000,
        timestamp: Date.now()
      });
      
      const depth = await service.getMarketDepth('BTC/USD', 2);
      
      expect(depth.levels).toHaveLength(2);
      expect(depth.maxQuantity).toBeGreaterThan(0);
      expect(depth.liquidityScore).toBeGreaterThanOrEqual(0);
      expect(depth.liquidityScore).toBeLessThanOrEqual(10);
    });
  });

  describe('Liquidity Metrics', () => {
    it('should calculate liquidity metrics correctly', async () => {
      const mockOrderBook = {
        bids: [
          { price: 49995, quantity: 1.0, total: 1.0 },
          { price: 49990, quantity: 1.5, total: 2.5 }
        ],
        asks: [
          { price: 50005, quantity: 1.2, total: 1.2 },
          { price: 50010, quantity: 0.8, total: 2.0 }
        ],
        spread: 10,
        mid: 50000,
        timestamp: Date.now()
      };
      
      jest.spyOn(service, 'getOrderBook').mockResolvedValue(mockOrderBook);
      
      const metrics = await service.getLiquidityMetrics('BTC/USD');
      
      expect(metrics.spread).toBe(10);
      expect(metrics.spreadPercentage).toBe(0.02); // 10/50000 * 100
      expect(metrics.liquidityScore).toBeGreaterThanOrEqual(0);
      expect(metrics.liquidityScore).toBeLessThanOrEqual(10);
      expect(metrics.totalDepth).toBeGreaterThan(0);
      expect(metrics.imbalance).toBeGreaterThanOrEqual(-1);
      expect(metrics.imbalance).toBeLessThanOrEqual(1);
    });
  });

  describe('Volume Trends', () => {
    it('should analyze volume trends correctly', async () => {
      jest.spyOn(service, 'getVolumeData').mockResolvedValue(mockVolumeData);
      
      const trends = await service.analyzeVolumeTrends('BTC/USD', '1h');
      
      expect(['increasing', 'decreasing', 'neutral']).toContain(trends.trend);
      expect(['weak', 'moderate', 'strong']).toContain(trends.strength);
      expect(trends.volumeChange).toBeGreaterThanOrEqual(-100);
      expect(trends.recentAverage).toBeGreaterThan(0);
      expect(trends.historicalAverage).toBeGreaterThan(0);
    });
  });

  describe('Time and Sales', () => {
    it('should generate realistic time and sales data', async () => {
      const trades = await service.getTimeAndSales('BTC/USD', 10);
      
      expect(trades).toHaveLength(10);
      
      trades.forEach(trade => {
        expect(trade.timestamp).toBeGreaterThan(0);
        expect(trade.price).toBeGreaterThan(0);
        expect(trade.quantity).toBeGreaterThan(0);
        expect(['buy', 'sell']).toContain(trade.side);
        expect(trade.id).toBeDefined();
      });
      
      // Should be sorted by timestamp descending
      for (let i = 1; i < trades.length; i++) {
        expect(trades[i].timestamp).toBeLessThanOrEqual(trades[i - 1].timestamp);
      }
    });
  });
});

// Test helper functions
export const testVolumeCalculations = {
  calculateManualOBV: (data: VolumeData[]): number[] => {
    const obv = [0];
    for (let i = 1; i < data.length; i++) {
      const current = data[i];
      const previous = data[i - 1];
      const prevOBV = obv[obv.length - 1];
      
      if (current.price > previous.price) {
        obv.push(prevOBV + current.volume);
      } else if (current.price < previous.price) {
        obv.push(prevOBV - current.volume);
      } else {
        obv.push(prevOBV);
      }
    }
    return obv;
  },
  
  calculateManualVWAP: (data: VolumeData[]): number => {
    let cumulativeVolumePrice = 0;
    let cumulativeVolume = 0;
    
    data.forEach(point => {
      const typicalPrice = (point.high + point.low + point.price) / 3;
      cumulativeVolumePrice += typicalPrice * point.volume;
      cumulativeVolume += point.volume;
    });
    
    return cumulativeVolume > 0 ? cumulativeVolumePrice / cumulativeVolume : 0;
  },
  
  validateOrderBookStructure: (orderBook: any): boolean => {
    // Check basic structure
    if (!orderBook.bids || !orderBook.asks || !Array.isArray(orderBook.bids) || !Array.isArray(orderBook.asks)) {
      return false;
    }
    
    // Check sorting
    for (let i = 1; i < orderBook.bids.length; i++) {
      if (orderBook.bids[i].price >= orderBook.bids[i - 1].price) return false;
    }
    
    for (let i = 1; i < orderBook.asks.length; i++) {
      if (orderBook.asks[i].price <= orderBook.asks[i - 1].price) return false;
    }
    
    return true;
  }
};