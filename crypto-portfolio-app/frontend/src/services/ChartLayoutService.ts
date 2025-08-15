import {
  ChartLayout,
  LayoutPreset,
  LayoutTemplate,
  LayoutShareSettings,
  LayoutValidationResult,
  LayoutError,
  LayoutAnalytics,
  ChartPanel,
  PanelConfiguration,
  LayoutActionType
} from '../types/chartLayout.types';

export class ChartLayoutService {
  private layouts = new Map<string, ChartLayout>();
  private templates = new Map<string, LayoutTemplate>();
  private sharedLayouts = new Map<string, ChartLayout>();
  private analytics = new Map<string, LayoutAnalytics>();
  private readonly storagePrefix = 'chart-layout';
  private readonly cacheExpiry = 24 * 60 * 60 * 1000; // 24 hours

  constructor() {
    this.loadFromStorage();
  }

  // Layout CRUD operations
  async saveLayout(layout: ChartLayout): Promise<string> {
    try {
      const layoutId = layout.id || this.generateLayoutId();
      const now = new Date().toISOString();
      
      const layoutToSave: ChartLayout = {
        ...layout,
        id: layoutId,
        createdAt: layout.createdAt || now,
        updatedAt: now
      };

      // Validate layout before saving
      const validation = this.validateLayout(layoutToSave);
      if (!validation.isValid) {
        throw new Error(`Layout validation failed: ${validation.errors.join(', ')}`);
      }

      // Save to memory cache
      this.layouts.set(layoutId, layoutToSave);
      
      // Save to localStorage
      this.saveToStorage(layoutId, layoutToSave);
      
      // Update analytics
      this.updateAnalytics(layoutId, { lastSaved: now });
      
      return layoutId;
    } catch (error) {
      console.error('Error saving layout:', error);
      throw this.createLayoutError(
        'SAVE_FAILED',
        'Failed to save layout',
        'persistence',
        error
      );
    }
  }

  async loadLayout(layoutId: string): Promise<ChartLayout> {
    try {
      // Try memory cache first
      if (this.layouts.has(layoutId)) {
        const layout = this.layouts.get(layoutId)!;
        this.updateAnalytics(layoutId, { 
          lastAccessed: new Date().toISOString(),
          views: (this.analytics.get(layoutId)?.usageStats.views || 0) + 1
        });
        return layout;
      }

      // Try localStorage
      const stored = this.loadFromStorage(layoutId);
      if (stored) {
        this.layouts.set(layoutId, stored);
        this.updateAnalytics(layoutId, { 
          lastAccessed: new Date().toISOString(),
          views: (this.analytics.get(layoutId)?.usageStats.views || 0) + 1
        });
        return stored;
      }

      throw new Error(`Layout ${layoutId} not found`);
    } catch (error) {
      console.error('Error loading layout:', error);
      throw this.createLayoutError(
        'LOAD_FAILED',
        `Failed to load layout ${layoutId}`,
        'persistence',
        error
      );
    }
  }

  async deleteLayout(layoutId: string): Promise<boolean> {
    try {
      // Remove from memory
      this.layouts.delete(layoutId);
      
      // Remove from localStorage
      localStorage.removeItem(`${this.storagePrefix}-${layoutId}`);
      
      // Remove analytics
      this.analytics.delete(layoutId);
      localStorage.removeItem(`${this.storagePrefix}-analytics-${layoutId}`);
      
      return true;
    } catch (error) {
      console.error('Error deleting layout:', error);
      throw this.createLayoutError(
        'DELETE_FAILED',
        `Failed to delete layout ${layoutId}`,
        'persistence',
        error
      );
    }
  }

  async getUserLayouts(userId?: string): Promise<ChartLayout[]> {
    try {
      const layouts: ChartLayout[] = [];
      
      // Get all layouts from localStorage
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(`${this.storagePrefix}-`) && !key.includes('analytics')) {
          try {
            const layout = JSON.parse(localStorage.getItem(key) || '');
            if (!userId || layout.createdBy === userId) {
              layouts.push(layout);
            }
          } catch (error) {
            console.warn(`Failed to parse layout from ${key}:`, error);
          }
        }
      }

