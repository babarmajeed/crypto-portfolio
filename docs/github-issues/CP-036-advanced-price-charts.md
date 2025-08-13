# CP-036: Advanced Price Charts with Technical Indicators

## Overview
Build sophisticated cryptocurrency price charts with multiple timeframes, technical indicators, drawing tools, and interactive features using modern charting libraries like TradingView or Chart.js.

## Objectives
- Implement professional-grade price charts with candlestick patterns
- Add technical indicators (RSI, MACD, Bollinger Bands, etc.)
- Create drawing tools and chart annotations
- Build multi-timeframe analysis capabilities

## Acceptance Criteria
- [ ] Candlestick, line, and area chart types
- [ ] Multiple timeframes (1m, 5m, 15m, 1h, 4h, 1d, 1w, 1M)
- [ ] Technical indicators overlay and separate panels
- [ ] Drawing tools (trend lines, fibonacci retracements, shapes)
- [ ] Volume analysis and volume-based indicators
- [ ] Chart synchronization across multiple assets
- [ ] Export functionality (PNG, PDF, CSV data)
- [ ] Real-time updates with smooth animations
- [ ] Customizable color schemes and themes
- [ ] Mobile-optimized touch interactions

## Technical Implementation

### File Structure
```
src/
  components/
    Charts/
      AdvancedChart.jsx
      ChartContainer.jsx
      TechnicalIndicators.jsx
      DrawingTools.jsx
      TimeframeSelector.jsx
      ChartSettings.jsx
  hooks/
    useChartData.js
    useTechnicalIndicators.js
    useDrawingTools.js
  services/
    ChartDataService.js
    TechnicalAnalysisService.js
  utils/
    chartCalculations.js
    technicalIndicators.js
```

