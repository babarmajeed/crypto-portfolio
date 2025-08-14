import React, { useState, useEffect, useCallback } from 'react';
import { Plus, X, Settings, TrendingUp, BarChart3, Activity, Target } from 'lucide-react';
import { IChartApi, ISeriesApi, ColorType } from 'lightweight-charts';
import { technicalAnalysisService } from '../../services/TechnicalAnalysisService';
import { useResponsive } from '../../hooks/useResponsive';

interface CandlestickData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

interface TechnicalIndicator {
  id: string;
  type: string;
  name: string;
  settings: Record<string, any>;
  color: string;
  visible: boolean;
  series?: ISeriesApi<any>;
  panel?: 'main' | 'separate';
}

interface TechnicalIndicatorsProps {
  chart: IChartApi | null;
  data: CandlestickData[];
  className?: string;
}

interface IndicatorTemplate {
  type: string;
  name: string;
  description: string;
  icon: React.ComponentType<any>;
  category: 'trend' | 'momentum' | 'volatility' | 'volume';
  defaultSettings: Record<string, any>;
  panel: 'main' | 'separate';
}

const indicatorTemplates: IndicatorTemplate[] = [
  // Trend Indicators
  {
    type: 'sma',
    name: 'Simple Moving Average',
    description: 'Average price over a specific period',
    icon: TrendingUp,
    category: 'trend',
    defaultSettings: { period: 20 },
    panel: 'main'
  },
  {
    type: 'ema',
    name: 'Exponential Moving Average',
    description: 'Weighted average giving more importance to recent prices',
    icon: TrendingUp,
    category: 'trend',
    defaultSettings: { period: 20 },
    panel: 'main'
  },
  {
    type: 'bollinger',
    name: 'Bollinger Bands',
    description: 'Price channel based on standard deviation',
    icon: BarChart3,
    category: 'volatility',
    defaultSettings: { period: 20, stdDev: 2 },
    panel: 'main'
  },
  
  // Momentum Indicators
  {
    type: 'rsi',
    name: 'RSI',
    description: 'Relative Strength Index momentum oscillator',
    icon: Activity,
    category: 'momentum',
    defaultSettings: { period: 14 },
    panel: 'separate'
  },
  {
    type: 'macd',
    name: 'MACD',
    description: 'Moving Average Convergence Divergence',
    icon: Activity,
    category: 'momentum',
    defaultSettings: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 },
    panel: 'separate'
  },
  {
    type: 'stochastic',
    name: 'Stochastic',
    description: 'Momentum oscillator comparing closing price to price range',
    icon: Activity,
    category: 'momentum',
    defaultSettings: { kPeriod: 14, dPeriod: 3 },
    panel: 'separate'
  },
  
  // Volatility Indicators
  {
    type: 'atr',
    name: 'ATR',
    description: 'Average True Range volatility indicator',
    icon: BarChart3,
    category: 'volatility',
    defaultSettings: { period: 14 },
    panel: 'separate'
  },
  
  // Volume Indicators
  {
    type: 'vwap',
    name: 'VWAP',
    description: 'Volume Weighted Average Price',
    icon: Target,
    category: 'volume',
    defaultSettings: {},
    panel: 'main'
  }
];

const indicatorColors = [
  '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6',
  '#f97316', '#06b6d4', '#84cc16', '#ec4899', '#6366f1'
];

