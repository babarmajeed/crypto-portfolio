export interface AnnotationPoint {
  time: number;
  price: number;
  x?: number; // Pixel coordinates (calculated)
  y?: number; // Pixel coordinates (calculated)
}

export interface AnnotationStyle {
  color: string;
  lineWidth: number;
  lineStyle: 'solid' | 'dashed' | 'dotted';
  fillColor?: string;
  fill?: boolean;
  opacity?: number;
  
  // Text styling
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: 'normal' | 'bold' | 'lighter' | 'bolder';
  fontStyle?: 'normal' | 'italic' | 'oblique';
  textAlign?: 'left' | 'center' | 'right';
  backgroundColor?: string;
  borderColor?: string;
  borderWidth?: number;
  borderRadius?: number;
  padding?: number;
  
  // Arrow styling
  arrowSize?: number;
  arrowStyle?: 'filled' | 'outlined';
  
  // Shadow
  shadowColor?: string;
  shadowBlur?: number;
  shadowOffsetX?: number;
  shadowOffsetY?: number;
}

export interface BaseAnnotation {
  id: string;
  type: AnnotationType;
  style: AnnotationStyle;
  createdAt: string;
  updatedAt?: string;
  createdBy?: string;
  layer?: number;
  locked?: boolean;
  visible?: boolean;
  selected?: boolean;
  
  // Metadata
  name?: string;
  description?: string;
  tags?: string[];
  
  // Alert integration
  alertId?: string;
  alertEnabled?: boolean;
}

export type AnnotationType =
  | 'line'
  | 'trend'
  | 'horizontal'
  | 'vertical'
  | 'rectangle'
  | 'ellipse'
  | 'circle'
  | 'triangle'
  | 'polygon'
  | 'arrow'
  | 'text'
  | 'note'
  | 'fibonacci'
  | 'fibonacci-fan'
  | 'fibonacci-arc'
  | 'fibonacci-extension'
  | 'gann-fan'
  | 'pitchfork'
  | 'channel'
  | 'parallel-channel'
  | 'regression'
  | 'measure'
  | 'price-range'
  | 'time-range'
  | 'crosshair'
  | 'brush'
  | 'highlighter';

export interface LineAnnotation extends BaseAnnotation {
  type: 'line' | 'trend' | 'horizontal' | 'vertical';
  points: [AnnotationPoint, AnnotationPoint];
  infinite?: boolean; // Extend line infinitely
  ray?: boolean; // Extend line as ray
}

export interface ShapeAnnotation extends BaseAnnotation {
  type: 'rectangle' | 'ellipse' | 'circle' | 'triangle' | 'polygon';
  points: AnnotationPoint[];
  closed?: boolean;
}

export interface ArrowAnnotation extends BaseAnnotation {
  type: 'arrow';
  points: [AnnotationPoint, AnnotationPoint];
  arrowHead?: 'start' | 'end' | 'both';
}

export interface TextAnnotation extends BaseAnnotation {
  type: 'text' | 'note';
  position: AnnotationPoint;
  text: string;
  maxWidth?: number;
  rotation?: number;
  anchor?: 'top-left' | 'top-center' | 'top-right' | 'center-left' | 'center' | 'center-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';
}

export interface FibonacciAnnotation extends BaseAnnotation {
  type: 'fibonacci' | 'fibonacci-fan' | 'fibonacci-arc' | 'fibonacci-extension';
  points: [AnnotationPoint, AnnotationPoint] | [AnnotationPoint, AnnotationPoint, AnnotationPoint];
  levels: number[];
  showLabels?: boolean;
  showPrices?: boolean;
  showPercentages?: boolean;
  reverse?: boolean;
}

export interface ChannelAnnotation extends BaseAnnotation {
  type: 'channel' | 'parallel-channel';
  points: AnnotationPoint[];
  channelWidth?: number;
}

export interface MeasurementAnnotation extends BaseAnnotation {
  type: 'measure' | 'price-range' | 'time-range';
  points: [AnnotationPoint, AnnotationPoint];
  showDistance?: boolean;
  showAngle?: boolean;
  showPriceChange?: boolean;
  showPercentChange?: boolean;
  showTimeElapsed?: boolean;
  showBars?: boolean;
}

export interface PatternAnnotation extends BaseAnnotation {
  type: 'gann-fan' | 'pitchfork' | 'regression';
  points: AnnotationPoint[];
  patternSettings?: {
    fanLines?: number;
    regressionDeviation?: number;
    showChannels?: boolean;
  };
}

export interface BrushAnnotation extends BaseAnnotation {
  type: 'brush' | 'highlighter';
  path: AnnotationPoint[];
  brushSize?: number;
}

export type Annotation =
  | LineAnnotation
  | ShapeAnnotation
  | ArrowAnnotation
  | TextAnnotation
  | FibonacciAnnotation
  | ChannelAnnotation
  | MeasurementAnnotation
  | PatternAnnotation
  | BrushAnnotation;

