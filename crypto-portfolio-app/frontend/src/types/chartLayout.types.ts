export interface ChartPanelPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ChartPanel {
  id: string;
  type: 'price' | 'volume' | 'indicator' | 'orderbook' | 'trades' | 'heatmap' | 'sentiment';
  symbol: string;
  position: ChartPanelPosition;
  
  // Chart-specific configuration
  timeframe?: string;
  chartType?: 'candlestick' | 'line' | 'area' | 'heikin-ashi' | 'renko';
  indicators?: string[];
  volumeIndicators?: string[];
  
  // Indicator-specific (when type === 'indicator')
  indicator?: string;
  indicatorSettings?: Record<string, any>;
  
  // Display options
  showGrid?: boolean;
  showLegend?: boolean;
  showToolbar?: boolean;
  backgroundColor?: string;
  textColor?: string;
  
  // Panel state
  isMaximized?: boolean;
  isMinimized?: boolean;
  isLoading?: boolean;
  error?: string;
  
  // Metadata
  title?: string;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface LayoutGrid {
  columns: number;
  rows: number;
  gap?: number;
  minPanelWidth?: number;
  minPanelHeight?: number;
}

export interface ChartLayout {
  id?: string;
  name: string;
  description?: string;
  grid: LayoutGrid;
  panels: ChartPanel[];
  
  // Layout metadata
  tags?: string[];
  category?: 'trading' | 'analysis' | 'custom' | 'preset';
  isPublic?: boolean;
  isTemplate?: boolean;
  
  // Timestamps
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
  
  // Sharing
  shareId?: string;
  shareSettings?: LayoutShareSettings;
  sharedAt?: string;
  
  // Synchronization settings
  syncSettings?: PanelSyncSettings;
}

export interface LayoutShareSettings {
  isPublic: boolean;
  allowCopy: boolean;
  allowModify: boolean;
  expiresAt?: string;
  password?: string;
  allowedUsers?: string[];
}

export interface PanelSyncSettings {
  syncTimeRange: boolean;
  syncZoom: boolean;
  syncCrosshair: boolean;
  syncSymbol: boolean;
  syncTimeframe: boolean;
  
  // Advanced sync options
  masterPanelId?: string;
  syncGroups?: { [panelId: string]: string };
}

export interface LayoutPreset {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: 'basic' | 'trading' | 'analysis' | 'advanced';
  layout: Omit<ChartLayout, 'id' | 'createdAt' | 'updatedAt'>;
  preview?: string; // Base64 encoded preview image
  popularity?: number;
  tags?: string[];
}

export interface PanelDragData {
  panelId: string;
  panelType: string;
  startPosition: ChartPanelPosition;
  currentPosition: ChartPanelPosition;
  isDragging: boolean;
}

export interface GridCell {
  x: number;
  y: number;
  isOccupied: boolean;
  panelId?: string;
  isHighlighted?: boolean;
  isDropTarget?: boolean;
}

export interface LayoutValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  suggestions?: string[];
}

export interface PanelResizeHandle {
  position: 'top' | 'bottom' | 'left' | 'right' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  cursor: string;
  isActive: boolean;
}

export interface SyncedChartState {
  timeRange?: {
    start: number;
    end: number;
  };
  zoom?: {
    startIndex: number;
    endIndex: number;
  };
  crosshair?: {
    x: number;
    y: number;
    time: number;
    price: number;
  };
  symbol?: string;
  timeframe?: string;
}

export interface LayoutTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  layout: ChartLayout;
  
  // Template metadata
  author: string;
  downloads: number;
  rating: number;
  reviews: number;
  screenshots: string[];
  tags: string[];
  
  // Requirements
  requiredSymbols?: string[];
  requiredIndicators?: string[];
  minimumScreenSize?: {
    width: number;
    height: number;
  };
  
  // Versioning
  version: string;
  changelog?: string;
  compatibleVersions?: string[];
  
  // Timestamps
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
}

export interface LayoutError {
  code: string;
  message: string;
  panelId?: string;
  source: 'layout' | 'panel' | 'sync' | 'persistence';
  severity: 'error' | 'warning' | 'info';
  timestamp: string;
  retryable?: boolean;
}

export interface PanelConfiguration {
  type: ChartPanel['type'];
  defaultSettings: Partial<ChartPanel>;
  requiredProps: string[];
  optionalProps: string[];
  supportedIndicators?: string[];
  supportedTimeframes?: string[];
  supportedChartTypes?: string[];
  minDimensions: {
    width: number;
    height: number;
  };
  maxDimensions?: {
    width: number;
    height: number;
  };
}

export interface LayoutAnalytics {
  layoutId: string;
  panelCount: number;
  gridSize: {
    columns: number;
    rows: number;
  };
  panelTypes: { [type: string]: number };
  usageStats: {
    views: number;
    timeSpent: number;
    interactions: number;
    lastAccessed: string;
  };
  performance: {
    loadTime: number;
    renderTime: number;
    memoryUsage: number;
    errors: number;
  };
}

export interface LayoutManagerState {
  currentLayout: ChartLayout | null;
  availableLayouts: ChartLayout[];
  presets: LayoutPreset[];
  templates: LayoutTemplate[];
  
  // State flags
  isDesignMode: boolean;
  isLoading: boolean;
  isSaving: boolean;
  
