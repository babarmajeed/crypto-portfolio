// Technical Analysis Service for calculating various indicators

interface CandlestickData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

interface IndicatorData {
  time: number;
  value: number;
}

interface MACDData {
  time: number;
  macd: number;
  signal: number;
  histogram: number;
}

interface BollingerBandsData {
  time: number;
  upper: number;
  middle: number;
  lower: number;
}

interface StochasticData {
  time: number;
  k: number;
  d: number;
}

interface RSIData {
  time: number;
  value: number;
  overbought?: boolean;
  oversold?: boolean;
}

class TechnicalAnalysisService {
  // Simple Moving Average
  calculateSMA(data: CandlestickData[], period: number): IndicatorData[] {
    if (data.length < period) return [];
    
    const result: IndicatorData[] = [];
    
    for (let i = period - 1; i < data.length; i++) {
      let sum = 0;
      for (let j = 0; j < period; j++) {
        sum += data[i - j].close;
      }
      
      result.push({
        time: data[i].time,
        value: sum / period
      });
    }
    
    return result;
  }

  // Exponential Moving Average
  calculateEMA(data: CandlestickData[], period: number): IndicatorData[] {
    if (data.length < period) return [];
    
    const result: IndicatorData[] = [];
    const multiplier = 2 / (period + 1);
    
    // Calculate initial SMA
    let sum = 0;
    for (let i = 0; i < period; i++) {
      sum += data[i].close;
    }
    const initialEMA = sum / period;
    
    result.push({
      time: data[period - 1].time,
      value: initialEMA
    });
    
    // Calculate EMA for remaining data points
    let previousEMA = initialEMA;
    for (let i = period; i < data.length; i++) {
      const ema = (data[i].close * multiplier) + (previousEMA * (1 - multiplier));
      result.push({
        time: data[i].time,
        value: ema
      });
      previousEMA = ema;
    }
    
    return result;
  }

  // Relative Strength Index
  calculateRSI(data: CandlestickData[], period: number = 14): RSIData[] {
    if (data.length <= period) return [];
    
    const result: RSIData[] = [];
    const gains: number[] = [];
    const losses: number[] = [];
    
    // Calculate initial gains and losses
    for (let i = 1; i <= period; i++) {
      const change = data[i].close - data[i - 1].close;
      gains.push(change > 0 ? change : 0);
      losses.push(change < 0 ? Math.abs(change) : 0);
    }
    
    // Calculate initial averages
    let avgGain = gains.reduce((sum, gain) => sum + gain, 0) / period;
    let avgLoss = losses.reduce((sum, loss) => sum + loss, 0) / period;
    
    // Calculate RSI for initial period
    const rs = avgGain / avgLoss;
    const rsi = 100 - (100 / (1 + rs));
    
    result.push({
      time: data[period].time,
      value: rsi,
      overbought: rsi > 70,
      oversold: rsi < 30
    });
    
    // Calculate remaining RSI values using smoothed averages
    for (let i = period + 1; i < data.length; i++) {
      const change = data[i].close - data[i - 1].close;
      const gain = change > 0 ? change : 0;
      const loss = change < 0 ? Math.abs(change) : 0;
      
      avgGain = ((avgGain * (period - 1)) + gain) / period;
      avgLoss = ((avgLoss * (period - 1)) + loss) / period;
      
      const newRs = avgGain / avgLoss;
      const newRsi = 100 - (100 / (1 + newRs));
      
      result.push({
        time: data[i].time,
        value: newRsi,
        overbought: newRsi > 70,
        oversold: newRsi < 30
      });
    }
    
    return result;
  }

  // MACD (Moving Average Convergence Divergence)
  calculateMACD(
    data: CandlestickData[], 
    fastPeriod: number = 12, 
    slowPeriod: number = 26, 
    signalPeriod: number = 9
  ): MACDData[] {
    if (data.length < slowPeriod + signalPeriod) return [];
    
    // Calculate EMAs
    const fastEMA = this.calculateEMA(data, fastPeriod);
    const slowEMA = this.calculateEMA(data, slowPeriod);
    
    // Calculate MACD line
    const macdLine: IndicatorData[] = [];
    const startIndex = slowPeriod - fastPeriod;
    
    for (let i = 0; i < slowEMA.length; i++) {
      const fastValue = fastEMA[i + startIndex];
      const slowValue = slowEMA[i];
      
      if (fastValue && slowValue && fastValue.time === slowValue.time) {
        macdLine.push({
          time: slowValue.time,
          value: fastValue.value - slowValue.value
        });
      }
    }
    
    // Calculate Signal line (EMA of MACD)
    const signalLine = this.calculateEMAFromValues(macdLine, signalPeriod);
    
    // Calculate Histogram and combine results
    const result: MACDData[] = [];
    for (let i = 0; i < signalLine.length; i++) {
      const macdValue = macdLine[i + (macdLine.length - signalLine.length)];
      const signalValue = signalLine[i];
      
      if (macdValue && signalValue && macdValue.time === signalValue.time) {
        result.push({
          time: macdValue.time,
          macd: macdValue.value,
          signal: signalValue.value,
          histogram: macdValue.value - signalValue.value
        });
      }
    }
    
    return result;
  }