export interface AnnotationLayer {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  opacity: number;
  zIndex: number;
  annotations: string[]; // Annotation IDs
}

export interface DrawingTool {
  id: string;
  name: string;
  icon: string;
  description: string;
  category: 'basic' | 'shapes' | 'fibonacci' | 'patterns' | 'text' | 'measurement';
  cursor?: string;
  requiresPoints?: number; // Number of points required
  settings?: ToolSettings;
}

export interface ToolSettings {
  color?: string;
  lineWidth?: number;
  lineStyle?: AnnotationStyle['lineStyle'];
  fillColor?: string;
  fill?: boolean;
  fontSize?: number;
  fontFamily?: string;
  
  // Tool-specific settings
  infinite?: boolean;
  ray?: boolean;
  showLabels?: boolean;
  levels?: number[];
  
  // Snapping
  snapToPrice?: boolean;
  snapToTime?: boolean;
  snapTolerance?: number;
}

export interface DrawingState {
  isDrawing: boolean;
  activeTool: string | null;
  currentPoints: AnnotationPoint[];
  previewAnnotation: Annotation | null;
  selectedAnnotations: string[];
  hoveredAnnotation: string | null;
  
  // Grid and snapping
  showGrid?: boolean;
  snapToGrid?: boolean;
  gridSpacing?: number;
  
  // Layers
  activeLayers: string[];
  visibleLayers: string[];
}

export interface AnnotationEvent {
  type: 'create' | 'update' | 'delete' | 'select' | 'deselect' | 'move' | 'resize';
  annotation: Annotation;
  previousState?: Partial<Annotation>;
  timestamp: string;
}

export interface AnnotationFilter {
  types?: AnnotationType[];
  layers?: string[];
  createdBy?: string;
  dateRange?: {
    start: string;
    end: string;
  };
  tags?: string[];
  visible?: boolean;
  locked?: boolean;
}

export interface AnnotationExportOptions {
  format: 'json' | 'csv' | 'png' | 'svg';
  includeStyle?: boolean;
  includeMetadata?: boolean;
  compression?: boolean;
  resolution?: number; // For image exports
}

export interface AnnotationShareSettings {
  isPublic: boolean;
  allowEdit: boolean;
  allowCopy: boolean;
  allowExport: boolean;
  expiresAt?: string;
  password?: string;
  allowedUsers?: string[];
  embedCode?: string;
}

export interface AnnotationTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  annotations: Partial<Annotation>[];
  previewImage?: string;
  tags: string[];
  popularity: number;
  createdBy: string;
  createdAt: string;
}

export interface AnnotationSnapshot {
  id: string;
  chartId: string;
  annotations: Annotation[];
  layers: AnnotationLayer[];
  timestamp: string;
  description?: string;
  tags?: string[];
}

export interface AnnotationValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  suggestions?: string[];
}

export interface AnnotationManager {
  annotations: Map<string, Annotation>;
  layers: Map<string, AnnotationLayer>;
  selectedIds: Set<string>;
  clipboard: Annotation[];
  history: AnnotationSnapshot[];
  historyIndex: number;
}

export interface DrawingCanvasProps {
  width: number;
  height: number;
  chartRef?: React.RefObject<any>;
  priceScale: (price: number) => number;
  timeScale: (time: number) => number;
  invertPriceScale: (y: number) => number;
  invertTimeScale: (x: number) => number;
  onAnnotationCreate?: (annotation: Annotation) => void;
  onAnnotationUpdate?: (annotation: Annotation) => void;
  onAnnotationDelete?: (annotationId: string) => void;
  onAnnotationSelect?: (annotationIds: string[]) => void;
  readOnly?: boolean;
}

export interface AnnotationToolbarProps {
  activeTool: string | null;
  tools: DrawingTool[];
  toolSettings: ToolSettings;
  onToolChange: (toolId: string | null) => void;
  onSettingsChange: (settings: Partial<ToolSettings>) => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onClear?: () => void;
  onExport?: (options: AnnotationExportOptions) => void;
  canUndo?: boolean;
  canRedo?: boolean;
}

export interface LayerManagerProps {
  layers: AnnotationLayer[];
  activeLayers: string[];
  visibleLayers: string[];
  onLayerToggle: (layerId: string) => void;
  onLayerLock: (layerId: string) => void;
  onLayerCreate: (layer: Omit<AnnotationLayer, 'id'>) => void;
  onLayerDelete: (layerId: string) => void;
  onLayerReorder: (layerIds: string[]) => void;
}

export interface FibonacciLevels {
  retracement: number[];
  extension: number[];
  custom?: number[];
}

