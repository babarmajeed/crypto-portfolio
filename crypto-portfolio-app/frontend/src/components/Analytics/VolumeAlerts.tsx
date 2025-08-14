import React, { useState, useMemo, useEffect } from 'react';
import {
  Bell,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Activity,
  Target,
  Zap,
  Settings,
  Plus,
  X,
  Check,
  Clock,
  BarChart3
} from 'lucide-react';
import {
  VolumeData,
  VolumeTrends,
  VolumeIndicators,
  OrderBook,
  LiquidityMetrics
} from '../../services/VolumeAnalysisService';

interface VolumeAlertsProps {
  volumeData: VolumeData[];
  volumeTrends: VolumeTrends | null;
  volumeIndicators: VolumeIndicators | null;
  orderBook: OrderBook | null;
  liquidityMetrics: LiquidityMetrics | null;
  symbol?: string;
  className?: string;
}

interface AlertRule {
  id: string;
  name: string;
  type: 'volume_spike' | 'volume_divergence' | 'spread_change' | 'liquidity_drop' | 'imbalance' | 'vwap_break';
  condition: {
    metric: string;
    operator: '>' | '<' | '=' | '>=' | '<=';
    value: number;
    timeframe?: string;
  };
  enabled: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  notificationMethod: 'browser' | 'email' | 'both';
  cooldown: number; // minutes
  lastTriggered?: number;
}

interface ActiveAlert {
  id: string;
  ruleId: string;
  ruleName: string;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: number;
  data: any;
  acknowledged: boolean;
}