### Advanced Chart Component
```jsx
// AdvancedChart.jsx
import React, { useRef, useEffect, useState } from 'react';
import { createChart, ColorType, CrosshairMode } from 'lightweight-charts';
import { useChartData } from '../hooks/useChartData';
import { useTechnicalIndicators } from '../hooks/useTechnicalIndicators';
import TimeframeSelector from './TimeframeSelector';
import TechnicalIndicators from './TechnicalIndicators';
import DrawingTools from './DrawingTools';
import ChartSettings from './ChartSettings';

const AdvancedChart = ({ 
  symbol, 
  height = 500,
  showIndicators = true,
  showDrawingTools = true,
  theme = 'light'
}) => {
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const candlestickSeriesRef = useRef(null);
  const volumeSeriesRef = useRef(null);
  
  const [timeframe, setTimeframe] = useState('1h');
  const [chartType, setChartType] = useState('candlestick');
  const [activeIndicators, setActiveIndicators] = useState([]);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const {
    chartData,
    volumeData,
    isLoading,
    error,
    subscribeToRealTimeUpdates,
    unsubscribeFromRealTimeUpdates
  } = useChartData(symbol, timeframe);

  const {
    indicators,
    addIndicator,
    removeIndicator,
    updateIndicatorSettings
  } = useTechnicalIndicators(chartData);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    // Initialize chart
    chartRef.current = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: height,
      layout: {
        background: {
          type: ColorType.Solid,
          color: theme === 'dark' ? '#1a1a1a' : '#ffffff',
        },
        textColor: theme === 'dark' ? '#ffffff' : '#000000',
      },
      grid: {
        vertLines: {
          color: theme === 'dark' ? '#2a2a2a' : '#f0f0f0',
        },
        horzLines: {
          color: theme === 'dark' ? '#2a2a2a' : '#f0f0f0',
        },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
      },
      rightPriceScale: {
        borderColor: theme === 'dark' ? '#2a2a2a' : '#cccccc',
      },
      timeScale: {
        borderColor: theme === 'dark' ? '#2a2a2a' : '#cccccc',
        timeVisible: true,
        secondsVisible: false,
      },
    });

    // Add main price series
    if (chartType === 'candlestick') {
      candlestickSeriesRef.current = chartRef.current.addCandlestickSeries({
        upColor: '#00c851',
        downColor: '#ff4444',
        borderDownColor: '#ff4444',
        borderUpColor: '#00c851',
        wickDownColor: '#ff4444',
        wickUpColor: '#00c851',
      });
    } else {
      candlestickSeriesRef.current = chartRef.current.addLineSeries({
        color: '#007bff',
        lineWidth: 2,
      });
    }

    // Add volume series
    volumeSeriesRef.current = chartRef.current.addHistogramSeries({
      color: '#26a69a',
      priceFormat: {
        type: 'volume',
      },
      priceScaleId: 'volume',
    });

    chartRef.current.priceScale('volume').applyOptions({
      scaleMargins: {
        top: 0.8,
        bottom: 0,
      },
    });

    // Handle resize
    const handleResize = () => {
      if (chartRef.current && chartContainerRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
        });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (chartRef.current) {
        chartRef.current.remove();
      }
    };
  }, [height, theme, chartType]);

  // Update chart data
  useEffect(() => {
    if (chartData && candlestickSeriesRef.current) {
      const formattedData = chartData.map(candle => ({
        time: candle.time,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
      }));

      if (chartType === 'candlestick') {
        candlestickSeriesRef.current.setData(formattedData);
      } else {
        const lineData = formattedData.map(item => ({
          time: item.time,
          value: item.close,
        }));
        candlestickSeriesRef.current.setData(lineData);
      }
    }

    if (volumeData && volumeSeriesRef.current) {
      const formattedVolumeData = volumeData.map(volume => ({
        time: volume.time,
        value: volume.volume,
        color: volume.close > volume.open ? '#00c851' : '#ff4444',
      }));

      volumeSeriesRef.current.setData(formattedVolumeData);
    }
  }, [chartData, volumeData, chartType]);

  // Subscribe to real-time updates
  useEffect(() => {
    if (symbol && timeframe) {
      subscribeToRealTimeUpdates();
    }

    return () => {
      unsubscribeFromRealTimeUpdates();
    };
  }, [symbol, timeframe]);

  // Add technical indicators to chart
  useEffect(() => {
    if (!chartRef.current) return;

    // Remove existing indicator series
    activeIndicators.forEach(indicator => {
      if (indicator.series) {
        chartRef.current.removeSeries(indicator.series);
      }
    });

    // Add new indicator series
    const newActiveIndicators = indicators.map(indicator => {
      let series;
      
      switch (indicator.type) {
        case 'sma':
        case 'ema':
          series = chartRef.current.addLineSeries({
            color: indicator.color,
            lineWidth: 2,
            title: indicator.name,
          });
          series.setData(indicator.data);
          break;
          
        case 'bollinger':
          // Add three lines for Bollinger Bands
          const upperSeries = chartRef.current.addLineSeries({
            color: indicator.color,
            lineWidth: 1,
            title: `${indicator.name} Upper`,
          });
          const middleSeries = chartRef.current.addLineSeries({
            color: indicator.color,
            lineWidth: 2,
            title: `${indicator.name} Middle`,
          });
          const lowerSeries = chartRef.current.addLineSeries({
            color: indicator.color,
            lineWidth: 1,
            title: `${indicator.name} Lower`,
          });
          
          upperSeries.setData(indicator.data.upper);
          middleSeries.setData(indicator.data.middle);
          lowerSeries.setData(indicator.data.lower);
          
          series = { upper: upperSeries, middle: middleSeries, lower: lowerSeries };
          break;
          
        default:
          series = chartRef.current.addLineSeries({
            color: indicator.color,
            lineWidth: 2,
            title: indicator.name,
          });
          series.setData(indicator.data);
      }

      return { ...indicator, series };
    });

    setActiveIndicators(newActiveIndicators);
  }, [indicators]);

  const handleTimeframeChange = (newTimeframe) => {
    setTimeframe(newTimeframe);
  };

  const handleChartTypeChange = (newChartType) => {
    setChartType(newChartType);
  };

  const handleIndicatorAdd = (indicatorType, settings) => {
    addIndicator(indicatorType, settings);
  };

  const handleIndicatorRemove = (indicatorId) => {
    removeIndicator(indicatorId);
  };

  const handleExportChart = (format) => {
    if (!chartRef.current) return;

    if (format === 'png') {
      const canvas = chartContainerRef.current.querySelector('canvas');
      const link = document.createElement('a');
      link.download = `${symbol}-${timeframe}-chart.png`;
      link.href = canvas.toDataURL();
      link.click();
    } else if (format === 'csv') {
      exportChartDataAsCSV();
    }
  };

  const exportChartDataAsCSV = () => {
    if (!chartData) return;

    const csvHeaders = ['Date', 'Open', 'High', 'Low', 'Close', 'Volume'];
    const csvRows = chartData.map(candle => [
      new Date(candle.time * 1000).toISOString(),
      candle.open,
      candle.high,
      candle.low,
      candle.close,
      candle.volume || 0
    ]);

    const csvContent = [csvHeaders, ...csvRows]
      .map(row => row.join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${symbol}-${timeframe}-data.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="chart-loading">
        <div className="loading-spinner"></div>
        <p>Loading chart data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="chart-error">
        <p>Error loading chart: {error.message}</p>
        <button onClick={() => window.location.reload()}>Retry</button>
      </div>
    );
  }

  return (
    <div className={`advanced-chart-container ${isFullscreen ? 'fullscreen' : ''}`}>
      <div className="chart-header">
        <div className="chart-title">
          <h3>{symbol} Price Chart</h3>
          <span className="chart-timeframe">{timeframe}</span>
        </div>

        <div className="chart-controls">
          <TimeframeSelector
            selectedTimeframe={timeframe}
            onTimeframeChange={handleTimeframeChange}
          />

          <div className="chart-type-selector">
            <button
              className={chartType === 'candlestick' ? 'active' : ''}
              onClick={() => handleChartTypeChange('candlestick')}
            >
              Candlestick
            </button>
            <button
              className={chartType === 'line' ? 'active' : ''}
              onClick={() => handleChartTypeChange('line')}
            >
              Line
            </button>
          </div>

          {showIndicators && (
            <TechnicalIndicators
              activeIndicators={activeIndicators}
              onAddIndicator={handleIndicatorAdd}
              onRemoveIndicator={handleIndicatorRemove}
              onUpdateSettings={updateIndicatorSettings}
            />
          )}

          <ChartSettings
            onExport={handleExportChart}
            onFullscreenToggle={() => setIsFullscreen(!isFullscreen)}
            isFullscreen={isFullscreen}
          />
        </div>
      </div>

      <div className="chart-content">
        <div
          ref={chartContainerRef}
          className="chart-container"
          style={{ height: `${height}px` }}
        />

        {showDrawingTools && (
          <DrawingTools
            chart={chartRef.current}
            onToolSelect={(tool) => console.log('Tool selected:', tool)}
          />
        )}
      </div>
    </div>
  );
};

export default AdvancedChart;
```