export interface PatternSettings {
  headAndShoulders: {
    tolerance: number;
    minHeight: number;
  };
  triangles: {
    minTouches: number;
    tolerance: number;
  };
  channels: {
    parallelTolerance: number;
    minTouches: number;
  };
  flags: {
    poleMinHeight: number;
    flagMaxWidth: number;
  };
}

export interface AnnotationAlert {
  id: string;
  annotationId: string;
  type: 'price-cross' | 'break-out' | 'touch' | 'time-based';
  condition: 'above' | 'below' | 'cross' | 'touch';
  price?: number;
  time?: number;
  message: string;
  enabled: boolean;
  triggered: boolean;
  triggeredAt?: string;
  repeatInterval?: number;
  maxTriggers?: number;
  triggerCount: number;
}

export interface AnnotationAnalytics {
  annotationId: string;
  views: number;
  interactions: number;
  accuracy?: number; // For prediction annotations
  performance?: {
    drawTime: number;
    renderTime: number;
    memoryUsage: number;
  };
  usage: {
    created: string;
    lastAccessed: string;
    totalTimeSpent: number;
  };
}

export interface DrawingMetrics {
  totalAnnotations: number;
  annotationsByType: { [type in AnnotationType]?: number };
  averageAccuracy: number;
  totalDrawingTime: number;
  mostUsedTools: string[];
  performanceMetrics: {
    averageRenderTime: number;
    peakMemoryUsage: number;
    errorRate: number;
  };
}

export interface AnnotationHitTest {
  annotation: Annotation;
  distance: number;
  point: AnnotationPoint;
  isOnLine?: boolean;
  isOnHandle?: boolean;
  handleIndex?: number;
}

export interface AnnotationTransform {
  translate?: { x: number; y: number };
  scale?: { x: number; y: number };
  rotate?: number;
  skew?: { x: number; y: number };
}

export interface AnnotationBounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
  center: { x: number; y: number };
}

// Utility types
export type AnnotationUpdateData = Partial<Omit<Annotation, 'id' | 'createdAt'>>;
export type CreateAnnotationData = Omit<Annotation, 'id' | 'createdAt' | 'updatedAt'>;

// Drawing context types
export interface DrawingContext {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  scale: number;
  offset: { x: number; y: number };
}

// Geometry utility types
export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LineSegment {
  start: AnnotationPoint;
  end: AnnotationPoint;
}

export interface Circle {
  center: AnnotationPoint;
  radius: number;
}

export interface Rectangle {
  topLeft: AnnotationPoint;
  bottomRight: AnnotationPoint;
}

// Pattern recognition types
export interface PatternCandidate {
  type: string;
  points: AnnotationPoint[];
  confidence: number;
  properties: Record<string, any>;
}

export interface PatternRecognitionResult {
  patterns: PatternCandidate[];
  executionTime: number;
  accuracy: number;
}

// Undo/Redo system
export interface AnnotationAction {
  type: 'create' | 'update' | 'delete' | 'move' | 'resize' | 'style';
  annotationId: string;
  beforeState?: Annotation;
  afterState?: Annotation;
  timestamp: string;
}

export interface AnnotationHistory {
  actions: AnnotationAction[];
  currentIndex: number;
  maxSize: number;
}

// Import/Export types
export interface AnnotationExportData {
  version: string;
  chartId: string;
  exportDate: string;
  annotations: Annotation[];
  layers: AnnotationLayer[];
  metadata: {
    totalCount: number;
    typeCounts: { [type: string]: number };
  };
}

export interface AnnotationImportResult {
  imported: number;
  skipped: number;
  errors: string[];
  warnings: string[];
  duplicates: string[];
}

// Configuration types
export interface AnnotationConfig {
  maxAnnotations: number;
  maxLayers: number;
  defaultStyle: AnnotationStyle;
  fibonacciLevels: FibonacciLevels;
  patternSettings: PatternSettings;
  snapTolerance: number;
  selectionTolerance: number;
  autoSave: boolean;
  autoSaveInterval: number;
  enablePatternRecognition: boolean;
  enableAlerts: boolean;
  enableSharing: boolean;
}

// Events
export interface AnnotationEventListener {
  onCreate?: (annotation: Annotation) => void;
  onUpdate?: (annotation: Annotation, previousState: Annotation) => void;
  onDelete?: (annotationId: string) => void;
  onSelect?: (annotationIds: string[]) => void;
  onDeselect?: () => void;
  onMove?: (annotation: Annotation, delta: { x: number; y: number }) => void;
  onResize?: (annotation: Annotation, bounds: AnnotationBounds) => void;
  onStyleChange?: (annotation: Annotation, previousStyle: AnnotationStyle) => void;
}

// Performance monitoring
export interface AnnotationPerformanceMetrics {
  renderTime: number;
  annotationCount: number;
  visibleAnnotationCount: number;
  memoryUsage: number;
  fps: number;
  hitTestTime: number;
  updateTime: number;
}

// All types are already exported above with their declarations