      // Sort by updatedAt descending
      return layouts.sort((a, b) => 
        new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime()
      );
    } catch (error) {
      console.error('Error getting user layouts:', error);
      return [];
    }
  }

  // Layout sharing
  async shareLayout(layoutId: string, shareSettings: LayoutShareSettings): Promise<string> {
    try {
      const layout = await this.loadLayout(layoutId);
      const shareId = this.generateShareId();
      
      const sharedLayout: ChartLayout = {
        ...layout,
        shareId,
        shareSettings,
        sharedAt: new Date().toISOString()
      };

      this.sharedLayouts.set(shareId, sharedLayout);
      localStorage.setItem(`${this.storagePrefix}-shared-${shareId}`, JSON.stringify(sharedLayout));
      
      return shareId;
    } catch (error) {
      console.error('Error sharing layout:', error);
      throw this.createLayoutError(
        'SHARE_FAILED',
        `Failed to share layout ${layoutId}`,
        'persistence',
        error
      );
    }
  }

  async getSharedLayout(shareId: string): Promise<ChartLayout> {
    try {
      // Check memory cache first
      if (this.sharedLayouts.has(shareId)) {
        return this.sharedLayouts.get(shareId)!;
      }

      // Check localStorage
      const stored = localStorage.getItem(`${this.storagePrefix}-shared-${shareId}`);
      if (stored) {
        const layout = JSON.parse(stored);
        
        // Check if share has expired
        if (layout.shareSettings?.expiresAt) {
          const expiryDate = new Date(layout.shareSettings.expiresAt);
          if (expiryDate < new Date()) {
            throw new Error('Shared layout has expired');
          }
        }
        
        this.sharedLayouts.set(shareId, layout);
        return layout;
      }

      throw new Error('Shared layout not found');
    } catch (error) {
      console.error('Error getting shared layout:', error);
      throw this.createLayoutError(
        'SHARED_LAYOUT_NOT_FOUND',
        `Shared layout ${shareId} not found or expired`,
        'persistence',
        error
      );
    }
  }

  // Layout validation
  validateLayout(layout: ChartLayout): LayoutValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    try {
      // Basic structure validation
      if (!layout.grid || !layout.panels) {
        errors.push('Layout must have grid and panels properties');
        return { isValid: false, errors, warnings, suggestions };
      }

      if (!layout.name || layout.name.trim() === '') {
        errors.push('Layout must have a name');
      }

      if (layout.grid.columns <= 0 || layout.grid.rows <= 0) {
        errors.push('Grid must have positive columns and rows');
      }

      if (layout.grid.columns > 24 || layout.grid.rows > 24) {
        warnings.push('Large grid sizes may impact performance');
      }

      // Panel validation
      const panelIds = new Set<string>();
      const occupiedCells = new Set<string>();

      for (const panel of layout.panels) {
        // Check for duplicate panel IDs
        if (panelIds.has(panel.id)) {
          errors.push(`Duplicate panel ID: ${panel.id}`);
        }
        panelIds.add(panel.id);

        // Validate panel position
        const { x, y, width, height } = panel.position;
        
        if (x < 0 || y < 0 || width <= 0 || height <= 0) {
          errors.push(`Panel ${panel.id} has invalid position or dimensions`);
          continue;
        }

        if (x + width > layout.grid.columns || y + height > layout.grid.rows) {
          errors.push(`Panel ${panel.id} extends beyond grid boundaries`);
          continue;
        }

        // Check for overlapping panels
        for (let row = y; row < y + height; row++) {
          for (let col = x; col < x + width; col++) {
            const cellKey = `${col},${row}`;
            if (occupiedCells.has(cellKey)) {
              errors.push(`Panel ${panel.id} overlaps with another panel at cell (${col}, ${row})`);
            }
            occupiedCells.add(cellKey);
          }
        }

        // Validate panel configuration
        const panelConfig = this.getPanelConfiguration(panel.type);
        if (panelConfig) {
          if (width < panelConfig.minDimensions.width || height < panelConfig.minDimensions.height) {
            warnings.push(`Panel ${panel.id} is smaller than recommended minimum size`);
          }
        }

        // Validate symbol
        if (!panel.symbol || panel.symbol.trim() === '') {
          errors.push(`Panel ${panel.id} must have a symbol`);
        }
      }

      // Performance warnings
      if (layout.panels.length > 10) {
        warnings.push('Layouts with many panels may impact performance');
      }

      if (layout.panels.length === 0) {
        warnings.push('Layout has no panels');
        suggestions.push('Add at least one chart panel to make the layout useful');
      }

      // Grid utilization suggestions
      const totalCells = layout.grid.columns * layout.grid.rows;
      const usedCells = occupiedCells.size;
      const utilization = usedCells / totalCells;

      if (utilization < 0.3) {
        suggestions.push('Consider reducing grid size for better space utilization');
      } else if (utilization > 0.9) {
        suggestions.push('Consider increasing grid size for more flexibility');
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        suggestions
      };
    } catch (error) {
      console.error('Error validating layout:', error);
      return {
        isValid: false,
        errors: ['Layout validation failed due to an unexpected error'],
        warnings,
        suggestions
      };
    }
  }

  // Layout presets
  getDefaultPresets(): LayoutPreset[] {
    return [
      {
        id: 'single',
        name: 'Single Chart',
        description: 'One main chart panel for focused analysis',
        icon: '📊',
        category: 'basic',
        layout: {
          name: 'Single Chart',
          grid: { columns: 12, rows: 8 },
          panels: [{
            id: 'main',
            type: 'price',
            symbol: 'BTC',
            position: { x: 0, y: 0, width: 12, height: 8 },
            timeframe: '1h',
            chartType: 'candlestick',
            indicators: [],
            showGrid: true,
            showLegend: true,
            showToolbar: true
          }],
          category: 'preset',
          syncSettings: {
            syncTimeRange: false,
            syncZoom: false,
            syncCrosshair: false,
            syncSymbol: false,
            syncTimeframe: false
          }
        },
        tags: ['basic', 'simple', 'beginner'],
        popularity: 100
      },
      {
        id: 'dual',
        name: 'Dual Charts',
        description: 'Two side-by-side charts for comparison',
        icon: '📈',
        category: 'basic',
        layout: {
          name: 'Dual Charts',
          grid: { columns: 12, rows: 8 },
          panels: [
            {
              id: 'chart1',
              type: 'price',
              symbol: 'BTC',
              position: { x: 0, y: 0, width: 6, height: 8 },
              timeframe: '1h',
              chartType: 'candlestick',
              indicators: []
            },
            {
              id: 'chart2',
              type: 'price',
              symbol: 'ETH',
              position: { x: 6, y: 0, width: 6, height: 8 },
              timeframe: '1h',
              chartType: 'candlestick',
              indicators: []
            }
          ],
          category: 'preset',
          syncSettings: {
            syncTimeRange: true,
            syncZoom: true,
            syncCrosshair: true,
            syncSymbol: false,
            syncTimeframe: true
          }
        },
        tags: ['comparison', 'multiple', 'intermediate'],
        popularity: 85
      },
      {
        id: 'trading',
        name: 'Trading Layout',
        description: 'Complete trading setup with price, volume, orderbook, and trades',
        icon: '💹',
        category: 'trading',
        layout: {
          name: 'Trading Layout',
          grid: { columns: 12, rows: 12 },
          panels: [
            {
              id: 'main-chart',
              type: 'price',
              symbol: 'BTC',
              position: { x: 0, y: 0, width: 8, height: 8 },
              timeframe: '15m',
              chartType: 'candlestick',
              indicators: ['sma20', 'ema50', 'volume']
            },
            {
              id: 'volume',
              type: 'volume',
              symbol: 'BTC',
              position: { x: 0, y: 8, width: 8, height: 4 },
              timeframe: '15m'
            },
            {
              id: 'orderbook',
              type: 'orderbook',
              symbol: 'BTC',
              position: { x: 8, y: 0, width: 4, height: 6 }
            },
            {
              id: 'trades',
              type: 'trades',
              symbol: 'BTC',
              position: { x: 8, y: 6, width: 4, height: 6 }
            }
          ],
          category: 'preset',
          syncSettings: {
            syncTimeRange: true,
            syncZoom: false,
            syncCrosshair: true,
            syncSymbol: true,
            syncTimeframe: true
          }
        },
        tags: ['trading', 'professional', 'advanced'],
        popularity: 90
      },
      {
        id: 'analysis',
        name: 'Technical Analysis',
        description: 'Comprehensive technical analysis with multiple indicators',
        icon: '🔍',
        category: 'analysis',
        layout: {
          name: 'Technical Analysis',
          grid: { columns: 12, rows: 16 },
          panels: [
            {
              id: 'price-chart',
              type: 'price',
              symbol: 'BTC',
              position: { x: 0, y: 0, width: 12, height: 8 },
              timeframe: '1h',
              chartType: 'candlestick',
              indicators: ['sma20', 'sma50', 'bollinger', 'ema200']
            },
            {
              id: 'rsi',
              type: 'indicator',
              symbol: 'BTC',
              indicator: 'rsi',
              position: { x: 0, y: 8, width: 6, height: 4 },
              timeframe: '1h'
            },
            {
              id: 'macd',
              type: 'indicator',
              symbol: 'BTC',
              indicator: 'macd',
              position: { x: 6, y: 8, width: 6, height: 4 },
              timeframe: '1h'
            },
            {
              id: 'volume-analysis',
              type: 'volume',
              symbol: 'BTC',
              position: { x: 0, y: 12, width: 12, height: 4 },
              timeframe: '1h',
              volumeIndicators: ['vwap', 'obv']
            }
          ],
          category: 'preset',
          syncSettings: {
            syncTimeRange: true,
            syncZoom: true,
            syncCrosshair: true,
            syncSymbol: true,
            syncTimeframe: true
          }
        },
        tags: ['analysis', 'indicators', 'advanced'],
        popularity: 75
      },
      {
        id: 'sentiment',
        name: 'Market Sentiment',
        description: 'Price action combined with sentiment analysis',
        icon: '📊',
        category: 'analysis',
        layout: {
          name: 'Market Sentiment',
          grid: { columns: 12, rows: 12 },
          panels: [
            {
              id: 'price-main',
              type: 'price',
              symbol: 'BTC',
              position: { x: 0, y: 0, width: 8, height: 8 },
              timeframe: '1h',
              chartType: 'candlestick',
              indicators: ['sma20', 'sma50']
            },
            {
              id: 'sentiment',
              type: 'sentiment',
              symbol: 'BTC',
              position: { x: 8, y: 0, width: 4, height: 8 }
            },
            {
              id: 'volume-sentiment',
              type: 'volume',
              symbol: 'BTC',
              position: { x: 0, y: 8, width: 12, height: 4 },
              timeframe: '1h'
            }
          ],
          category: 'preset',
          syncSettings: {
            syncTimeRange: true,
            syncZoom: false,
            syncCrosshair: true,
            syncSymbol: true,
            syncTimeframe: true
          }
        },
        tags: ['sentiment', 'psychology', 'intermediate'],
        popularity: 60
      }
    ];
  }

  // Panel configuration
  getPanelConfiguration(type: ChartPanel['type']): PanelConfiguration | null {
    const configurations: { [key in ChartPanel['type']]: PanelConfiguration } = {
      price: {
        type: 'price',
        defaultSettings: {
          chartType: 'candlestick',
          timeframe: '1h',
          indicators: [],
          showGrid: true,
          showLegend: true,
          showToolbar: true
        },
        requiredProps: ['symbol'],
        optionalProps: ['timeframe', 'chartType', 'indicators'],
        supportedIndicators: ['sma20', 'sma50', 'ema20', 'ema50', 'bollinger', 'rsi', 'macd'],
        supportedTimeframes: ['1m', '5m', '15m', '1h', '4h', '1d', '1w'],
        supportedChartTypes: ['candlestick', 'line', 'area', 'heikin-ashi'],
        minDimensions: { width: 4, height: 3 }
      },
      volume: {
        type: 'volume',
        defaultSettings: {
          timeframe: '1h',
          volumeIndicators: [],
          showGrid: true,
          showLegend: true
        },
        requiredProps: ['symbol'],
        optionalProps: ['timeframe', 'volumeIndicators'],
        supportedIndicators: ['vwap', 'obv', 'pvt', 'cmf'],
        supportedTimeframes: ['1m', '5m', '15m', '1h', '4h', '1d'],
        minDimensions: { width: 3, height: 2 }
      },
      indicator: {
        type: 'indicator',
        defaultSettings: {
          timeframe: '1h',
          showGrid: true,
          showLegend: true
        },
        requiredProps: ['symbol', 'indicator'],
        optionalProps: ['timeframe', 'indicatorSettings'],
        supportedIndicators: ['rsi', 'macd', 'stoch', 'cci', 'williams'],
        supportedTimeframes: ['1m', '5m', '15m', '1h', '4h', '1d'],
        minDimensions: { width: 3, height: 2 }
      },
      orderbook: {
        type: 'orderbook',
        defaultSettings: {
          showGrid: false,
          showLegend: false
        },
        requiredProps: ['symbol'],
        optionalProps: [],
        minDimensions: { width: 3, height: 4 }
      },
      trades: {
        type: 'trades',
        defaultSettings: {
          showGrid: false,
          showLegend: false
        },
        requiredProps: ['symbol'],
        optionalProps: [],
        minDimensions: { width: 3, height: 3 }
      },
      heatmap: {
        type: 'heatmap',
        defaultSettings: {
          showGrid: false,
          showLegend: true
        },
        requiredProps: [],
        optionalProps: ['symbols'],
        minDimensions: { width: 4, height: 3 }
      },
      sentiment: {
        type: 'sentiment',
        defaultSettings: {
          showGrid: true,
          showLegend: true
        },
        requiredProps: ['symbol'],
        optionalProps: [],
        minDimensions: { width: 3, height: 3 }
      }
    };

    return configurations[type] || null;
  }

  // Analytics
  private updateAnalytics(layoutId: string, data: Partial<LayoutAnalytics['usageStats']>): void {
    try {
      const existing = this.analytics.get(layoutId) || this.createDefaultAnalytics(layoutId);
      const updated: LayoutAnalytics = {
        ...existing,
        usageStats: {
          ...existing.usageStats,
          ...data
        }
      };
      
      this.analytics.set(layoutId, updated);
      localStorage.setItem(
        `${this.storagePrefix}-analytics-${layoutId}`,
        JSON.stringify(updated)
      );
    } catch (error) {
      console.warn('Failed to update analytics:', error);
    }
  }

  private createDefaultAnalytics(layoutId: string): LayoutAnalytics {
    const layout = this.layouts.get(layoutId);
    return {
      layoutId,
      panelCount: layout?.panels.length || 0,
      gridSize: {
        columns: layout?.grid.columns || 12,
        rows: layout?.grid.rows || 8
      },
      panelTypes: layout?.panels.reduce((acc, panel) => {
        acc[panel.type] = (acc[panel.type] || 0) + 1;
        return acc;
      }, {} as { [type: string]: number }) || {},
      usageStats: {
        views: 0,
        timeSpent: 0,
        interactions: 0,
        lastAccessed: new Date().toISOString()
      },
      performance: {
        loadTime: 0,
        renderTime: 0,
        memoryUsage: 0,
        errors: 0
      }
    };
  }

  // Storage operations
  private saveToStorage(layoutId: string, layout: ChartLayout): void {
    try {
      localStorage.setItem(
        `${this.storagePrefix}-${layoutId}`,
        JSON.stringify(layout)
      );
    } catch (error) {
      console.error('Failed to save to localStorage:', error);
      throw error;
    }
  }

  private loadFromStorage(layoutId: string): ChartLayout | null {
    try {
      const stored = localStorage.getItem(`${this.storagePrefix}-${layoutId}`);
      return stored ? JSON.parse(stored) : null;
    } catch (error) {
      console.error('Failed to load from localStorage:', error);
      return null;
    }
  }

  private loadFromStorage(): void {
    try {
      // Load layouts
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(`${this.storagePrefix}-`) && !key.includes('analytics') && !key.includes('shared')) {
          try {
            const layout = JSON.parse(localStorage.getItem(key) || '');
            const layoutId = key.replace(`${this.storagePrefix}-`, '');
            this.layouts.set(layoutId, layout);
          } catch (error) {
            console.warn(`Failed to load layout from ${key}:`, error);
          }
        }
      }

      // Load analytics
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.includes(`${this.storagePrefix}-analytics-`)) {
          try {
            const analytics = JSON.parse(localStorage.getItem(key) || '');
            const layoutId = key.replace(`${this.storagePrefix}-analytics-`, '');
            this.analytics.set(layoutId, analytics);
          } catch (error) {
            console.warn(`Failed to load analytics from ${key}:`, error);
          }
        }
      }
    } catch (error) {
      console.error('Failed to load from storage:', error);
    }
  }

  // Utility methods
  private generateLayoutId(): string {
    return `layout_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateShareId(): string {
    return `share_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private createLayoutError(
    code: string,
    message: string,
    source: LayoutError['source'],
    originalError?: any
  ): LayoutError {
    return {
      code,
      message,
      source,
      severity: 'error',
      timestamp: new Date().toISOString(),
      retryable: source === 'persistence'
    };
  }

  // Cleanup old data
  async cleanup(): Promise<void> {
    try {
      const cutoffDate = new Date(Date.now() - this.cacheExpiry);
      
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key && key.startsWith(this.storagePrefix)) {
          try {
            const data = JSON.parse(localStorage.getItem(key) || '');
            const updatedAt = new Date(data.updatedAt || data.createdAt || 0);
            
            if (updatedAt < cutoffDate && !data.isPinned) {
              localStorage.removeItem(key);
            }
          } catch (error) {
            // Remove corrupted entries
            localStorage.removeItem(key);
          }
        }
      }
    } catch (error) {
      console.error('Failed to cleanup storage:', error);
    }
  }
}

export const chartLayoutService = new ChartLayoutService();