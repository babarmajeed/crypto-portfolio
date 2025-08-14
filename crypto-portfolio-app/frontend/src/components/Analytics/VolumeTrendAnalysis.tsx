import React, { useMemo } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Activity,
  AlertTriangle,
  Target,
  Zap,
  BarChart3,
  Info
} from 'lucide-react';
import { VolumeData, VolumeTrends, VolumeIndicators } from '../../services/VolumeAnalysisService';

interface VolumeTrendAnalysisProps {
  volumeData: VolumeData[];
  volumeTrends: VolumeTrends | null;
  volumeIndicators: VolumeIndicators | null;
  priceData?: Array<{ timestamp: number; price: number; }>;
  className?: string;
}

interface DivergenceSignal {
  type: 'bullish' | 'bearish' | 'hidden_bullish' | 'hidden_bearish';
  strength: 'weak' | 'medium' | 'strong';
  indicator: string;
  description: string;
  timestamp: number;
  confidence: number;
}

interface TrendPhase {
  phase: 'accumulation' | 'markup' | 'distribution' | 'markdown' | 'consolidation';
  confidence: number;
  characteristics: string[];
  duration: number;
  volumeCharacteristics: {
    averageVolume: number;
    volumeSpike: boolean;
    buyingPressure: number;
    sellingPressure: number;
  };
}