const TechnicalIndicators: React.FC<TechnicalIndicatorsProps> = ({
  chart,
  data,
  className = ''
}) => {
  const [indicators, setIndicators] = useState<TechnicalIndicator[]>([]);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [editingIndicator, setEditingIndicator] = useState<string | null>(null);
  const [colorIndex, setColorIndex] = useState(0);
  
  const { isMobile } = useResponsive();

  const getNextColor = useCallback(() => {
    const color = indicatorColors[colorIndex % indicatorColors.length];
    setColorIndex(prev => prev + 1);
    return color;
  }, [colorIndex]);

  const addIndicator = useCallback((template: IndicatorTemplate, customSettings?: Record<string, any>) => {
    if (!chart || !data || data.length === 0) return;

    const settings = { ...template.defaultSettings, ...customSettings };
    const color = getNextColor();
    const id = `${template.type}_${Date.now()}`;

    const newIndicator: TechnicalIndicator = {
      id,
      type: template.type,
      name: `${template.name}(${Object.values(settings).join(',')})`,
      settings,
      color,
      visible: true,
      panel: template.panel
    };

    // Calculate indicator data
    let indicatorData: any = [];
    let series: ISeriesApi<any> | undefined;

    try {
      switch (template.type) {
        case 'sma':
          indicatorData = technicalAnalysisService.calculateSMA(data, settings.period);
          series = chart.addLineSeries({
            color,
            lineWidth: 2,
            title: newIndicator.name,
          });
          series.setData(indicatorData);
          break;

        case 'ema':
          indicatorData = technicalAnalysisService.calculateEMA(data, settings.period);
          series = chart.addLineSeries({
            color,
            lineWidth: 2,
            title: newIndicator.name,
          });
          series.setData(indicatorData);
          break;

        case 'bollinger':
          const bbData = technicalAnalysisService.calculateBollingerBands(
            data, 
            settings.period, 
            settings.stdDev
          );
          
          // Create three series for Bollinger Bands
          const upperSeries = chart.addLineSeries({
            color,
            lineWidth: 1,
            title: `${newIndicator.name} Upper`,
          });
          const middleSeries = chart.addLineSeries({
            color,
            lineWidth: 2,
            title: `${newIndicator.name} Middle`,
          });
          const lowerSeries = chart.addLineSeries({
            color,
            lineWidth: 1,
            title: `${newIndicator.name} Lower`,
          });

          const upperData = bbData.map(item => ({ time: item.time, value: item.upper }));
          const middleData = bbData.map(item => ({ time: item.time, value: item.middle }));
          const lowerData = bbData.map(item => ({ time: item.time, value: item.lower }));

          upperSeries.setData(upperData);
          middleSeries.setData(middleData);
          lowerSeries.setData(lowerData);

          series = { upper: upperSeries, middle: middleSeries, lower: lowerSeries };
          break;

        case 'rsi':
          indicatorData = technicalAnalysisService.calculateRSI(data, settings.period);
          // Note: RSI should be displayed in a separate panel
          console.log('RSI data calculated, needs separate panel implementation');
          break;

        case 'macd':
          indicatorData = technicalAnalysisService.calculateMACD(
            data,
            settings.fastPeriod,
            settings.slowPeriod,
            settings.signalPeriod
          );
          // Note: MACD should be displayed in a separate panel
          console.log('MACD data calculated, needs separate panel implementation');
          break;

        case 'vwap':
          indicatorData = technicalAnalysisService.calculateVWAP(data);
          series = chart.addLineSeries({
            color,
            lineWidth: 2,
            title: newIndicator.name,
          });
          series.setData(indicatorData);
          break;

        default:
          console.warn(`Unknown indicator type: ${template.type}`);
          return;
      }

      newIndicator.series = series;
      setIndicators(prev => [...prev, newIndicator]);
      setShowAddMenu(false);
    } catch (error) {
      console.error('Error adding indicator:', error);
    }
  }, [chart, data, getNextColor]);

  const removeIndicator = useCallback((indicatorId: string) => {
    setIndicators(prev => {
      const indicator = prev.find(ind => ind.id === indicatorId);
      if (indicator?.series && chart) {
        if (typeof indicator.series.remove === 'function') {
          // Single series
          chart.removeSeries(indicator.series);
        } else {
          // Multiple series (like Bollinger Bands)
          Object.values(indicator.series).forEach((series: any) => {
            if (series && typeof series.remove === 'function') {
              chart.removeSeries(series);
            }
          });
        }
      }
      return prev.filter(ind => ind.id !== indicatorId);
    });
  }, [chart]);

  const toggleIndicatorVisibility = useCallback((indicatorId: string) => {
    setIndicators(prev => prev.map(indicator => {
      if (indicator.id === indicatorId) {
        const newVisibility = !indicator.visible;
        
        // Update series visibility
        if (indicator.series) {
          if (typeof indicator.series.applyOptions === 'function') {
            indicator.series.applyOptions({ visible: newVisibility });
          } else {
            // Multiple series
            Object.values(indicator.series).forEach((series: any) => {
              if (series && typeof series.applyOptions === 'function') {
                series.applyOptions({ visible: newVisibility });
              }
            });
          }
        }
        
        return { ...indicator, visible: newVisibility };
      }
      return indicator;
    }));
  }, []);

  // Recalculate all indicators when data changes
  useEffect(() => {
    if (!chart || !data || data.length === 0) return;

    indicators.forEach(indicator => {
      if (!indicator.series) return;

      try {
        let newData: any = [];

        switch (indicator.type) {
          case 'sma':
            newData = technicalAnalysisService.calculateSMA(data, indicator.settings.period);
            if (typeof indicator.series.setData === 'function') {
              indicator.series.setData(newData);
            }
            break;

          case 'ema':
            newData = technicalAnalysisService.calculateEMA(data, indicator.settings.period);
            if (typeof indicator.series.setData === 'function') {
              indicator.series.setData(newData);
            }
            break;

          case 'bollinger':
            const bbData = technicalAnalysisService.calculateBollingerBands(
              data,
              indicator.settings.period,
              indicator.settings.stdDev
            );
            
            if (indicator.series && typeof indicator.series === 'object') {
              const { upper, middle, lower } = indicator.series as any;
              if (upper && middle && lower) {
                upper.setData(bbData.map((item: any) => ({ time: item.time, value: item.upper })));
                middle.setData(bbData.map((item: any) => ({ time: item.time, value: item.middle })));
                lower.setData(bbData.map((item: any) => ({ time: item.time, value: item.lower })));
              }
            }
            break;

          case 'vwap':
            newData = technicalAnalysisService.calculateVWAP(data);
            if (typeof indicator.series.setData === 'function') {
              indicator.series.setData(newData);
            }
            break;
        }
      } catch (error) {
        console.error(`Error updating indicator ${indicator.type}:`, error);
      }
    });
  }, [chart, data, indicators]);

  const categories = ['all', 'trend', 'momentum', 'volatility', 'volume'];
  const filteredTemplates = selectedCategory === 'all' 
    ? indicatorTemplates 
    : indicatorTemplates.filter(template => template.category === selectedCategory);

  if (isMobile) {
    return (
      <div className={`technical-indicators-mobile ${className}`}>
        {/* Mobile indicator pills */}
        {indicators.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {indicators.map(indicator => (
              <div
                key={indicator.id}
                className="flex items-center bg-white dark:bg-gray-800 rounded-full px-2 py-1 text-xs border"
                style={{ borderColor: indicator.color }}
              >
                <div
                  className="w-2 h-2 rounded-full mr-1"
                  style={{ backgroundColor: indicator.color }}
                />
                <span className="text-gray-700 dark:text-gray-300 mr-1">
                  {indicator.name}
                </span>
                <button
                  onClick={() => removeIndicator(indicator.id)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Add indicator button */}
        <button
          onClick={() => setShowAddMenu(!showAddMenu)}
          className="flex items-center space-x-1 px-3 py-1 bg-blue-600 text-white rounded-full text-xs"
        >
          <Plus className="w-3 h-3" />
          <span>Indicators</span>
        </button>

        {/* Mobile add menu */}
        {showAddMenu && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-end">
            <div className="bg-white dark:bg-gray-800 w-full rounded-t-lg max-h-96 overflow-y-auto">
              <div className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">Add Indicator</h3>
                  <button
                    onClick={() => setShowAddMenu(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-2">
                  {filteredTemplates.map(template => {
                    const IconComponent = template.icon;
                    return (
                      <button
                        key={template.type}
                        onClick={() => addIndicator(template)}
                        className="w-full flex items-center space-x-3 p-3 text-left hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                      >
                        <IconComponent className="w-5 h-5 text-gray-500" />
                        <div>
                          <div className="font-medium text-gray-900 dark:text-white">
                            {template.name}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            {template.description}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`technical-indicators ${className}`}>
      {/* Active indicators */}
      {indicators.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3 mb-2">
          <div className="space-y-2">
            {indicators.map(indicator => (
              <div key={indicator.id} className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => toggleIndicatorVisibility(indicator.id)}
                    className="w-3 h-3 rounded border"
                    style={{ 
                      backgroundColor: indicator.visible ? indicator.color : 'transparent',
                      borderColor: indicator.color 
                    }}
                  />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {indicator.name}
                  </span>
                </div>
                
                <div className="flex items-center space-x-1">
                  <button
                    onClick={() => setEditingIndicator(indicator.id)}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    title="Settings"
                  >
                    <Settings className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => removeIndicator(indicator.id)}
                    className="text-gray-400 hover:text-red-600"
                    title="Remove"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add indicator menu */}
      <div className="relative">
        <button
          onClick={() => setShowAddMenu(!showAddMenu)}
          className="flex items-center space-x-2 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm"
        >
          <Plus className="w-4 h-4" />
          <span className="text-gray-700 dark:text-gray-300">Add Indicator</span>
        </button>

        {showAddMenu && (
          <>
            {/* Backdrop */}
            <div 
              className="fixed inset-0 z-40"
              onClick={() => setShowAddMenu(false)}
            />
            
            {/* Menu */}
            <div className="absolute top-full left-0 mt-1 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50 min-w-80">
              <div className="p-4">
                {/* Category filter */}
                <div className="flex space-x-1 mb-4 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
                  {categories.map(category => (
                    <button
                      key={category}
                      onClick={() => setSelectedCategory(category)}
                      className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                        selectedCategory === category
                          ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white'
                          : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                      }`}
                    >
                      {category.charAt(0).toUpperCase() + category.slice(1)}
                    </button>
                  ))}
                </div>

                {/* Indicator list */}
                <div className="space-y-1 max-h-64 overflow-y-auto">
                  {filteredTemplates.map(template => {
                    const IconComponent = template.icon;
                    return (
                      <button
                        key={template.type}
                        onClick={() => addIndicator(template)}
                        className="w-full flex items-center space-x-3 p-3 text-left hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                      >
                        <IconComponent className="w-4 h-4 text-gray-500" />
                        <div className="flex-1">
                          <div className="font-medium text-gray-900 dark:text-white text-sm">
                            {template.name}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {template.description}
                          </div>
                        </div>
                        <div className="text-xs text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                          {template.panel}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default TechnicalIndicators;