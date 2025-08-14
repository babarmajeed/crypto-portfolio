# CP-034: Component Specifications & Implementation Guide

## 1. Core Component Specifications

### 1.1 AdvancedAnalyticsDashboard

**Purpose**: Main container component for advanced portfolio analytics with customizable widgets and layouts.

**Props Interface**:
```typescript
interface AdvancedAnalyticsDashboardProps {
  portfolioId: string;
  timeframe: TimeframeOption;
  initialLayout?: DashboardLayout;
  customWidgets?: CustomWidget[];
  onLayoutChange?: (layout: DashboardLayout) => void;
  onWidgetUpdate?: (widgetId: string, data: any) => void;
  permissions: AnalyticsPermissions;
}

interface DashboardLayout {
  id: string;
  name: string;
  widgets: WidgetConfig[];
  gridConfig: GridLayoutConfig;
  filters: GlobalFilterConfig;
  preferences: DashboardPreferences;
}

interface WidgetConfig {
  id: string;
  type: WidgetType;
  position: { x: number; y: number; w: number; h: number };
  config: WidgetSpecificConfig;
  dataSource: DataSourceConfig;
}
```

**Key Features**:
- Drag-and-drop widget arrangement
- Real-time data updates via WebSocket
- Customizable time filters and date ranges
- Export capabilities (PDF, CSV, PNG)
- Responsive layout adaptation
- Accessibility compliance (ARIA labels, keyboard navigation)

**State Management**:
```typescript
const useAnalyticsDashboard = (portfolioId: string) => {
  const [layout, setLayout] = useState<DashboardLayout>();
  const [filters, setFilters] = useState<FilterState>();
  const [isLoading, setIsLoading] = useState(true);
  
  const analyticsData = useQuery(['analytics', portfolioId, filters], 
    () => analyticsService.getData(portfolioId, filters)
  );
  
  return {
    layout,
    setLayout,
    filters,
    setFilters,
    data: analyticsData.data,
    isLoading: analyticsData.isLoading,
  };
};
```

### 1.2 PerformanceMetricsPanel

**Purpose**: Comprehensive performance analysis with multiple metrics and benchmark comparisons.

**Props Interface**:
```typescript
interface PerformanceMetricsPanelProps {
  portfolioId: string;
  timeframe: TimeframeOption;
  benchmarks: BenchmarkConfig[];
  showAdvancedMetrics?: boolean;
  comparisonMode: 'absolute' | 'relative' | 'risk-adjusted';
  customMetrics?: CustomMetricConfig[];
}

interface PerformanceData {
  returns: {
    total: number;
    annualized: number;
    periods: Record<TimePeriod, PeriodReturn>;
  };
  risk: {
    volatility: number;
    sharpeRatio: number;
    sortinoRatio: number;
    maxDrawdown: number;
    var95: number;
    var99: number;
  };
  attribution: {
    assetAllocation: AttributionData[];
    securitySelection: AttributionData[];
    interaction: number;
  };
  benchmark: BenchmarkComparison[];
}
```

**Sub-components**:
- `RiskMetricsCard`: VaR, Expected Shortfall, Beta, Alpha
- `ReturnAnalysisCard`: Time-weighted returns, IRR, CAGR
- `BenchmarkComparisonChart`: Interactive comparison visualization
- `AttributionAnalysis`: Performance attribution breakdown
- `DrawdownChart`: Historical drawdown visualization

### 1.3 InteractiveChartSuite

**Purpose**: Advanced charting system with technical analysis capabilities.

**Props Interface**:
```typescript
interface InteractiveChartSuiteProps {
  data: ChartData;
  config: ChartConfig;
  indicators: TechnicalIndicator[];
  overlays: ChartOverlay[];
  tools: DrawingTool[];
  onInteraction?: (event: ChartInteractionEvent) => void;
}

interface ChartConfig {
  type: 'candlestick' | 'line' | 'area' | 'volume' | 'heatmap';
  timeframe: TimeframeOption;
  theme: ChartTheme;
  responsive: ResponsiveConfig;
  accessibility: AccessibilityConfig;
}

interface TechnicalIndicator {
  id: string;
  name: string;
  type: 'overlay' | 'oscillator' | 'volume';
  parameters: IndicatorParameters;
  visible: boolean;
  style: IndicatorStyle;
}
```

**Chart Types**:
1. **CandlestickChart**: OHLC data with volume
2. **PerformanceTrendChart**: Portfolio performance over time
3. **CorrelationMatrix**: Asset correlation heatmap
4. **RiskReturnScatter**: Risk vs. return analysis
5. **AllocationTreemap**: Portfolio allocation visualization

