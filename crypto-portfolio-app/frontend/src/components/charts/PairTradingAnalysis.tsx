import React, { useState, useMemo } from 'react';
import { TrendingUp, TrendingDown, Activity, Target, AlertTriangle, X, DollarSign } from 'lucide-react';
import { correlationService } from '../../services/CorrelationService';

interface CandlestickData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

interface PairTradingAnalysisProps {
  multiAssetData: Record<string, CandlestickData[]>;
  selectedAssets: string[];
  onClose: () => void;
}

interface PairAnalysis {
  asset1: string;
  asset2: string;
  correlation: number;
  cointegration?: number;
  spreadMean: number;
  spreadStd: number;
  currentSpread: number;
  zScore: number;
  entrySignal: 'LONG' | 'SHORT' | 'NEUTRAL';
  confidence: number;
  profitability: number;
  sharpeRatio: number;
  maxDrawdown: number;
  winRate: number;
  avgTrade: number;
  volatility: number;
}

interface TradingSignal {
  timestamp: number;
  action: 'BUY' | 'SELL' | 'CLOSE';
  asset1Action: 'BUY' | 'SELL';
  asset2Action: 'BUY' | 'SELL';
  spread: number;
  zScore: number;
  confidence: number;
}

const PairTradingAnalysis: React.FC<PairTradingAnalysisProps> = ({
  multiAssetData,
  selectedAssets,
  onClose
}) => {
  const [selectedPair, setSelectedPair] = useState<string>('');
  const [lookbackPeriod, setLookbackPeriod] = useState<number>(30);
  const [entryThreshold, setEntryThreshold] = useState<number>(2.0);
  const [exitThreshold, setExitThreshold] = useState<number>(0.5);

  // Calculate pair trading opportunities
  const pairAnalyses = useMemo((): PairAnalysis[] => {
    const pairs: PairAnalysis[] = [];

    for (let i = 0; i < selectedAssets.length; i++) {
      for (let j = i + 1; j < selectedAssets.length; j++) {
        const asset1 = selectedAssets[i];
        const asset2 = selectedAssets[j];
        
        const data1 = multiAssetData[asset1] || [];
        const data2 = multiAssetData[asset2] || [];

        if (data1.length < 20 || data2.length < 20) continue;

        // Align data by time
        const alignedData = alignDataByTime(data1, data2);
        if (alignedData.length < 20) continue;

        // Calculate correlation
        const correlation = correlationService.calculatePearsonCorrelation(data1, data2);

        // Calculate spread (log price ratio)
        const spreads = alignedData.map(({ price1, price2 }) => 
          Math.log(price1) - Math.log(price2)
        );

        // Calculate spread statistics
        const spreadMean = spreads.reduce((sum, s) => sum + s, 0) / spreads.length;
        const spreadVariance = spreads.reduce((sum, s) => sum + Math.pow(s - spreadMean, 2), 0) / (spreads.length - 1);
        const spreadStd = Math.sqrt(spreadVariance);

        // Current spread and z-score
        const currentSpread = spreads[spreads.length - 1];
        const zScore = (currentSpread - spreadMean) / spreadStd;

        // Generate trading signal
        let entrySignal: 'LONG' | 'SHORT' | 'NEUTRAL' = 'NEUTRAL';
        if (Math.abs(zScore) >= entryThreshold) {
          entrySignal = zScore > 0 ? 'SHORT' : 'LONG';
        }

        // Calculate trading performance metrics
        const signals = generateTradingSignals(spreads, spreadMean, spreadStd, entryThreshold, exitThreshold);
        const performance = calculatePerformanceMetrics(signals, alignedData);

        // Calculate confidence based on correlation strength and signal clarity
        const confidence = Math.min(100, 
          Math.abs(correlation) * 50 + 
          Math.min(Math.abs(zScore), 3) * 16.67 +
          (spreads.length > 100 ? 20 : spreads.length * 0.2)
        );

        pairs.push({
          asset1,
          asset2,
          correlation,
          spreadMean,
          spreadStd,
          currentSpread,
          zScore,
          entrySignal,
          confidence,
          profitability: performance.totalReturn,
          sharpeRatio: performance.sharpeRatio,
          maxDrawdown: performance.maxDrawdown,
          winRate: performance.winRate,
          avgTrade: performance.avgTrade,
          volatility: spreadStd
        });
      }
    }

    // Sort by confidence/profitability
    return pairs.sort((a, b) => b.confidence - a.confidence);
  }, [multiAssetData, selectedAssets, lookbackPeriod, entryThreshold, exitThreshold]);

  // Helper functions
  const alignDataByTime = (data1: CandlestickData[], data2: CandlestickData[]) => {
    const timeMap1 = new Map(data1.map(item => [item.time, item.close]));
    const aligned: Array<{ time: number; price1: number; price2: number }> = [];

    data2.forEach(item2 => {
      const price1 = timeMap1.get(item2.time);
      if (price1) {
        aligned.push({
          time: item2.time,
          price1,
          price2: item2.close
        });
      }
    });

    return aligned.sort((a, b) => a.time - b.time);
  };

  const generateTradingSignals = (
    spreads: number[],
    mean: number,
    std: number,
    entryThreshold: number,
    exitThreshold: number
  ): TradingSignal[] => {
    const signals: TradingSignal[] = [];
    let position: 'LONG' | 'SHORT' | null = null;

    spreads.forEach((spread, index) => {
      const zScore = (spread - mean) / std;
      const timestamp = Date.now() - (spreads.length - index) * 3600000; // Hourly intervals

      if (!position) {
        // Entry signals
        if (zScore <= -entryThreshold) {
          signals.push({
            timestamp,
            action: 'BUY',
            asset1Action: 'BUY',
            asset2Action: 'SELL',
            spread,
            zScore,
            confidence: Math.min(100, Math.abs(zScore) * 25)
          });
          position = 'LONG';
        } else if (zScore >= entryThreshold) {
          signals.push({
            timestamp,
            action: 'SELL',
            asset1Action: 'SELL',
            asset2Action: 'BUY',
            spread,
            zScore,
            confidence: Math.min(100, Math.abs(zScore) * 25)
          });
          position = 'SHORT';
        }
      } else {
        // Exit signals
        if (Math.abs(zScore) <= exitThreshold) {
          signals.push({
            timestamp,
            action: 'CLOSE',
            asset1Action: position === 'LONG' ? 'SELL' : 'BUY',
            asset2Action: position === 'LONG' ? 'BUY' : 'SELL',
            spread,
            zScore,
            confidence: 80
          });
          position = null;
        }
      }
    });

    return signals;
  };

  const calculatePerformanceMetrics = (
    signals: TradingSignal[],
    alignedData: Array<{ time: number; price1: number; price2: number }>
  ) => {
    let totalReturn = 0;
    let trades = 0;
    let wins = 0;
    let currentPosition: 'LONG' | 'SHORT' | null = null;
    let entrySpread = 0;
    let returns: number[] = [];
    let equity = 100; // Starting with 100%
    let maxEquity = 100;
    let maxDrawdown = 0;

    signals.forEach(signal => {
      if (signal.action === 'BUY' || signal.action === 'SELL') {
        currentPosition = signal.action === 'BUY' ? 'LONG' : 'SHORT';
        entrySpread = signal.spread;
      } else if (signal.action === 'CLOSE' && currentPosition) {
        const spreadChange = signal.spread - entrySpread;
        const tradeReturn = currentPosition === 'LONG' ? -spreadChange : spreadChange;
        
        totalReturn += tradeReturn;
        returns.push(tradeReturn);
        
        if (tradeReturn > 0) wins++;
        trades++;
        
        equity += tradeReturn * 10; // 10x leverage assumption
        if (equity > maxEquity) maxEquity = equity;
        
        const drawdown = (maxEquity - equity) / maxEquity;
        if (drawdown > maxDrawdown) maxDrawdown = drawdown;
        
        currentPosition = null;
      }
    });

    const avgReturn = returns.length > 0 ? returns.reduce((sum, r) => sum + r, 0) / returns.length : 0;
    const returnStd = returns.length > 1 ? 
      Math.sqrt(returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / (returns.length - 1)) : 0;
    
    const sharpeRatio = returnStd > 0 ? avgReturn / returnStd : 0;
    const winRate = trades > 0 ? wins / trades : 0;

    return {
      totalReturn,
      sharpeRatio,
      maxDrawdown,
      winRate,
      avgTrade: avgReturn,
      trades
    };
  };

  // Format functions
  const formatPercentage = (value: number, decimals: number = 2): string => {
    return `${(value * 100).toFixed(decimals)}%`;
  };

  const formatNumber = (value: number, decimals: number = 3): string => {
    return value.toFixed(decimals);
  };

  const getSignalColor = (signal: string): string => {
    switch (signal) {
      case 'LONG': return 'text-green-600 bg-green-100 dark:bg-green-900/20';
      case 'SHORT': return 'text-red-600 bg-red-100 dark:bg-red-900/20';
      default: return 'text-gray-600 bg-gray-100 dark:bg-gray-700';
    }
  };

  const getConfidenceColor = (confidence: number): string => {
    if (confidence >= 80) return 'text-green-600';
    if (confidence >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-7xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">
              Pair Trading Analysis
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Statistical arbitrage opportunities for {selectedAssets.join(', ')}
            </p>
          </div>
          
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Controls */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Lookback Period (days)
              </label>
              <input
                type="number"
                value={lookbackPeriod}
                onChange={(e) => setLookbackPeriod(Number(e.target.value))}
                min="7"
                max="365"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-sm"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Entry Threshold (Z-Score)
              </label>
              <input
                type="number"
                value={entryThreshold}
                onChange={(e) => setEntryThreshold(Number(e.target.value))}
                min="1"
                max="5"
                step="0.1"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-sm"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Exit Threshold (Z-Score)
              </label>
              <input
                type="number"
                value={exitThreshold}
                onChange={(e) => setExitThreshold(Number(e.target.value))}
                min="0"
                max="2"
                step="0.1"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-sm"
              />
            </div>

            <div className="flex items-end">
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {pairAnalyses.length} pairs analyzed
              </div>
            </div>
          </div>
        </div>

        {/* Pair Analysis Results */}
        <div className="p-6">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Pair
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Signal
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Z-Score
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Correlation
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Confidence
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Profitability
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Sharpe Ratio
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Win Rate
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Max DD
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                {pairAnalyses.map((pair, index) => (
                  <tr 
                    key={`${pair.asset1}-${pair.asset2}`}
                    className="hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                    onClick={() => setSelectedPair(`${pair.asset1}-${pair.asset2}`)}
                  >
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {pair.asset1} / {pair.asset2}
                      </div>
                    </td>
                    
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${getSignalColor(pair.entrySignal)}`}>
                        {pair.entrySignal}
                      </span>
                    </td>
                    
                    <td className="px-4 py-3 whitespace-nowrap text-sm">
                      <span className={`font-medium ${
                        Math.abs(pair.zScore) >= entryThreshold ? 'text-orange-600' : 'text-gray-600 dark:text-gray-400'
                      }`}>
                        {formatNumber(pair.zScore)}
                      </span>
                    </td>
                    
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-300">
                      {formatNumber(pair.correlation)}
                    </td>
                    
                    <td className="px-4 py-3 whitespace-nowrap text-sm">
                      <span className={getConfidenceColor(pair.confidence)}>
                        {pair.confidence.toFixed(0)}%
                      </span>
                    </td>
                    
                    <td className="px-4 py-3 whitespace-nowrap text-sm">
                      <span className={pair.profitability >= 0 ? 'text-green-600' : 'text-red-600'}>
                        {formatPercentage(pair.profitability)}
                      </span>
                    </td>
                    
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-300">
                      {formatNumber(pair.sharpeRatio)}
                    </td>
                    
                    <td className="px-4 py-3 whitespace-nowrap text-sm">
                      <span className={pair.winRate >= 0.6 ? 'text-green-600' : pair.winRate >= 0.4 ? 'text-yellow-600' : 'text-red-600'}>
                        {formatPercentage(pair.winRate)}
                      </span>
                    </td>
                    
                    <td className="px-4 py-3 whitespace-nowrap text-sm">
                      <span className={pair.maxDrawdown <= 0.1 ? 'text-green-600' : pair.maxDrawdown <= 0.2 ? 'text-yellow-600' : 'text-red-600'}>
                        {formatPercentage(pair.maxDrawdown)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pairAnalyses.length === 0 && (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              No pairs available for analysis. Select more assets to compare.
            </div>
          )}
        </div>

        {/* Trading Strategy Information */}
        <div className="p-6 border-t border-gray-200 dark:border-gray-700">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
              <h5 className="font-medium text-blue-900 dark:text-blue-100 mb-2 flex items-center">
                <Target className="w-4 h-4 mr-2" />
                Strategy Overview
              </h5>
              <div className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
                <p>• Pairs trading exploits temporary price divergences</p>
                <p>• Enter when spread exceeds {entryThreshold} standard deviations</p>
                <p>• Exit when spread returns to {exitThreshold} standard deviations</p>
              </div>
            </div>

            <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4">
              <h5 className="font-medium text-yellow-900 dark:text-yellow-100 mb-2 flex items-center">
                <AlertTriangle className="w-4 h-4 mr-2" />
                Risk Considerations
              </h5>
              <div className="text-sm text-yellow-800 dark:text-yellow-200 space-y-1">
                <p>• High correlation pairs work best (&gt; 0.7)</p>
                <p>• Monitor for structural breaks in relationships</p>
                <p>• Use proper position sizing and stop losses</p>
              </div>
            </div>

            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
              <h5 className="font-medium text-green-900 dark:text-green-100 mb-2 flex items-center">
                <DollarSign className="w-4 h-4 mr-2" />
                Best Opportunities
              </h5>
              <div className="text-sm text-green-800 dark:text-green-200 space-y-1">
                {pairAnalyses.slice(0, 3).map((pair, index) => (
                  <p key={index}>
                    • {pair.asset1}/{pair.asset2}: {pair.entrySignal} ({pair.confidence.toFixed(0)}% confidence)
                  </p>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PairTradingAnalysis;