### Chart Data Hook
```javascript
// useChartData.js
import { useState, useEffect, useRef } from 'react';
import { chartDataService } from '../services/ChartDataService';

export const useChartData = (symbol, timeframe) => {
  const [chartData, setChartData] = useState([]);
  const [volumeData, setVolumeData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const websocketRef = useRef(null);

  useEffect(() => {
    loadChartData();
  }, [symbol, timeframe]);

  const loadChartData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const [priceData, volumeDataResult] = await Promise.all([
        chartDataService.getPriceData(symbol, timeframe, 1000),
        chartDataService.getVolumeData(symbol, timeframe, 1000)
      ]);

      setChartData(priceData);
      setVolumeData(volumeDataResult);
    } catch (err) {
      setError(err);
    } finally {
      setIsLoading(false);
    }
  };

  const subscribeToRealTimeUpdates = () => {
    if (websocketRef.current) {
      websocketRef.current.close();
    }

    const ws = new WebSocket(`${process.env.REACT_APP_WS_URL}/chart/${symbol}/${timeframe}`);
    
    ws.onmessage = (event) => {
      const update = JSON.parse(event.data);
      
      if (update.type === 'candle_update') {
        setChartData(prevData => {
          const newData = [...prevData];
          const lastIndex = newData.length - 1;
          
          if (lastIndex >= 0 && newData[lastIndex].time === update.data.time) {
            // Update existing candle
            newData[lastIndex] = update.data;
          } else {
            // Add new candle
            newData.push(update.data);
            
            // Keep only last 1000 candles
            if (newData.length > 1000) {
              newData.shift();
            }
          }
          
          return newData;
        });
      }
      
      if (update.type === 'volume_update') {
        setVolumeData(prevData => {
          const newData = [...prevData];
          const lastIndex = newData.length - 1;
          
          if (lastIndex >= 0 && newData[lastIndex].time === update.data.time) {
            newData[lastIndex] = update.data;
          } else {
            newData.push(update.data);
            
            if (newData.length > 1000) {
              newData.shift();
            }
          }
          
          return newData;
        });
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    ws.onclose = () => {
      console.log('WebSocket connection closed');
      // Attempt to reconnect after 5 seconds
      setTimeout(() => {
        if (websocketRef.current === ws) {
          subscribeToRealTimeUpdates();
        }
      }, 5000);
    };

    websocketRef.current = ws;
  };

  const unsubscribeFromRealTimeUpdates = () => {
    if (websocketRef.current) {
      websocketRef.current.close();
      websocketRef.current = null;
    }
  };

  return {
    chartData,
    volumeData,
    isLoading,
    error,
    subscribeToRealTimeUpdates,
    unsubscribeFromRealTimeUpdates,
    refresh: loadChartData
  };
};
```