## 2. Service Layer Specifications

### 2.1 AnalyticsService

**Core Responsibilities**:
- Data aggregation and processing
- Metric calculations
- Real-time updates management
- Caching strategy implementation

```typescript
export class AnalyticsService {
  private cache: AnalyticsCache;
  private websocket: WebSocketManager;
  private calculator: MetricsCalculator;

  async getPortfolioAnalytics(
    portfolioId: string, 
    config: AnalyticsConfig
  ): Promise<AnalyticsData> {
    // Check cache first
    const cacheKey = this.generateCacheKey(portfolioId, config);
    const cached = await this.cache.get(cacheKey);
    
    if (cached && !this.isStale(cached)) {
      return cached;
    }

    // Fetch fresh data
    const rawData = await this.fetchRawData(portfolioId, config);
    const processedData = await this.processData(rawData, config);
    const analytics = await this.calculator.calculateMetrics(processedData);

    // Cache results
    await this.cache.set(cacheKey, analytics, config.cacheTtl);
    
    return analytics;
  }

  async getPerformanceMetrics(
    portfolioId: string,
    timeframe: Timeframe
  ): Promise<PerformanceMetrics> {
    const transactions = await this.fetchTransactions(portfolioId);
    const prices = await this.fetchPriceHistory(portfolioId, timeframe);
    
    return this.calculator.calculatePerformance(transactions, prices, timeframe);
  }

  subscribeToRealTimeUpdates(
    portfolioId: string,
    callback: UpdateCallback
  ): Subscription {
    return this.websocket.subscribe(`portfolio:${portfolioId}`, (update) => {
      const processedUpdate = this.processRealTimeUpdate(update);
      callback(processedUpdate);
    });
  }
}
```

### 2.2 ChartService

**Responsibilities**:
- Chart rendering and management
- Technical indicator calculations
- User interaction handling
- Export functionality

```typescript
export class ChartService {
  private chartInstances: Map<string, Chart> = new Map();
  private indicatorCalculator: IndicatorCalculator;

  createChart(
    containerId: string, 
    config: ChartConfig, 
    data: ChartData
  ): Chart {
    const chart = new InteractiveChart(containerId, config);
    chart.setData(data);
    
    // Add default indicators
    if (config.defaultIndicators) {
      config.defaultIndicators.forEach(indicator => {
        this.addIndicator(chart.id, indicator);
      });
    }

    this.chartInstances.set(chart.id, chart);
    return chart;
  }

  addIndicator(chartId: string, indicator: TechnicalIndicator): void {
    const chart = this.chartInstances.get(chartId);
    if (!chart) throw new Error('Chart not found');

    const calculatedData = this.indicatorCalculator.calculate(
      indicator.type, 
      chart.getData(), 
      indicator.parameters
    );

    chart.addIndicator(indicator.id, calculatedData, indicator.style);
  }

  exportChart(
    chartId: string, 
    format: ExportFormat, 
    options: ExportOptions
  ): Promise<Blob> {
    const chart = this.chartInstances.get(chartId);
    if (!chart) throw new Error('Chart not found');

    return chart.export(format, options);
  }
}
```

## 3. Data Flow Specifications

### 3.1 Real-time Data Pipeline

```typescript
export class RealTimeDataPipeline {
  private websocket: WebSocketConnection;
  private updateQueue: PriorityQueue<MarketUpdate>;
  private processors: Map<string, DataProcessor>;
  private subscribers: Map<string, Set<UpdateCallback>>;

  constructor() {
    this.setupWebSocketConnection();
    this.startProcessingLoop();
  }

  private setupWebSocketConnection(): void {
    this.websocket = new WebSocketConnection(WS_ENDPOINT);
    
    this.websocket.onMessage((message) => {
      const update = this.parseUpdate(message);
      this.updateQueue.enqueue(update, this.calculatePriority(update));
    });
  }

  private startProcessingLoop(): void {
    setInterval(() => {
      this.processBatch();
    }, UPDATE_INTERVAL);
  }

  private processBatch(): void {
    const batch = this.updateQueue.dequeueBatch(MAX_BATCH_SIZE);
    
    batch.forEach(update => {
      const processor = this.processors.get(update.type);
      if (processor) {
        const processedUpdate = processor.process(update);
        this.notifySubscribers(update.portfolioId, processedUpdate);
      }
    });
  }

  subscribe(portfolioId: string, callback: UpdateCallback): Subscription {
    if (!this.subscribers.has(portfolioId)) {
      this.subscribers.set(portfolioId, new Set());
    }
    
    this.subscribers.get(portfolioId)!.add(callback);
    
    return {
      unsubscribe: () => {
        this.subscribers.get(portfolioId)?.delete(callback);
      }
    };
  }
}
```