  // Bollinger Bands
  calculateBollingerBands(
    data: CandlestickData[], 
    period: number = 20, 
    stdDevMultiplier: number = 2
  ): BollingerBandsData[] {
    if (data.length < period) return [];
    
    const result: BollingerBandsData[] = [];
    const sma = this.calculateSMA(data, period);
    
    for (let i = 0; i < sma.length; i++) {
      const dataIndex = i + period - 1;
      const currentTime = data[dataIndex].time;
      const middleBand = sma[i].value;
      
      // Calculate standard deviation
      let sumSquaredDifferences = 0;
      for (let j = 0; j < period; j++) {
        const difference = data[dataIndex - j].close - middleBand;
        sumSquaredDifferences += difference * difference;
      }
      
      const standardDeviation = Math.sqrt(sumSquaredDifferences / period);
      const bandWidth = standardDeviation * stdDevMultiplier;
      
      result.push({
        time: currentTime,
        upper: middleBand + bandWidth,
        middle: middleBand,
        lower: middleBand - bandWidth
      });
    }
    
    return result;
  }

  // Stochastic Oscillator
  calculateStochastic(
    data: CandlestickData[], 
    kPeriod: number = 14, 
    dPeriod: number = 3
  ): StochasticData[] {
    if (data.length < kPeriod + dPeriod) return [];
    
    const kValues: IndicatorData[] = [];
    
    // Calculate %K values
    for (let i = kPeriod - 1; i < data.length; i++) {
      let lowestLow = Infinity;
      let highestHigh = -Infinity;
      
      // Find highest high and lowest low in the period
      for (let j = 0; j < kPeriod; j++) {
        const candle = data[i - j];
        if (candle.high > highestHigh) highestHigh = candle.high;
        if (candle.low < lowestLow) lowestLow = candle.low;
      }
      
      const currentClose = data[i].close;
      const kValue = ((currentClose - lowestLow) / (highestHigh - lowestLow)) * 100;
      
      kValues.push({
        time: data[i].time,
        value: kValue
      });
    }
    
    // Calculate %D values (SMA of %K)
    const dValues = this.calculateSMAFromValues(kValues, dPeriod);
    
    // Combine results
    const result: StochasticData[] = [];
    for (let i = 0; i < dValues.length; i++) {
      const kIndex = i + (kValues.length - dValues.length);
      const kValue = kValues[kIndex];
      const dValue = dValues[i];
      
      if (kValue && dValue && kValue.time === dValue.time) {
        result.push({
          time: kValue.time,
          k: kValue.value,
          d: dValue.value
        });
      }
    }
    
    return result;
  }

  // Williams %R
  calculateWilliamsR(data: CandlestickData[], period: number = 14): IndicatorData[] {
    if (data.length < period) return [];
    
    const result: IndicatorData[] = [];
    
    for (let i = period - 1; i < data.length; i++) {
      let highestHigh = -Infinity;
      let lowestLow = Infinity;
      
      // Find highest high and lowest low in the period
      for (let j = 0; j < period; j++) {
        const candle = data[i - j];
        if (candle.high > highestHigh) highestHigh = candle.high;
        if (candle.low < lowestLow) lowestLow = candle.low;
      }
      
      const currentClose = data[i].close;
      const williamsR = ((highestHigh - currentClose) / (highestHigh - lowestLow)) * -100;
      
      result.push({
        time: data[i].time,
        value: williamsR
      });
    }
    
    return result;
  }

  // Average True Range (ATR)
  calculateATR(data: CandlestickData[], period: number = 14): IndicatorData[] {
    if (data.length < period + 1) return [];
    
    const trueRanges: number[] = [];
    
    // Calculate True Range values
    for (let i = 1; i < data.length; i++) {
      const high = data[i].high;
      const low = data[i].low;
      const previousClose = data[i - 1].close;
      
      const tr1 = high - low;
      const tr2 = Math.abs(high - previousClose);
      const tr3 = Math.abs(low - previousClose);
      
      trueRanges.push(Math.max(tr1, tr2, tr3));
    }
    
    // Calculate ATR using SMA of True Range
    const result: IndicatorData[] = [];
    
    for (let i = period - 1; i < trueRanges.length; i++) {
      let sum = 0;
      for (let j = 0; j < period; j++) {
        sum += trueRanges[i - j];
      }
      
      result.push({
        time: data[i + 1].time, // +1 because trueRanges starts from index 1
        value: sum / period
      });
    }
    
    return result;
  }

  // Volume Weighted Average Price (VWAP)
  calculateVWAP(data: CandlestickData[]): IndicatorData[] {
    if (data.length === 0) return [];
    
    const result: IndicatorData[] = [];
    let cumulativeVolumePrice = 0;
    let cumulativeVolume = 0;
    
    for (let i = 0; i < data.length; i++) {
      const candle = data[i];
      if (!candle.volume) continue;
      
      const typicalPrice = (candle.high + candle.low + candle.close) / 3;
      const volumePrice = typicalPrice * candle.volume;
      
      cumulativeVolumePrice += volumePrice;
      cumulativeVolume += candle.volume;
      
      const vwap = cumulativeVolumePrice / cumulativeVolume;
      
      result.push({
        time: candle.time,
        value: vwap
      });
    }
    
    return result;
  }