  // Selection and interaction
  selectedPanelId: string | null;
  draggedPanelId: string | null;
  hoveredPanelId: string | null;
  
  // Grid state
  gridCells: GridCell[][];
  snapToGrid: boolean;
  showGrid: boolean;
  
  // Sync state
  syncedState: SyncedChartState;
  syncSettings: PanelSyncSettings;
  
  // Errors and validation
  errors: LayoutError[];
  validationResult: LayoutValidationResult | null;
  
  // Analytics
  analytics: LayoutAnalytics | null;
}

export interface LayoutAction {
  type: string;
  payload?: any;
  panelId?: string;
  timestamp?: string;
}

// Layout action types
export enum LayoutActionType {
  // Layout management
  LOAD_LAYOUT = 'LOAD_LAYOUT',
  SAVE_LAYOUT = 'SAVE_LAYOUT',
  CREATE_LAYOUT = 'CREATE_LAYOUT',
  DELETE_LAYOUT = 'DELETE_LAYOUT',
  RESET_LAYOUT = 'RESET_LAYOUT',
  
  // Panel management
  ADD_PANEL = 'ADD_PANEL',
  REMOVE_PANEL = 'REMOVE_PANEL',
  UPDATE_PANEL = 'UPDATE_PANEL',
  MOVE_PANEL = 'MOVE_PANEL',
  RESIZE_PANEL = 'RESIZE_PANEL',
  CLONE_PANEL = 'CLONE_PANEL',
  
  // Panel states
  MAXIMIZE_PANEL = 'MAXIMIZE_PANEL',
  MINIMIZE_PANEL = 'MINIMIZE_PANEL',
  RESTORE_PANEL = 'RESTORE_PANEL',
  SELECT_PANEL = 'SELECT_PANEL',
  DESELECT_PANEL = 'DESELECT_PANEL',
  
  // Grid management
  UPDATE_GRID = 'UPDATE_GRID',
  TOGGLE_GRID = 'TOGGLE_GRID',
  TOGGLE_SNAP = 'TOGGLE_SNAP',
  
  // Design mode
  ENTER_DESIGN_MODE = 'ENTER_DESIGN_MODE',
  EXIT_DESIGN_MODE = 'EXIT_DESIGN_MODE',
  TOGGLE_DESIGN_MODE = 'TOGGLE_DESIGN_MODE',
  
  // Synchronization
  ENABLE_SYNC = 'ENABLE_SYNC',
  DISABLE_SYNC = 'DISABLE_SYNC',
  UPDATE_SYNC_SETTINGS = 'UPDATE_SYNC_SETTINGS',
  UPDATE_SYNCED_STATE = 'UPDATE_SYNCED_STATE',
  
  // Drag and drop
  START_DRAG = 'START_DRAG',
  END_DRAG = 'END_DRAG',
  UPDATE_DRAG = 'UPDATE_DRAG',
  
  // Error handling
  SET_ERROR = 'SET_ERROR',
  CLEAR_ERROR = 'CLEAR_ERROR',
  CLEAR_ALL_ERRORS = 'CLEAR_ALL_ERRORS',
  
  // Loading states
  SET_LOADING = 'SET_LOADING',
  SET_SAVING = 'SET_SAVING',
  
  // Analytics
  TRACK_INTERACTION = 'TRACK_INTERACTION',
  UPDATE_ANALYTICS = 'UPDATE_ANALYTICS'
}

// Utility types for layout operations
export type PanelUpdateData = Partial<Omit<ChartPanel, 'id'>>;
export type LayoutUpdateData = Partial<Omit<ChartLayout, 'id' | 'createdAt'>>;
export type GridPosition = Pick<ChartPanelPosition, 'x' | 'y'>;
export type GridDimensions = Pick<ChartPanelPosition, 'width' | 'height'>;

// Event types for layout system
export interface LayoutEvent {
  type: string;
  layoutId?: string;
  panelId?: string;
  data?: any;
  timestamp: string;
}

export interface PanelEvent extends LayoutEvent {
  panelId: string;
  panelType: string;
}

export interface SyncEvent extends LayoutEvent {
  syncType: 'timeRange' | 'zoom' | 'crosshair' | 'symbol' | 'timeframe';
  sourcePanel: string;
  targetPanels: string[];
  syncData: any;
}

// Configuration interfaces
export interface LayoutManagerConfig {
  defaultGrid: LayoutGrid;
  enableAutoSave: boolean;
  autoSaveInterval: number;
  maxLayoutHistory: number;
  enableAnalytics: boolean;
  enableSharing: boolean;
  maxPanelsPerLayout: number;
  allowedPanelTypes: ChartPanel['type'][];
  layoutValidation: {
    enforceMinPanelSize: boolean;
    preventOverlap: boolean;
    snapToGrid: boolean;
  };
}

export interface PanelComponentProps {
  panel: ChartPanel;
  isDesignMode: boolean;
  isSelected: boolean;
  isMaximized: boolean;
  syncedState?: SyncedChartState;
  onUpdate: (updates: PanelUpdateData) => void;
  onSelect: () => void;
  onRemove: () => void;
  onMaximize: () => void;
  onMinimize: () => void;
  onSyncStateChange: (syncData: Partial<SyncedChartState>) => void;
}

// All types are already exported above with their declarations