### 3.2 Caching Strategy

```typescript
export class AnalyticsCache {
  private memoryCache: Map<string, CacheEntry> = new Map();
  private persistentCache: IndexedDB;
  private distributedCache: RedisClient;

  constructor() {
    this.persistentCache = new IndexedDB('analytics-cache');
    this.distributedCache = new RedisClient(REDIS_CONFIG);
    this.startCleanupTask();
  }

  async get<T>(key: string): Promise<T | null> {
    // Level 1: Memory cache
    const memoryEntry = this.memoryCache.get(key);
    if (memoryEntry && !this.isExpired(memoryEntry)) {
      return memoryEntry.data as T;
    }

    // Level 2: IndexedDB
    const persistentEntry = await this.persistentCache.get(key);
    if (persistentEntry && !this.isExpired(persistentEntry)) {
      // Promote to memory cache
      this.memoryCache.set(key, persistentEntry);
      return persistentEntry.data as T;
    }

    // Level 3: Distributed cache
    const distributedEntry = await this.distributedCache.get(key);
    if (distributedEntry && !this.isExpired(distributedEntry)) {
      // Promote to local caches
      this.memoryCache.set(key, distributedEntry);
      await this.persistentCache.set(key, distributedEntry);
      return distributedEntry.data as T;
    }

    return null;
  }

  async set<T>(key: string, data: T, ttl: number): Promise<void> {
    const entry: CacheEntry = {
      data,
      timestamp: Date.now(),
      ttl,
      size: this.calculateSize(data)
    };

    // Store in all cache levels
    this.memoryCache.set(key, entry);
    await this.persistentCache.set(key, entry);
    await this.distributedCache.set(key, entry, ttl);
  }

  async invalidatePattern(pattern: string): Promise<void> {
    const regex = new RegExp(pattern);
    
    // Invalidate memory cache
    for (const [key] of this.memoryCache) {
      if (regex.test(key)) {
        this.memoryCache.delete(key);
      }
    }

    // Invalidate persistent cache
    await this.persistentCache.invalidatePattern(pattern);
    
    // Invalidate distributed cache
    await this.distributedCache.invalidatePattern(pattern);
  }
}
```

## 4. State Management Specifications

### 4.1 Analytics Context

```typescript
interface AnalyticsContextType {
  // Data state
  portfolioAnalytics: AnalyticsData | null;
  performanceMetrics: PerformanceMetrics | null;
  chartData: ChartDataMap;
  
  // UI state
  selectedTimeframe: TimeframeOption;
  activeFilters: FilterConfig;
  dashboardLayout: DashboardLayout;
  
  // Loading states
  isLoading: boolean;
  isUpdating: boolean;
  lastUpdated: Date | null;
  
  // Actions
  updateTimeframe: (timeframe: TimeframeOption) => void;
  applyFilters: (filters: FilterConfig) => void;
  updateLayout: (layout: DashboardLayout) => void;
  refreshData: () => Promise<void>;
  exportData: (format: ExportFormat) => Promise<void>;
}

export const AnalyticsProvider: React.FC<{ children: React.ReactNode }> = ({
  children
}) => {
  const [state, dispatch] = useReducer(analyticsReducer, initialState);
  
  const contextValue = useMemo(() => ({
    ...state,
    updateTimeframe: (timeframe: TimeframeOption) => 
      dispatch({ type: 'UPDATE_TIMEFRAME', payload: timeframe }),
    applyFilters: (filters: FilterConfig) =>
      dispatch({ type: 'APPLY_FILTERS', payload: filters }),
    // ... other actions
  }), [state]);

  return (
    <AnalyticsContext.Provider value={contextValue}>
      {children}
    </AnalyticsContext.Provider>
  );
};
```

### 4.2 React Query Integration