const VolumeAlerts: React.FC<VolumeAlertsProps> = ({
  volumeData,
  volumeTrends,
  volumeIndicators,
  orderBook,
  liquidityMetrics,
  symbol = 'BTC/USD',
  className = ''
}) => {
  const [alertRules, setAlertRules] = useState<AlertRule[]>([
    {
      id: 'volume-spike-1',
      name: 'High Volume Spike',
      type: 'volume_spike',
      condition: {
        metric: 'volume_change',
        operator: '>',
        value: 200,
        timeframe: '1h'
      },
      enabled: true,
      severity: 'high',
      notificationMethod: 'browser',
      cooldown: 30
    },
    {
      id: 'spread-wide-1',
      name: 'Wide Bid-Ask Spread',
      type: 'spread_change',
      condition: {
        metric: 'spread_percentage',
        operator: '>',
        value: 0.5
      },
      enabled: true,
      severity: 'medium',
      notificationMethod: 'browser',
      cooldown: 15
    },
    {
      id: 'liquidity-drop-1',
      name: 'Low Liquidity Alert',
      type: 'liquidity_drop',
      condition: {
        metric: 'liquidity_score',
        operator: '<',
        value: 3
      },
      enabled: true,
      severity: 'critical',
      notificationMethod: 'both',
      cooldown: 60
    },
    {
      id: 'volume-imbalance-1',
      name: 'Strong Volume Imbalance',
      type: 'imbalance',
      condition: {
        metric: 'volume_imbalance',
        operator: '>',
        value: 0.7
      },
      enabled: false,
      severity: 'medium',
      notificationMethod: 'browser',
      cooldown: 20
    }
  ]);

  const [activeAlerts, setActiveAlerts] = useState<ActiveAlert[]>([]);
  const [showRuleEditor, setShowRuleEditor] = useState(false);
  const [editingRule, setEditingRule] = useState<AlertRule | null>(null);

  // Calculate current metrics for alert evaluation
  const currentMetrics = useMemo(() => {
    const metrics: { [key: string]: number } = {};

    // Volume metrics
    if (volumeTrends) {
      metrics.volume_change = Math.abs(volumeTrends.volumeChange);
      metrics.volume_trend_strength = volumeTrends.strength === 'strong' ? 3 : volumeTrends.strength === 'medium' ? 2 : 1;
    }

    // Spread metrics
    if (orderBook) {
      metrics.spread_absolute = orderBook.spread;
      metrics.spread_percentage = (orderBook.spread / orderBook.mid) * 100;
    }

    // Liquidity metrics
    if (liquidityMetrics) {
      metrics.liquidity_score = liquidityMetrics.liquidityScore;
      metrics.market_impact = liquidityMetrics.marketImpact;
    }

    // Volume imbalance
    if (orderBook) {
      const bidQuantity = orderBook.bids.slice(0, 10).reduce((sum, bid) => sum + bid.quantity, 0);
      const askQuantity = orderBook.asks.slice(0, 10).reduce((sum, ask) => sum + ask.quantity, 0);
      metrics.volume_imbalance = Math.abs((bidQuantity - askQuantity) / (bidQuantity + askQuantity));
    }

    // Volume indicators
    if (volumeIndicators) {
      const latestOBV = volumeIndicators.obv[volumeIndicators.obv.length - 1];
      const prevOBV = volumeIndicators.obv[volumeIndicators.obv.length - 2];
      if (latestOBV && prevOBV) {
        metrics.obv_change = Math.abs((latestOBV.value - prevOBV.value) / prevOBV.value) * 100;
      }
    }

    return metrics;
  }, [volumeTrends, orderBook, liquidityMetrics, volumeIndicators]);

  // Evaluate alert rules
  const evaluateAlerts = useMemo(() => {
    const newAlerts: ActiveAlert[] = [];
    const now = Date.now();

    alertRules.forEach(rule => {
      if (!rule.enabled) return;

      // Check cooldown
      if (rule.lastTriggered && (now - rule.lastTriggered) < (rule.cooldown * 60 * 1000)) {
        return;
      }

      const metricValue = currentMetrics[rule.condition.metric];
      if (metricValue === undefined) return;

      let triggered = false;
      const { operator, value } = rule.condition;

      switch (operator) {
        case '>':
          triggered = metricValue > value;
          break;
        case '<':
          triggered = metricValue < value;
          break;
        case '>=':
          triggered = metricValue >= value;
          break;
        case '<=':
          triggered = metricValue <= value;
          break;
        case '=':
          triggered = Math.abs(metricValue - value) < 0.01;
          break;
      }

      if (triggered) {
        const alert: ActiveAlert = {
          id: `alert-${rule.id}-${now}`,
          ruleId: rule.id,
          ruleName: rule.name,
          message: generateAlertMessage(rule, metricValue),
          severity: rule.severity,
          timestamp: now,
          data: { metric: rule.condition.metric, value: metricValue, threshold: value },
          acknowledged: false
        };

        newAlerts.push(alert);

        // Update last triggered time
        setAlertRules(prev => prev.map(r => 
          r.id === rule.id ? { ...r, lastTriggered: now } : r
        ));

        // Send notification
        if (rule.notificationMethod === 'browser' || rule.notificationMethod === 'both') {
          sendBrowserNotification(alert);
        }
      }
    });

    return newAlerts;
  }, [alertRules, currentMetrics]);

  // Update active alerts
  useEffect(() => {
    if (evaluateAlerts.length > 0) {
      setActiveAlerts(prev => [...evaluateAlerts, ...prev].slice(0, 50)); // Keep last 50 alerts
    }
  }, [evaluateAlerts]);

  // Generate alert message
  const generateAlertMessage = (rule: AlertRule, value: number): string => {
    const formatValue = (val: number) => {
      if (rule.condition.metric.includes('percentage')) return `${val.toFixed(2)}%`;
      if (rule.condition.metric.includes('score')) return val.toFixed(1);
      return val.toFixed(2);
    };

    switch (rule.type) {
      case 'volume_spike':
        return `Volume change of ${formatValue(value)} detected for ${symbol}`;
      case 'spread_change':
        return `Bid-ask spread is ${formatValue(value)} for ${symbol}`;
      case 'liquidity_drop':
        return `Low liquidity detected: score ${formatValue(value)} for ${symbol}`;
      case 'imbalance':
        return `Strong volume imbalance of ${formatValue(value)} detected for ${symbol}`;
      default:
        return `${rule.name} triggered for ${symbol}: ${formatValue(value)}`;
    }
  };

  // Send browser notification
  const sendBrowserNotification = (alert: ActiveAlert) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(`Volume Alert: ${alert.ruleName}`, {
        body: alert.message,
        icon: '/favicon.ico'
      });
    }
  };

  // Request notification permission
  const requestNotificationPermission = async () => {
    if ('Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission();
    }
  };

  // Acknowledge alert
  const acknowledgeAlert = (alertId: string) => {
    setActiveAlerts(prev => prev.map(alert => 
      alert.id === alertId ? { ...alert, acknowledged: true } : alert
    ));
  };

  // Get severity color
  const getSeverityColor = (severity: string): string => {
    switch (severity) {
      case 'critical': return 'text-red-600 bg-red-100 dark:bg-red-900/20 border-red-200 dark:border-red-800';
      case 'high': return 'text-orange-600 bg-orange-100 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800';
      case 'medium': return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800';
      default: return 'text-blue-600 bg-blue-100 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800';
    }
  };

  // Get severity icon
  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return <AlertTriangle className="w-4 h-4" />;
      case 'high': return <TrendingUp className="w-4 h-4" />;
      case 'medium': return <Activity className="w-4 h-4" />;
      default: return <Bell className="w-4 h-4" />;
    }
  };

  // Format timestamp
  const formatTimestamp = (timestamp: number): string => {
    return new Date(timestamp).toLocaleTimeString();
  };

  return (
    <div className={`volume-alerts ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center">
            <Bell className="w-5 h-5 mr-2" />
            Volume Alerts & Signals
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Real-time monitoring and alerts for volume-based trading signals
          </p>
        </div>
        
        <div className="flex items-center space-x-3">
          <button
            onClick={requestNotificationPermission}
            className="flex items-center space-x-2 px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-sm"
          >
            <Bell className="w-4 h-4" />
            <span>Enable Notifications</span>
          </button>
          
          <button
            onClick={() => setShowRuleEditor(true)}
            className="flex items-center space-x-2 px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Add Rule</span>
          </button>
        </div>
      </div>

      {/* Active Alerts */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700 mb-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Active Alerts ({activeAlerts.filter(a => !a.acknowledged).length})
        </h3>
        
        {activeAlerts.length > 0 ? (
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {activeAlerts.slice(0, 10).map((alert) => (
              <div
                key={alert.id}
                className={`p-3 rounded-lg border ${getSeverityColor(alert.severity)} ${
                  alert.acknowledged ? 'opacity-50' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    {getSeverityIcon(alert.severity)}
                    <div>
                      <div className="font-medium">{alert.ruleName}</div>
                      <div className="text-sm">{alert.message}</div>
                      <div className="text-xs opacity-75">
                        {formatTimestamp(alert.timestamp)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getSeverityColor(alert.severity)}`}>
                      {alert.severity.toUpperCase()}
                    </span>
                    {!alert.acknowledged && (
                      <button
                        onClick={() => acknowledgeAlert(alert.id)}
                        className="p-1 text-gray-500 hover:text-green-600 transition-colors"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <Bell className="w-8 h-8 mx-auto mb-2" />
            <p>No active alerts</p>
            <p className="text-sm mt-1">All systems monitoring normally</p>
          </div>
        )}
      </div>

      {/* Current Metrics */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700 mb-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Current Volume Metrics
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Object.entries(currentMetrics).map(([key, value]) => (
            <div key={key} className="text-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div className="text-lg font-bold text-gray-900 dark:text-white">
                {key.includes('percentage') ? `${value.toFixed(2)}%` : value.toFixed(2)}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Alert Rules */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Alert Rules ({alertRules.filter(r => r.enabled).length} active)
        </h3>
        
        <div className="space-y-3">
          {alertRules.map((rule) => (
            <div
              key={rule.id}
              className={`p-4 border border-gray-200 dark:border-gray-700 rounded-lg ${
                rule.enabled ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className={`p-2 rounded-full ${getSeverityColor(rule.severity)}`}>
                    {getSeverityIcon(rule.severity)}
                  </div>
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">
                      {rule.name}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      {rule.condition.metric.replace(/_/g, ' ')} {rule.condition.operator} {rule.condition.value}
                      {rule.condition.timeframe && ` (${rule.condition.timeframe})`}
                    </div>
                    <div className="text-xs text-gray-400">
                      Cooldown: {rule.cooldown}min • {rule.notificationMethod}
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getSeverityColor(rule.severity)}`}>
                    {rule.severity}
                  </span>
                  <button
                    onClick={() => setAlertRules(prev => prev.map(r => 
                      r.id === rule.id ? { ...r, enabled: !r.enabled } : r
                    ))}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      rule.enabled 
                        ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-500'
                    }`}
                  >
                    {rule.enabled ? 'Enabled' : 'Disabled'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Rule Editor Modal */}
      {showRuleEditor && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {editingRule ? 'Edit Alert Rule' : 'Add Alert Rule'}
              </h3>
              <button
                onClick={() => {
                  setShowRuleEditor(false);
                  setEditingRule(null);
                }}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <Settings className="w-12 h-12 mx-auto mb-4" />
              <p>Alert rule editor</p>
              <p className="text-sm mt-2">Feature coming soon</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VolumeAlerts;