const VolumeTrendAnalysis: React.FC<VolumeTrendAnalysisProps> = ({
  volumeData,
  volumeTrends,
  volumeIndicators,
  priceData = [],
  className = ''
}) => {
  // Analyze volume divergences
  const divergenceAnalysis = useMemo(() => {
    if (!volumeIndicators || !priceData.length || !volumeData.length) return [];

    const signals: DivergenceSignal[] = [];
    const recentPeriods = 20;
    
    // Get recent data for analysis
    const recentVolume = volumeData.slice(-recentPeriods);
    const recentPrice = priceData.slice(-recentPeriods);
    const recentOBV = volumeIndicators.obv.slice(-recentPeriods);
    const recentAD = volumeIndicators.ad.slice(-recentPeriods);
    
    if (recentPrice.length < 10 || recentOBV.length < 10) return signals;

    // Helper function to identify price peaks and troughs
    const findPeaksAndTroughs = (data: Array<{ value: number }>) => {
      const peaks: number[] = [];
      const troughs: number[] = [];
      
      for (let i = 1; i < data.length - 1; i++) {
        if (data[i].value > data[i-1].value && data[i].value > data[i+1].value) {
          peaks.push(i);
        }
        if (data[i].value < data[i-1].value && data[i].value < data[i+1].value) {
          troughs.push(i);
        }
      }
      return { peaks, troughs };
    };

    // Analyze OBV divergences
    const pricePeaksAndTroughs = findPeaksAndTroughs(recentPrice.map(p => ({ value: p.price })));
    const obvPeaksAndTroughs = findPeaksAndTroughs(recentOBV);

    // Check for bearish divergence (price makes higher highs, OBV makes lower highs)
    if (pricePeaksAndTroughs.peaks.length >= 2 && obvPeaksAndTroughs.peaks.length >= 2) {
      const latestPricePeak = pricePeaksAndTroughs.peaks[pricePeaksAndTroughs.peaks.length - 1];
      const prevPricePeak = pricePeaksAndTroughs.peaks[pricePeaksAndTroughs.peaks.length - 2];
      const latestOBVPeak = obvPeaksAndTroughs.peaks[obvPeaksAndTroughs.peaks.length - 1];
      const prevOBVPeak = obvPeaksAndTroughs.peaks[obvPeaksAndTroughs.peaks.length - 2];

      if (latestPricePeak >= 0 && prevPricePeak >= 0 && latestOBVPeak >= 0 && prevOBVPeak >= 0) {
        const priceHigherHigh = recentPrice[latestPricePeak].price > recentPrice[prevPricePeak].price;
        const obvLowerHigh = recentOBV[latestOBVPeak].value < recentOBV[prevOBVPeak].value;

        if (priceHigherHigh && obvLowerHigh) {
          const confidence = Math.min(90, 
            50 + Math.abs(recentPrice[latestPricePeak].price - recentPrice[prevPricePeak].price) / recentPrice[prevPricePeak].price * 1000
          );
          
          signals.push({
            type: 'bearish',
            strength: confidence > 70 ? 'strong' : confidence > 50 ? 'medium' : 'weak',
            indicator: 'OBV',
            description: 'Price making higher highs while OBV makes lower highs - potential reversal',
            timestamp: recentVolume[latestPricePeak].timestamp,
            confidence
          });
        }
      }
    }

    // Check for bullish divergence (price makes lower lows, OBV makes higher lows)
    if (pricePeaksAndTroughs.troughs.length >= 2 && obvPeaksAndTroughs.troughs.length >= 2) {
      const latestPriceTrough = pricePeaksAndTroughs.troughs[pricePeaksAndTroughs.troughs.length - 1];
      const prevPriceTrough = pricePeaksAndTroughs.troughs[pricePeaksAndTroughs.troughs.length - 2];
      const latestOBVTrough = obvPeaksAndTroughs.troughs[obvPeaksAndTroughs.troughs.length - 1];
      const prevOBVTrough = obvPeaksAndTroughs.troughs[obvPeaksAndTroughs.troughs.length - 2];

      if (latestPriceTrough >= 0 && prevPriceTrough >= 0 && latestOBVTrough >= 0 && prevOBVTrough >= 0) {
        const priceLowerLow = recentPrice[latestPriceTrough].price < recentPrice[prevPriceTrough].price;
        const obvHigherLow = recentOBV[latestOBVTrough].value > recentOBV[prevOBVTrough].value;

        if (priceLowerLow && obvHigherLow) {
          const confidence = Math.min(90, 
            50 + Math.abs(recentPrice[latestPriceTrough].price - recentPrice[prevPriceTrough].price) / recentPrice[prevPriceTrough].price * 1000
          );
          
          signals.push({
            type: 'bullish',
            strength: confidence > 70 ? 'strong' : confidence > 50 ? 'medium' : 'weak',
            indicator: 'OBV',
            description: 'Price making lower lows while OBV makes higher lows - potential reversal',
            timestamp: recentVolume[latestPriceTrough].timestamp,
            confidence
          });
        }
      }
    }

    return signals.sort((a, b) => b.timestamp - a.timestamp);
  }, [volumeData, volumeIndicators, priceData]);

  // Analyze market phase
  const marketPhaseAnalysis = useMemo((): TrendPhase => {
    if (!volumeData.length || !volumeTrends) {
      return {
        phase: 'consolidation',
        confidence: 0,
        characteristics: [],
        duration: 0,
        volumeCharacteristics: {
          averageVolume: 0,
          volumeSpike: false,
          buyingPressure: 0,
          sellingPressure: 0
        }
      };
    }

    const recentData = volumeData.slice(-50);
    const averageVolume = recentData.reduce((sum, d) => sum + d.volume, 0) / recentData.length;
    const recentVolume = recentData.slice(-10);
    const recentAvgVolume = recentVolume.reduce((sum, d) => sum + d.volume, 0) / recentVolume.length;
    
    const volumeIncrease = (recentAvgVolume - averageVolume) / averageVolume;
    const volumeSpike = volumeIncrease > 0.5;
    
    // Calculate buying vs selling pressure
    const buyVolume = recentData.reduce((sum, d) => sum + d.buyVolume, 0);
    const sellVolume = recentData.reduce((sum, d) => sum + d.sellVolume, 0);
    const totalVolume = buyVolume + sellVolume;
    const buyingPressure = totalVolume > 0 ? buyVolume / totalVolume : 0.5;
    const sellingPressure = 1 - buyingPressure;

    let phase: TrendPhase['phase'] = 'consolidation';
    let confidence = 0;
    const characteristics: string[] = [];

    // Determine market phase based on volume trends and characteristics
    if (volumeTrends.trend === 'increasing' && volumeTrends.strength === 'strong') {
      if (buyingPressure > 0.6) {
        phase = 'accumulation';
        confidence = 75 + Math.min(25, (buyingPressure - 0.6) * 100);
        characteristics.push('Strong buying volume');
        characteristics.push('Volume expansion');
        if (volumeSpike) characteristics.push('Volume spike detected');
      } else if (sellingPressure > 0.6) {
        phase = 'distribution';
        confidence = 75 + Math.min(25, (sellingPressure - 0.6) * 100);
        characteristics.push('Strong selling volume');
        characteristics.push('Distribution patterns');
        if (volumeSpike) characteristics.push('Selling climax potential');
      } else {
        phase = 'markup';
        confidence = 60;
        characteristics.push('Moderate buying interest');
        characteristics.push('Trend continuation likely');
      }
    } else if (volumeTrends.trend === 'decreasing') {
      if (buyingPressure > 0.55) {
        phase = 'markup';
        confidence = 50 + (buyingPressure - 0.5) * 100;
        characteristics.push('Low volume advance');
        characteristics.push('Smart money accumulation');
      } else {
        phase = 'markdown';
        confidence = 60;
        characteristics.push('Low volume decline');
        characteristics.push('Weak selling pressure');
      }
    } else {
      phase = 'consolidation';
      confidence = 40;
      characteristics.push('Balanced volume flow');
      characteristics.push('Range-bound trading');
    }

    return {
      phase,
      confidence,
      characteristics,
      duration: recentData.length,
      volumeCharacteristics: {
        averageVolume,
        volumeSpike,
        buyingPressure,
        sellingPressure
      }
    };
  }, [volumeData, volumeTrends]);

  // Format percentage
  const formatPercentage = (value: number): string => {
    return `${(value * 100).toFixed(1)}%`;
  };

  // Format number
  const formatNumber = (value: number): string => {
    return value.toLocaleString('en-US', { maximumFractionDigits: 0 });
  };

  // Get phase color
  const getPhaseColor = (phase: string): string => {
    switch (phase) {
      case 'accumulation': return 'text-green-600 bg-green-100 dark:bg-green-900/20';
      case 'markup': return 'text-blue-600 bg-blue-100 dark:bg-blue-900/20';
      case 'distribution': return 'text-red-600 bg-red-100 dark:bg-red-900/20';
      case 'markdown': return 'text-orange-600 bg-orange-100 dark:bg-orange-900/20';
      default: return 'text-gray-600 bg-gray-100 dark:bg-gray-700';
    }
  };

  // Get signal color
  const getSignalColor = (type: string): string => {
    switch (type) {
      case 'bullish':
      case 'hidden_bullish': return 'text-green-600 bg-green-100 dark:bg-green-900/20';
      case 'bearish':
      case 'hidden_bearish': return 'text-red-600 bg-red-100 dark:bg-red-900/20';
      default: return 'text-gray-600 bg-gray-100 dark:bg-gray-700';
    }
  };

  return (
    <div className={`volume-trend-analysis ${className}`}>
      {/* Market Phase Analysis */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700 mb-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
          <Activity className="w-5 h-5 mr-2" />
          Market Phase Analysis
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className={`inline-block px-4 py-2 rounded-full text-lg font-bold ${getPhaseColor(marketPhaseAnalysis.phase)}`}>
              {marketPhaseAnalysis.phase.toUpperCase()}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400 mt-2">Current Phase</div>
            <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {marketPhaseAnalysis.confidence.toFixed(0)}% confidence
            </div>
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              {formatPercentage(marketPhaseAnalysis.volumeCharacteristics.buyingPressure)}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Buying Pressure</div>
            <div className="text-2xl font-bold text-red-600">
              {formatPercentage(marketPhaseAnalysis.volumeCharacteristics.sellingPressure)}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Selling Pressure</div>
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {formatNumber(marketPhaseAnalysis.volumeCharacteristics.averageVolume)}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Average Volume</div>
            {marketPhaseAnalysis.volumeCharacteristics.volumeSpike && (
              <div className="inline-flex items-center px-2 py-1 bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-200 rounded-full text-xs">
                <Zap className="w-3 h-3 mr-1" />
                Volume Spike
              </div>
            )}
          </div>
        </div>

        <div className="mt-4">
          <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-2">Phase Characteristics:</h4>
          <div className="flex flex-wrap gap-2">
            {marketPhaseAnalysis.characteristics.map((char, index) => (
              <span
                key={index}
                className="px-3 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-full text-sm"
              >
                {char}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Volume Trend Overview */}
      {volumeTrends && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
            <BarChart3 className="w-5 h-5 mr-2" />
            Volume Trend Summary
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className={`text-xl font-bold ${
                volumeTrends.trend === 'increasing' ? 'text-green-600' :
                volumeTrends.trend === 'decreasing' ? 'text-red-600' : 'text-gray-500'
              }`}>
                {volumeTrends.trend === 'increasing' ? <TrendingUp className="w-8 h-8 mx-auto" /> :
                 volumeTrends.trend === 'decreasing' ? <TrendingDown className="w-8 h-8 mx-auto" /> :
                 <Activity className="w-8 h-8 mx-auto" />}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {volumeTrends.trend.toUpperCase()}
              </div>
            </div>
            
            <div className="text-center">
              <div className="text-xl font-bold text-gray-900 dark:text-white">
                {volumeTrends.strength.toUpperCase()}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Strength</div>
            </div>
            
            <div className="text-center">
              <div className={`text-xl font-bold ${
                volumeTrends.volumeChange > 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {volumeTrends.volumeChange > 0 ? '+' : ''}{volumeTrends.volumeChange.toFixed(1)}%
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Volume Change</div>
            </div>
            
            <div className="text-center">
              <div className="text-xl font-bold text-gray-900 dark:text-white">
                {formatNumber(volumeTrends.recentAverage)}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Recent Average</div>
            </div>
          </div>
        </div>
      )}

      {/* Divergence Signals */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700 mb-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
          <Target className="w-5 h-5 mr-2" />
          Volume Divergence Signals
        </h3>
        
        {divergenceAnalysis.length > 0 ? (
          <div className="space-y-4">
            {divergenceAnalysis.slice(0, 5).map((signal, index) => (
              <div key={index} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-3">
                    <div className={`px-3 py-1 rounded-full text-sm font-medium ${getSignalColor(signal.type)}`}>
                      {signal.type.replace('_', ' ').toUpperCase()}
                    </div>
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {signal.indicator} • {signal.strength} strength
                    </span>
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    {signal.confidence.toFixed(0)}% confidence
                  </div>
                </div>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  {signal.description}
                </p>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {new Date(signal.timestamp).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <AlertTriangle className="w-8 h-8 mx-auto mb-2" />
            <p>No volume divergence signals detected</p>
            <p className="text-sm mt-1">Continue monitoring for potential signals</p>
          </div>
        )}
      </div>

      {/* Info Panel */}
      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
        <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2 flex items-center">
          <Info className="w-4 h-4 mr-2" />
          Volume Trend Analysis Guide
        </h4>
        <div className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
          <p>• <strong>Market Phases:</strong> Identify accumulation, markup, distribution, and markdown phases</p>
          <p>• <strong>Volume Divergence:</strong> Spots when price and volume move in opposite directions</p>
          <p>• <strong>Buying/Selling Pressure:</strong> Measures institutional vs retail activity</p>
          <p>• <strong>Volume Spikes:</strong> Indicates significant institutional interest or news events</p>
        </div>
      </div>
    </div>
  );
};

export default VolumeTrendAnalysis;