```typescript
// Custom hooks for analytics data
export const usePortfolioAnalytics = (portfolioId: string, config?: AnalyticsConfig) => {
  const { selectedTimeframe, activeFilters } = useAnalyticsContext();
  
  return useQuery({
    queryKey: ['portfolio-analytics', portfolioId, selectedTimeframe, activeFilters, config],
    queryFn: () => analyticsService.getPortfolioAnalytics(portfolioId, {
      timeframe: selectedTimeframe,
      filters: activeFilters,
      ...config
    }),
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 15 * 60 * 1000, // 15 minutes
    refetchInterval: 30 * 1000, // 30 seconds for real-time updates
    refetchIntervalInBackground: true,
    enabled: !!portfolioId,
  });
};

export const usePerformanceMetrics = (portfolioId: string) => {
  const { selectedTimeframe } = useAnalyticsContext();
  
  return useQuery({
    queryKey: ['performance-metrics', portfolioId, selectedTimeframe],
    queryFn: () => analyticsService.getPerformanceMetrics(portfolioId, selectedTimeframe),
    staleTime: 2 * 60 * 1000, // 2 minutes
    enabled: !!portfolioId,
    select: (data) => {
      // Transform data for UI consumption
      return {
        ...data,
        formattedReturns: formatReturnsData(data.returns),
        riskMetrics: calculateAdditionalRiskMetrics(data.risk),
      };
    },
  });
};

// Real-time subscriptions
export const useRealTimeUpdates = (portfolioId: string) => {
  const queryClient = useQueryClient();
  
  useEffect(() => {
    if (!portfolioId) return;
    
    const subscription = analyticsService.subscribeToRealTimeUpdates(
      portfolioId,
      (update) => {
        // Update relevant queries
        queryClient.setQueryData(
          ['portfolio-analytics', portfolioId],
          (oldData: AnalyticsData | undefined) => {
            if (!oldData) return oldData;
            return applyRealTimeUpdate(oldData, update);
          }
        );
      }
    );
    
    return () => subscription.unsubscribe();
  }, [portfolioId, queryClient]);
};
```

## 5. Testing Specifications

### 5.1 Component Testing Strategy

```typescript
// Test utilities
export const createMockAnalyticsData = (): AnalyticsData => ({
  portfolio: {
    totalValue: 100000,
    totalReturn: 15000,
    totalReturnPercentage: 15,
    annualizedReturn: 12.5,
    volatility: 0.18,
    sharpeRatio: 1.25,
    maxDrawdown: -0.12,
  },
  // ... rest of mock data
});

export const renderWithAnalyticsProvider = (
  component: React.ReactElement,
  initialState?: Partial<AnalyticsState>
) => {
  const mockState = { ...defaultAnalyticsState, ...initialState };
  
  return render(
    <AnalyticsProvider initialState={mockState}>
      <QueryClient>
        {component}
      </QueryClient>
    </AnalyticsProvider>
  );
};

// Component tests
describe('AdvancedAnalyticsDashboard', () => {
  it('should render all dashboard widgets', () => {
    const mockData = createMockAnalyticsData();
    
    renderWithAnalyticsProvider(
      <AdvancedAnalyticsDashboard portfolioId="test-portfolio" />,
      { portfolioAnalytics: mockData }
    );
    
    expect(screen.getByTestId('analytics-grid')).toBeInTheDocument();
    expect(screen.getByTestId('performance-widget')).toBeInTheDocument();
    expect(screen.getByTestId('risk-widget')).toBeInTheDocument();
  });
  
  it('should handle real-time updates', async () => {
    const mockWebSocket = new MockWebSocket();
    jest.spyOn(analyticsService, 'subscribeToRealTimeUpdates')
      .mockReturnValue(mockWebSocket.createSubscription());
    
    renderWithAnalyticsProvider(
      <AdvancedAnalyticsDashboard portfolioId="test-portfolio" />
    );
    
    // Simulate real-time update
    act(() => {
      mockWebSocket.emit('portfolio-update', {
        portfolioId: 'test-portfolio',
        totalValue: 105000,
        change: 5000
      });
    });
    
    await waitFor(() => {
      expect(screen.getByText('$105,000')).toBeInTheDocument();
    });
  });
});
```

### 5.2 Integration Testing

```typescript
describe('Analytics Integration', () => {
  it('should fetch and display portfolio analytics', async () => {
    const mockApiResponse = createMockAnalyticsData();
    mockApiService.get.mockResolvedValue(mockApiResponse);
    
    render(<AdvancedAnalyticsDashboard portfolioId="test-portfolio" />);
    
    await waitFor(() => {
      expect(screen.getByText('15.0%')).toBeInTheDocument(); // Return percentage
      expect(screen.getByText('1.25')).toBeInTheDocument();  // Sharpe ratio
    });
    
    expect(mockApiService.get).toHaveBeenCalledWith(
      '/api/portfolios/test-portfolio/analytics'
    );
  });
});
```

This component specification provides detailed implementation guidance for each major component in the CP-034 architecture, ensuring consistent development practices and maintainable code structure.