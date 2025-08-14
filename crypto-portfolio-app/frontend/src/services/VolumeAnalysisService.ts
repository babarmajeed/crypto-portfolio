// Volume Analysis Service for calculating volume-based indicators

interface CandlestickData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

interface VolumeIndicatorData {
  time: number;
  value: number;
}

interface VolumeProfileData {
  price: number;
  volume: number;
  percentage: number;
}

interface OnBalanceVolumeData {
  time: number;
  obv: number;
}

interface VolumeRateOfChangeData {
  time: number;
  vroc: number;
}

interface AccumulationDistributionData {
  time: number;
  ad: number;
}

interface ChaikinMoneyFlowData {
  time: number;
  cmf: number;
}

interface VolumeTrendData {
  time: number;
  trend: 'increasing' | 'decreasing' | 'neutral';
  strength: number; // 0-100
}

class VolumeAnalysisService {
  // Volume Weighted Average Price (VWAP)
  calculateVWAP(data: CandlestickData[]): VolumeIndicatorData[] {
    if (data.length === 0) return [];

    const result: VolumeIndicatorData[] = [];
    let cumulativeVolumePrice = 0;
    let cumulativeVolume = 0;

    for (const candle of data) {
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

  // Volume Moving Average
  calculateVolumeMA(data: CandlestickData[], period: number): VolumeIndicatorData[] {
    if (data.length < period) return [];

    const result: VolumeIndicatorData[] = [];

    for (let i = period - 1; i < data.length; i++) {
      let sum = 0;
      for (let j = 0; j < period; j++) {
        sum += data[i - j].volume || 0;
      }

      result.push({
        time: data[i].time,
        value: sum / period
      });
    }

    return result;
  }

  // On-Balance Volume (OBV)
  calculateOnBalanceVolume(data: CandlestickData[]): OnBalanceVolumeData[] {
    if (data.length < 2) return [];

    const result: OnBalanceVolumeData[] = [];
    let obv = 0;

    // First data point
    result.push({
      time: data[0].time,
      obv: 0
    });

    for (let i = 1; i < data.length; i++) {
      const current = data[i];
      const previous = data[i - 1];

      if (!current.volume) continue;

      if (current.close > previous.close) {
        obv += current.volume;
      } else if (current.close < previous.close) {
        obv -= current.volume;
      }
      // If close === previous.close, OBV doesn't change

      result.push({
        time: current.time,
        obv
      });
    }

    return result;
  }

  // Volume Rate of Change (VROC)
  calculateVolumeRateOfChange(data: CandlestickData[], period: number = 12): VolumeRateOfChangeData[] {
    if (data.length < period + 1) return [];

    const result: VolumeRateOfChangeData[] = [];

    for (let i = period; i < data.length; i++) {
      const currentVolume = data[i].volume || 0;
      const pastVolume = data[i - period].volume || 0;

      const vroc = pastVolume !== 0 ? ((currentVolume - pastVolume) / pastVolume) * 100 : 0;

      result.push({
        time: data[i].time,
        vroc
      });
    }

    return result;
  }

  // Accumulation/Distribution Line
  calculateAccumulationDistribution(data: CandlestickData[]): AccumulationDistributionData[] {
    if (data.length === 0) return [];

    const result: AccumulationDistributionData[] = [];
    let ad = 0;

    for (const candle of data) {
      if (!candle.volume) continue;

      const clv = ((candle.close - candle.low) - (candle.high - candle.close)) / (candle.high - candle.low);
      const adValue = clv * candle.volume;
      ad += adValue;

      result.push({
        time: candle.time,
        ad
      });
    }

    return result;
  }

  // Chaikin Money Flow
  calculateChaikinMoneyFlow(data: CandlestickData[], period: number = 20): ChaikinMoneyFlowData[] {
    if (data.length < period) return [];

    const result: ChaikinMoneyFlowData[] = [];

    for (let i = period - 1; i < data.length; i++) {
      let sumMoneyFlowVolume = 0;
      let sumVolume = 0;

      for (let j = 0; j < period; j++) {
        const candle = data[i - j];
        if (!candle.volume) continue;

        const clv = candle.high !== candle.low 
          ? ((candle.close - candle.low) - (candle.high - candle.close)) / (candle.high - candle.low)
          : 0;
        
        sumMoneyFlowVolume += clv * candle.volume;
        sumVolume += candle.volume;
      }

      const cmf = sumVolume !== 0 ? sumMoneyFlowVolume / sumVolume : 0;

      result.push({
        time: data[i].time,
        cmf
      });
    }

    return result;
  }

  // Volume Profile (Price-Volume distribution)
  calculateVolumeProfile(data: CandlestickData[], bins: number = 24): VolumeProfileData[] {
    if (data.length === 0) return [];

    // Find price range
    let minPrice = Infinity;
    let maxPrice = -Infinity;

    for (const candle of data) {
      minPrice = Math.min(minPrice, candle.low);
      maxPrice = Math.max(maxPrice, candle.high);
    }

    const priceStep = (maxPrice - minPrice) / bins;
    const volumeProfile: { [price: number]: number } = {};

    // Initialize bins
    for (let i = 0; i < bins; i++) {
      const price = minPrice + (i * priceStep);
      volumeProfile[price] = 0;
    }

    // Distribute volume across price levels
    for (const candle of data) {
      if (!candle.volume) continue;

      const typicalPrice = (candle.high + candle.low + candle.close) / 3;
      const binIndex = Math.floor((typicalPrice - minPrice) / priceStep);
      const binPrice = minPrice + (binIndex * priceStep);

      if (volumeProfile[binPrice] !== undefined) {
        volumeProfile[binPrice] += candle.volume;
      }
    }

    // Calculate total volume for percentages
    const totalVolume = Object.values(volumeProfile).reduce((sum, vol) => sum + vol, 0);

    // Convert to result array
    const result: VolumeProfileData[] = [];
    for (const [priceStr, volume] of Object.entries(volumeProfile)) {
      const price = parseFloat(priceStr);
      const percentage = totalVolume > 0 ? (volume / totalVolume) * 100 : 0;

      result.push({
        price,
        volume,
        percentage
      });
    }

    return result.sort((a, b) => a.price - b.price);
  }

  // Volume Trend Analysis
  calculateVolumeTrend(data: CandlestickData[], period: number = 10): VolumeTrendData[] {
    if (data.length < period + 1) return [];

    const result: VolumeTrendData[] = [];

    for (let i = period; i < data.length; i++) {
      const recentVolumes = data.slice(i - period, i).map(d => d.volume || 0);
      const currentVolume = data[i].volume || 0;

      const averageVolume = recentVolumes.reduce((sum, vol) => sum + vol, 0) / period;
      const volumeDeviation = currentVolume - averageVolume;
      const percentageChange = averageVolume > 0 ? (volumeDeviation / averageVolume) * 100 : 0;

      let trend: 'increasing' | 'decreasing' | 'neutral';
      let strength = Math.min(Math.abs(percentageChange), 100);

      if (percentageChange > 10) {
        trend = 'increasing';
      } else if (percentageChange < -10) {
        trend = 'decreasing';
      } else {
        trend = 'neutral';
        strength = strength / 2; // Reduce strength for neutral trends
      }

      result.push({
        time: data[i].time,
        trend,
        strength
      });
    }

    return result;
  }

  // Volume Breakout Detection
  detectVolumeBreakouts(data: CandlestickData[], volumeThreshold: number = 2.0, period: number = 20): Array<{
    time: number;
    type: 'bullish' | 'bearish';
    volumeMultiple: number;
    priceChange: number;
  }> {
    if (data.length < period + 1) return [];

    const result = [];

    for (let i = period; i < data.length; i++) {
      const current = data[i];
      const previous = data[i - 1];

      if (!current.volume || !previous.volume) continue;

      // Calculate average volume over the period
      const recentVolumes = data.slice(i - period, i).map(d => d.volume || 0);
      const averageVolume = recentVolumes.reduce((sum, vol) => sum + vol, 0) / period;

      // Check if current volume is significantly higher
      const volumeMultiple = current.volume / averageVolume;

      if (volumeMultiple >= volumeThreshold) {
        const priceChange = ((current.close - previous.close) / previous.close) * 100;
        const type: 'bullish' | 'bearish' = priceChange > 0 ? 'bullish' : 'bearish';

        result.push({
          time: current.time,
          type,
          volumeMultiple,
          priceChange
        });
      }
    }

    return result;
  }

  // Volume-Price Trend (VPT)
  calculateVolumePriceTrend(data: CandlestickData[]): VolumeIndicatorData[] {
    if (data.length < 2) return [];

    const result: VolumeIndicatorData[] = [];
    let vpt = 0;

    // First data point
    result.push({
      time: data[0].time,
      value: 0
    });

    for (let i = 1; i < data.length; i++) {
      const current = data[i];
      const previous = data[i - 1];

      if (!current.volume) continue;

      const priceChange = (current.close - previous.close) / previous.close;
      vpt += current.volume * priceChange;

      result.push({
        time: current.time,
        value: vpt
      });
    }

    return result;
  }

  // Negative Volume Index (NVI)
  calculateNegativeVolumeIndex(data: CandlestickData[]): VolumeIndicatorData[] {
    if (data.length < 2) return [];

    const result: VolumeIndicatorData[] = [];
    let nvi = 1000; // Start with base value

    // First data point
    result.push({
      time: data[0].time,
      value: nvi
    });

    for (let i = 1; i < data.length; i++) {
      const current = data[i];
      const previous = data[i - 1];

      if (!current.volume || !previous.volume) continue;

      // Update NVI only when volume decreases
      if (current.volume < previous.volume) {
        const priceChange = (current.close - previous.close) / previous.close;
        nvi += nvi * priceChange;
      }

      result.push({
        time: current.time,
        value: nvi
      });
    }

    return result;
  }

  // Positive Volume Index (PVI)
  calculatePositiveVolumeIndex(data: CandlestickData[]): VolumeIndicatorData[] {
    if (data.length < 2) return [];

    const result: VolumeIndicatorData[] = [];
    let pvi = 1000; // Start with base value

    // First data point
    result.push({
      time: data[0].time,
      value: pvi
    });

    for (let i = 1; i < data.length; i++) {
      const current = data[i];
      const previous = data[i - 1];

      if (!current.volume || !previous.volume) continue;

      // Update PVI only when volume increases
      if (current.volume > previous.volume) {
        const priceChange = (current.close - previous.close) / previous.close;
        pvi += pvi * priceChange;
      }

      result.push({
        time: current.time,
        value: pvi
      });
    }

    return result;
  }
}

// Export singleton instance
export const volumeAnalysisService = new VolumeAnalysisService();
export default volumeAnalysisService;