  // Helper method to calculate EMA from pre-calculated values
  private calculateEMAFromValues(data: IndicatorData[], period: number): IndicatorData[] {
    if (data.length < period) return [];
    
    const result: IndicatorData[] = [];
    const multiplier = 2 / (period + 1);
    
    // Calculate initial SMA
    let sum = 0;
    for (let i = 0; i < period; i++) {
      sum += data[i].value;
    }
    const initialEMA = sum / period;
    
    result.push({
      time: data[period - 1].time,
      value: initialEMA
    });
    
    // Calculate EMA for remaining data points
    let previousEMA = initialEMA;
    for (let i = period; i < data.length; i++) {
      const ema = (data[i].value * multiplier) + (previousEMA * (1 - multiplier));
      result.push({
        time: data[i].time,
        value: ema
      });
      previousEMA = ema;
    }
    
    return result;
  }

  // Helper method to calculate SMA from pre-calculated values
  private calculateSMAFromValues(data: IndicatorData[], period: number): IndicatorData[] {
    if (data.length < period) return [];
    
    const result: IndicatorData[] = [];
    
    for (let i = period - 1; i < data.length; i++) {
      let sum = 0;
      for (let j = 0; j < period; j++) {
        sum += data[i - j].value;
      }
      
      result.push({
        time: data[i].time,
        value: sum / period
      });
    }
    
    return result;
  }

  // Pattern Recognition Methods
  
  // Detect Doji candlestick pattern
  detectDoji(candle: CandlestickData, threshold: number = 0.1): boolean {
    const bodySize = Math.abs(candle.close - candle.open);
    const totalRange = candle.high - candle.low;
    
    return totalRange > 0 && (bodySize / totalRange) <= threshold;
  }

  // Detect Hammer candlestick pattern
  detectHammer(candle: CandlestickData): boolean {
    const bodySize = Math.abs(candle.close - candle.open);
    const lowerShadow = Math.min(candle.open, candle.close) - candle.low;
    const upperShadow = candle.high - Math.max(candle.open, candle.close);
    
    return lowerShadow >= bodySize * 2 && upperShadow <= bodySize * 0.5;
  }

  // Detect Shooting Star candlestick pattern
  detectShootingStar(candle: CandlestickData): boolean {
    const bodySize = Math.abs(candle.close - candle.open);
    const lowerShadow = Math.min(candle.open, candle.close) - candle.low;
    const upperShadow = candle.high - Math.max(candle.open, candle.close);
    
    return upperShadow >= bodySize * 2 && lowerShadow <= bodySize * 0.5;
  }

  // Detect Bullish Engulfing pattern
  detectBullishEngulfing(current: CandlestickData, previous: CandlestickData): boolean {
    const prevIsBearish = previous.close < previous.open;
    const currentIsBullish = current.close > current.open;
    const currentEngulfsPrevious = current.open < previous.close && current.close > previous.open;
    
    return prevIsBearish && currentIsBullish && currentEngulfsPrevious;
  }

  // Detect Bearish Engulfing pattern
  detectBearishEngulfing(current: CandlestickData, previous: CandlestickData): boolean {
    const prevIsBullish = previous.close > previous.open;
    const currentIsBearish = current.close < current.open;
    const currentEngulfsPrevious = current.open > previous.close && current.close < previous.open;
    
    return prevIsBullish && currentIsBearish && currentEngulfsPrevious;
  }

  // Support and Resistance Level Detection
  findSupportResistanceLevels(data: CandlestickData[], lookback: number = 20): { support: number[]; resistance: number[] } {
    if (data.length < lookback * 2) return { support: [], resistance: [] };
    
    const support: number[] = [];
    const resistance: number[] = [];
    
    for (let i = lookback; i < data.length - lookback; i++) {
      const currentLow = data[i].low;
      const currentHigh = data[i].high;
      
      // Check for support (local minimum)
      let isLocalMinimum = true;
      for (let j = i - lookback; j <= i + lookback; j++) {
        if (j !== i && data[j].low < currentLow) {
          isLocalMinimum = false;
          break;
        }
      }
      
      if (isLocalMinimum) {
        support.push(currentLow);
      }
      
      // Check for resistance (local maximum)
      let isLocalMaximum = true;
      for (let j = i - lookback; j <= i + lookback; j++) {
        if (j !== i && data[j].high > currentHigh) {
          isLocalMaximum = false;
          break;
        }
      }
      
      if (isLocalMaximum) {
        resistance.push(currentHigh);
      }
    }
    
    return { support, resistance };
  }
}

// Export singleton instance
export const technicalAnalysisService = new TechnicalAnalysisService();
export default technicalAnalysisService;