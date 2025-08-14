import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Activity,
  BarChart3,
  Target,
  Zap,
  Info,
  Settings,
  RefreshCw,
  ArrowUp,
  ArrowDown,
  Minus
} from 'lucide-react';
import { VolumeIndicators as VolumeIndicatorsType, VolumeIndicatorPoint } from '../../services/VolumeAnalysisService';

interface VolumeIndicatorsProps {
  volumeIndicators: VolumeIndicatorsType | null;
  symbol?: string;
  timeframe?: string;
  className?: string;
  onRefresh?: () => void;
}

interface IndicatorSettings {
  showOBV: boolean;
  showAD: boolean;
  showCMF: boolean;
  showVPT: boolean;
  showNVI: boolean;
  showPVI: boolean;
  chartHeight: number;
  showSignals: boolean;
  signalSensitivity: 'low' | 'medium' | 'high';
}

interface IndicatorSignal {
  indicator: string;
  type: 'bullish' | 'bearish' | 'neutral';
  strength: 'weak' | 'medium' | 'strong';
  description: string;
  timestamp: number;
}

const VolumeIndicators: React.FC<VolumeIndicatorsProps> = ({
  volumeIndicators,
  symbol = 'BTC/USD',
  timeframe = '1h',
  className = '',
  onRefresh
}) => {
  const [settings, setSettings] = useState<IndicatorSettings>({
    showOBV: true,
    showAD: true,
    showCMF: true,
    showVPT: false,
    showNVI: false,
    showPVI: false,
    chartHeight: 200,
    showSignals: true,
    signalSensitivity: 'medium'
  });
  const [showSettings, setShowSettings] = useState(false);
  const [selectedIndicator, setSelectedIndicator] = useState<string>('obv');

  // Calculate indicator signals and trends
  const indicatorAnalysis = useMemo(() => {
    if (!volumeIndicators) return null;

    const analyzeIndicator = (data: VolumeIndicatorPoint[], name: string) => {
      if (data.length < 20) return null;

      const recent = data.slice(-20);
      const current = recent[recent.length - 1];
      const previous = recent[recent.length - 2];
      const sma5 = recent.slice(-5).reduce((sum, p) => sum + p.value, 0) / 5;
      const sma20 = recent.reduce((sum, p) => sum + p.value, 0) / 20;

      // Calculate trend
      const trend = current.value > previous.value ? 'up' : 
                   current.value < previous.value ? 'down' : 'neutral';
      
      // Calculate momentum
      const momentum = ((current.value - recent[0].value) / Math.abs(recent[0].value)) * 100;
      
      // Calculate strength based on recent volatility
      const volatility = Math.sqrt(
        recent.reduce((sum, p) => sum + Math.pow(p.value - sma20, 2), 0) / recent.length
      );
      
      const strength = Math.abs(momentum) > volatility * 2 ? 'strong' :
                      Math.abs(momentum) > volatility ? 'medium' : 'weak';

      // Generate signals
      let signal: 'bullish' | 'bearish' | 'neutral' = 'neutral';
      let signalDescription = '';

      if (name === 'obv') {
        if (trend === 'up' && momentum > 5) {
          signal = 'bullish';
          signalDescription = 'OBV trending upward, indicating accumulation';
        } else if (trend === 'down' && momentum < -5) {
          signal = 'bearish';
          signalDescription = 'OBV trending downward, indicating distribution';
        } else {
          signalDescription = 'OBV showing neutral volume flow';
        }
      } else if (name === 'ad') {
        if (current.value > sma20 && trend === 'up') {
          signal = 'bullish';
          signalDescription = 'A/D Line above average and rising, bullish volume flow';
        } else if (current.value < sma20 && trend === 'down') {
          signal = 'bearish';
          signalDescription = 'A/D Line below average and falling, bearish volume flow';
        } else {
          signalDescription = 'A/D Line showing mixed signals';
        }
      } else if (name === 'cmf') {
        if (current.value > 0.1) {
          signal = 'bullish';
          signalDescription = 'CMF above 0.1, strong buying pressure';
        } else if (current.value < -0.1) {
          signal = 'bearish';
          signalDescription = 'CMF below -0.1, strong selling pressure';
        } else {
          signalDescription = 'CMF near zero, balanced volume flow';
        }
      }

      return {
        current: current.value,
        previous: previous.value,
        trend,
        momentum,
        strength,
        signal,
        signalDescription,
        sma5,
        sma20,
        volatility
      };
    };

    const obv = analyzeIndicator(volumeIndicators.obv, 'obv');
    const ad = analyzeIndicator(volumeIndicators.ad, 'ad');
    const cmf = analyzeIndicator(volumeIndicators.cmf, 'cmf');
    const vpt = analyzeIndicator(volumeIndicators.vpt, 'vpt');
    const nvi = analyzeIndicator(volumeIndicators.nvi, 'nvi');
    const pvi = analyzeIndicator(volumeIndicators.pvi, 'pvi');

    // Generate overall volume sentiment
    const signals = [obv?.signal, ad?.signal, cmf?.signal].filter(Boolean);
    const bullishCount = signals.filter(s => s === 'bullish').length;
    const bearishCount = signals.filter(s => s === 'bearish').length;

    let overallSentiment: 'bullish' | 'bearish' | 'neutral';
    if (bullishCount > bearishCount) {
      overallSentiment = 'bullish';
    } else if (bearishCount > bullishCount) {
      overallSentiment = 'bearish';
    } else {
      overallSentiment = 'neutral';
    }

    return {
      obv,
      ad,
      cmf,
      vpt,
      nvi,
      pvi,
      overallSentiment,
      bullishCount,
      bearishCount
    };
  }, [volumeIndicators]);

  // Format number with appropriate precision
  const formatNumber = (value: number, decimals: number = 2): string => {
    if (Math.abs(value) >= 1000000) {
      return `${(value / 1000000).toFixed(1)}M`;
    } else if (Math.abs(value) >= 1000) {
      return `${(value / 1000).toFixed(1)}K`;
    }
    return value.toFixed(decimals);
  };

  // Format percentage
  const formatPercentage = (value: number): string => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
  };

  // Get trend icon
  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up': return <ArrowUp className="w-4 h-4 text-green-600" />;
      case 'down': return <ArrowDown className="w-4 h-4 text-red-600" />;
      default: return <Minus className="w-4 h-4 text-gray-500" />;
    }
  };

  // Get signal color
  const getSignalColor = (signal: string): string => {
    switch (signal) {
      case 'bullish': return 'text-green-600 bg-green-100 dark:bg-green-900/20';
      case 'bearish': return 'text-red-600 bg-red-100 dark:bg-red-900/20';
      default: return 'text-gray-600 bg-gray-100 dark:bg-gray-700';
    }
  };

  // Get strength color
  const getStrengthColor = (strength: string): string => {
    switch (strength) {
      case 'strong': return 'text-blue-600';
      case 'medium': return 'text-yellow-600';
      default: return 'text-gray-500';
    }
  };

  // Render settings panel
  const renderSettings = () => (
    <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 mb-4">
      <h4 className="font-medium text-gray-900 dark:text-white mb-3">Volume Indicators Settings</h4>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Visible Indicators</h5>
          <div className="space-y-2">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={settings.showOBV}
                onChange={(e) => setSettings(prev => ({ ...prev, showOBV: e.target.checked }))}
                className="mr-2"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">On-Balance Volume (OBV)</span>
            </label>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={settings.showAD}
                onChange={(e) => setSettings(prev => ({ ...prev, showAD: e.target.checked }))}
                className="mr-2"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">Accumulation/Distribution (A/D)</span>
            </label>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={settings.showCMF}
                onChange={(e) => setSettings(prev => ({ ...prev, showCMF: e.target.checked }))}
                className="mr-2"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">Chaikin Money Flow (CMF)</span>
            </label>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={settings.showVPT}
                onChange={(e) => setSettings(prev => ({ ...prev, showVPT: e.target.checked }))}
                className="mr-2"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">Volume Price Trend (VPT)</span>
            </label>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={settings.showNVI}
                onChange={(e) => setSettings(prev => ({ ...prev, showNVI: e.target.checked }))}
                className="mr-2"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">Negative Volume Index (NVI)</span>
            </label>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={settings.showPVI}
                onChange={(e) => setSettings(prev => ({ ...prev, showPVI: e.target.checked }))}
                className="mr-2"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">Positive Volume Index (PVI)</span>
            </label>
          </div>
        </div>

        <div>
          <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Display Options</h5>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Chart Height
              </label>
              <select
                value={settings.chartHeight}
                onChange={(e) => setSettings(prev => ({ ...prev, chartHeight: Number(e.target.value) }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-sm"
              >
                <option value={150}>Small (150px)</option>
                <option value={200}>Medium (200px)</option>
                <option value={300}>Large (300px)</option>
                <option value={400}>Extra Large (400px)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Signal Sensitivity
              </label>
              <select
                value={settings.signalSensitivity}
                onChange={(e) => setSettings(prev => ({ ...prev, signalSensitivity: e.target.value as any }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-sm"
              >
                <option value="low">Low Sensitivity</option>
                <option value="medium">Medium Sensitivity</option>
                <option value="high">High Sensitivity</option>
              </select>
            </div>

            <label className="flex items-center">
              <input
                type="checkbox"
                checked={settings.showSignals}
                onChange={(e) => setSettings(prev => ({ ...prev, showSignals: e.target.checked }))}
                className="mr-2"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">Show Trading Signals</span>
            </label>
          </div>
        </div>
      </div>
    </div>
  );

  // Render indicator card
  const renderIndicatorCard = (
    name: string,
    title: string,
    analysis: any,
    description: string,
    active: boolean = true
  ) => {
    if (!analysis || !active) return null;

    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <div className="flex items-center space-x-2">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">{title}</h3>
              {getTrendIcon(analysis.trend)}
            </div>
          </div>
          <div className={`px-2 py-1 rounded-full text-xs font-medium ${getSignalColor(analysis.signal)}`}>
            {analysis.signal.toUpperCase()}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-3">
          <div>
            <div className="text-lg font-bold text-gray-900 dark:text-white">
              {formatNumber(analysis.current)}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Current Value</div>
          </div>
          <div>
            <div className={`text-lg font-bold ${
              analysis.momentum > 0 ? 'text-green-600' : 
              analysis.momentum < 0 ? 'text-red-600' : 'text-gray-500'
            }`}>
              {formatPercentage(analysis.momentum)}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">20-Period Change</div>
          </div>
        </div>

        <div className="text-xs text-gray-600 dark:text-gray-400 mb-2">
          {analysis.signalDescription}
        </div>

        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <span>Strength: <span className={getStrengthColor(analysis.strength)}>{analysis.strength}</span></span>
          <button
            onClick={() => setSelectedIndicator(name)}
            className="text-blue-600 hover:text-blue-700 transition-colors"
          >
            View Details
          </button>
        </div>
      </div>
    );
  };

  // Render chart placeholder
  const renderChart = () => {
    if (!volumeIndicators || !indicatorAnalysis) return null;

    const indicatorData = volumeIndicators[selectedIndicator as keyof VolumeIndicatorsType];
    if (!indicatorData) return null;

    const recentData = indicatorData.slice(-50); // Show last 50 points

    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {selectedIndicator.toUpperCase()} Chart
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {symbol} • {timeframe} • Last {recentData.length} periods
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <select
              value={selectedIndicator}
              onChange={(e) => setSelectedIndicator(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-sm"
            >
              {settings.showOBV && <option value="obv">OBV</option>}
              {settings.showAD && <option value="ad">A/D Line</option>}
              {settings.showCMF && <option value="cmf">CMF</option>}
              {settings.showVPT && <option value="vpt">VPT</option>}
              {settings.showNVI && <option value="nvi">NVI</option>}
              {settings.showPVI && <option value="pvi">PVI</option>}
            </select>
          </div>
        </div>

        <div 
          className="bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center"
          style={{ height: `${settings.chartHeight}px` }}
        >
          <div className="text-center text-gray-500 dark:text-gray-400">
            <BarChart3 className="w-12 h-12 mx-auto mb-2" />
            <p className="text-lg font-medium">{selectedIndicator.toUpperCase()} Indicator Chart</p>
            <p className="text-sm">Interactive time series visualization</p>
            <div className="mt-2 text-sm">
              Range: {formatNumber(Math.min(...recentData.map(d => d.value)))} - {formatNumber(Math.max(...recentData.map(d => d.value)))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Render overall sentiment
  const renderSentiment = () => {
    if (!indicatorAnalysis) return null;

    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Volume Sentiment Analysis
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div className="text-center">
            <div className={`text-3xl font-bold ${getSignalColor(indicatorAnalysis.overallSentiment).split(' ')[0]}`}>
              {indicatorAnalysis.overallSentiment.toUpperCase()}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Overall Sentiment</div>
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              {indicatorAnalysis.bullishCount}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Bullish Signals</div>
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">
              {indicatorAnalysis.bearishCount}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Bearish Signals</div>
          </div>
        </div>

        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
          <p className="text-sm text-blue-800 dark:text-blue-200">
            <strong>Interpretation:</strong> The volume indicators are showing{' '}
            {indicatorAnalysis.overallSentiment === 'bullish' ? 
              'predominantly bullish signals, suggesting accumulation and buying pressure.' :
              indicatorAnalysis.overallSentiment === 'bearish' ?
              'predominantly bearish signals, suggesting distribution and selling pressure.' :
              'mixed signals, indicating uncertainty in volume flow patterns.'
            }
          </p>
        </div>
      </div>
    );
  };

  if (!volumeIndicators) {
    return (
      <div className={`volume-indicators ${className}`}>
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          <TrendingUp className="w-12 h-12 mx-auto mb-4" />
          <p>No volume indicators data available</p>
          <p className="text-sm mt-2">Volume indicators are being calculated...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`volume-indicators ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Volume Indicators Analysis
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Technical volume indicators for trend confirmation and divergence analysis
          </p>
        </div>
        
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`flex items-center space-x-2 px-3 py-2 rounded-md border transition-colors text-sm ${
              showSettings 
                ? 'bg-blue-600 text-white border-blue-600' 
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>Settings</span>
          </button>
          
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="flex items-center space-x-2 px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Refresh</span>
            </button>
          )}
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && renderSettings()}

      {/* Overall Sentiment */}
      {renderSentiment()}

      {/* Indicator Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {renderIndicatorCard(
          'obv', 
          'On-Balance Volume', 
          indicatorAnalysis?.obv, 
          'Cumulative volume flow indicator',
          settings.showOBV
        )}
        {renderIndicatorCard(
          'ad', 
          'Accumulation/Distribution', 
          indicatorAnalysis?.ad, 
          'Volume-weighted accumulation indicator',
          settings.showAD
        )}
        {renderIndicatorCard(
          'cmf', 
          'Chaikin Money Flow', 
          indicatorAnalysis?.cmf, 
          'Volume-weighted money flow over period',
          settings.showCMF
        )}
        {renderIndicatorCard(
          'vpt', 
          'Volume Price Trend', 
          indicatorAnalysis?.vpt, 
          'Price and volume correlation indicator',
          settings.showVPT
        )}
        {renderIndicatorCard(
          'nvi', 
          'Negative Volume Index', 
          indicatorAnalysis?.nvi, 
          'Smart money indicator on low volume days',
          settings.showNVI
        )}
        {renderIndicatorCard(
          'pvi', 
          'Positive Volume Index', 
          indicatorAnalysis?.pvi, 
          'Retail sentiment on high volume days',
          settings.showPVI
        )}
      </div>

      {/* Chart */}
      {renderChart()}

      {/* Info Panel */}
      <div className="mt-6 bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
        <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2 flex items-center">
          <Info className="w-4 h-4 mr-2" />
          Volume Indicators Guide
        </h4>
        <div className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
          <p>• <strong>OBV:</strong> Tracks cumulative volume flow to confirm price trends</p>
          <p>• <strong>A/D Line:</strong> Measures volume-weighted accumulation/distribution</p>
          <p>• <strong>CMF:</strong> Oscillator showing money flow over specific period</p>
          <p>• <strong>VPT:</strong> Combines price and volume to show trend strength</p>
          <p>• <strong>NVI/PVI:</strong> Separate smart money from retail trading activity</p>
        </div>
      </div>
    </div>
  );
};

export default VolumeIndicators;