### Technical Indicators Hook
```javascript
// useTechnicalIndicators.js
import { useState, useEffect } from 'react';
import { technicalAnalysisService } from '../services/TechnicalAnalysisService';

export const useTechnicalIndicators = (chartData) => {
  const [indicators, setIndicators] = useState([]);

  const addIndicator = (type, settings = {}) => {
    if (!chartData || chartData.length === 0) return;

    const indicatorId = `${type}_${Date.now()}`;
    const defaultSettings = getDefaultSettings(type);
    const finalSettings = { ...defaultSettings, ...settings };

    let indicatorData;
    let color = getIndicatorColor(type);

    switch (type) {
      case 'sma':
        indicatorData = technicalAnalysisService.calculateSMA(
          chartData, 
          finalSettings.period
        );
        break;
        
      case 'ema':
        indicatorData = technicalAnalysisService.calculateEMA(
          chartData, 
          finalSettings.period
        );
        break;
        
      case 'rsi':
        indicatorData = technicalAnalysisService.calculateRSI(
          chartData, 
          finalSettings.period
        );
        break;
        
      case 'macd':
        indicatorData = technicalAnalysisService.calculateMACD(
          chartData, 
          finalSettings.fastPeriod,
          finalSettings.slowPeriod,
          finalSettings.signalPeriod
        );
        break;
        
      case 'bollinger':
        indicatorData = technicalAnalysisService.calculateBollingerBands(
          chartData, 
          finalSettings.period,
          finalSettings.stdDev
        );
        break;
        
      case 'stochastic':
        indicatorData = technicalAnalysisService.calculateStochastic(
          chartData, 
          finalSettings.kPeriod,
          finalSettings.dPeriod
        );
        break;
        
      default:
        console.warn(`Unknown indicator type: ${type}`);
        return;
    }

    const newIndicator = {
      id: indicatorId,
      type,
      name: getIndicatorName(type, finalSettings),
      settings: finalSettings,
      data: indicatorData,
      color,
      visible: true
    };

    setIndicators(prev => [...prev, newIndicator]);
  };

  const removeIndicator = (indicatorId) => {
    setIndicators(prev => prev.filter(ind => ind.id !== indicatorId));
  };

  const updateIndicatorSettings = (indicatorId, newSettings) => {
    setIndicators(prev => prev.map(indicator => {
      if (indicator.id === indicatorId) {
        const updatedSettings = { ...indicator.settings, ...newSettings };
        
        // Recalculate indicator data with new settings
        let newData;
        switch (indicator.type) {
          case 'sma':
            newData = technicalAnalysisService.calculateSMA(
              chartData, 
              updatedSettings.period
            );
            break;
          case 'ema':
            newData = technicalAnalysisService.calculateEMA(
              chartData, 
              updatedSettings.period
            );
            break;
          // Add other indicator recalculations...
          default:
            newData = indicator.data;
        }

        return {
          ...indicator,
          settings: updatedSettings,
          data: newData,
          name: getIndicatorName(indicator.type, updatedSettings)
        };
      }
      return indicator;
    }));
  };

  const toggleIndicatorVisibility = (indicatorId) => {
    setIndicators(prev => prev.map(indicator => 
      indicator.id === indicatorId 
        ? { ...indicator, visible: !indicator.visible }
        : indicator
    ));
  };

  // Recalculate all indicators when chart data changes
  useEffect(() => {
    if (chartData && chartData.length > 0) {
      setIndicators(prev => prev.map(indicator => {
        let newData;
        
        switch (indicator.type) {
          case 'sma':
            newData = technicalAnalysisService.calculateSMA(
              chartData, 
              indicator.settings.period
            );
            break;
          case 'ema':
            newData = technicalAnalysisService.calculateEMA(
              chartData, 
              indicator.settings.period
            );
            break;
          case 'rsi':
            newData = technicalAnalysisService.calculateRSI(
              chartData, 
              indicator.settings.period
            );
            break;
          case 'macd':
            newData = technicalAnalysisService.calculateMACD(
              chartData, 
              indicator.settings.fastPeriod,
              indicator.settings.slowPeriod,
              indicator.settings.signalPeriod
            );
            break;
          case 'bollinger':
            newData = technicalAnalysisService.calculateBollingerBands(
              chartData, 
              indicator.settings.period,
              indicator.settings.stdDev
            );
            break;
          default:
            newData = indicator.data;
        }

        return { ...indicator, data: newData };
      }));
    }
  }, [chartData]);

  return {
    indicators: indicators.filter(ind => ind.visible),
    allIndicators: indicators,
    addIndicator,
    removeIndicator,
    updateIndicatorSettings,
    toggleIndicatorVisibility
  };
};

// Helper functions
const getDefaultSettings = (type) => {
  const defaults = {
    sma: { period: 20 },
    ema: { period: 20 },
    rsi: { period: 14 },
    macd: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 },
    bollinger: { period: 20, stdDev: 2 },
    stochastic: { kPeriod: 14, dPeriod: 3 }
  };
  
  return defaults[type] || {};
};

const getIndicatorName = (type, settings) => {
  switch (type) {
    case 'sma':
      return `SMA(${settings.period})`;
    case 'ema':
      return `EMA(${settings.period})`;
    case 'rsi':
      return `RSI(${settings.period})`;
    case 'macd':
      return `MACD(${settings.fastPeriod},${settings.slowPeriod},${settings.signalPeriod})`;
    case 'bollinger':
      return `BB(${settings.period},${settings.stdDev})`;
    case 'stochastic':
      return `Stoch(${settings.kPeriod},${settings.dPeriod})`;
    default:
      return type.toUpperCase();
  }
};

const getIndicatorColor = (type) => {
  const colors = {
    sma: '#FF6B6B',
    ema: '#4ECDC4',
    rsi: '#45B7D1',
    macd: '#96CEB4',
    bollinger: '#FFEAA7',
    stochastic: '#DDA0DD'
  };
  
  return colors[type] || '#007bff';
};
```

## Testing Requirements
- Chart rendering performance testing
- Real-time data update testing
- Technical indicator calculation accuracy
- Cross-browser compatibility testing
- Mobile touch interaction testing

## Dependencies
- Depends on: CP-021 (Real-time WebSocket Integration)
- Depends on: CP-034 (Mobile Responsive Design)
- Blocks: CP-037 (Multi-Asset Chart Comparison)

## Time Estimate
**Beginner**: 10-12 days
**Intermediate**: 6-8 days
**Advanced**: 4-6 days

## Required Skills
- Advanced charting libraries (TradingView, D3.js, Chart.js)
- Financial data visualization concepts
- Technical analysis knowledge
- Real-time data handling
- Canvas and SVG manipulation