import { useState, useCallback, useRef, useEffect } from 'react';
import {
  DrawingTool,
  ToolSettings,
  DrawingState,
  AnnotationType,
  AnnotationStyle
} from '../types/annotation.types';

interface UseDrawingToolsOptions {
  initialTool?: string;
  defaultSettings?: Partial<ToolSettings>;
  enableShortcuts?: boolean;
  autoSave?: boolean;
}

interface UseDrawingToolsReturn {
  // Tool state
  activeTool: string | null;
  tools: DrawingTool[];
  toolSettings: ToolSettings;
  drawingState: DrawingState;
  
  // Tool management
  setActiveTool: (toolId: string | null) => void;
  getToolById: (toolId: string) => DrawingTool | null;
  getToolsByCategory: (category: string) => DrawingTool[];
  
  // Settings management
  updateToolSettings: (settings: Partial<ToolSettings>) => void;
  resetToolSettings: () => void;
  getSettingsForTool: (toolId: string) => ToolSettings;
  saveToolPreset: (name: string, settings: ToolSettings) => void;
  loadToolPreset: (name: string) => boolean;
  getToolPresets: () => { [name: string]: ToolSettings };
  
  // Drawing state management
  startDrawing: (initialPoint?: { x: number; y: number }) => void;
  updateDrawing: (point: { x: number; y: number }) => void;
  finishDrawing: () => void;
  cancelDrawing: () => void;
  
  // Utility functions
  getToolCursor: (toolId: string) => string;
  isToolActive: (toolId: string) => boolean;
  canUseTool: (toolId: string) => boolean;
  getToolShortcut: (toolId: string) => string | null;
  
  // Style helpers
  getDefaultStyleForTool: (toolId: string) => AnnotationStyle;
  applyStyleToTool: (toolId: string, style: Partial<AnnotationStyle>) => void;
  
  // Validation
  validateToolSettings: (toolId: string, settings: ToolSettings) => { isValid: boolean; errors: string[] };
}

const DEFAULT_TOOLS: DrawingTool[] = [
  // Basic tools
  {
    id: 'select',
    name: 'Select',
    icon: '👆',
    description: 'Select and move annotations',
    category: 'basic',
    cursor: 'default',
    requiresPoints: 0
  },
  {
    id: 'line',
    name: 'Line',
    icon: '📏',
    description: 'Draw trend lines',
    category: 'basic',
    cursor: 'crosshair',
    requiresPoints: 2,
    settings: {
      color: '#007bff',
      lineWidth: 2,
      lineStyle: 'solid',
      infinite: false,
      ray: false
    }
  },
  {
    id: 'horizontal',
    name: 'Horizontal Line',
    icon: '➖',
    description: 'Draw horizontal support/resistance lines',
    category: 'basic',
    cursor: 'crosshair',
    requiresPoints: 1,
    settings: {
      color: '#28a745',
      lineWidth: 2,
      lineStyle: 'solid',
      infinite: true
    }
  },
  {
    id: 'vertical',
    name: 'Vertical Line',
    icon: '|',
    description: 'Draw vertical time lines',
    category: 'basic',
    cursor: 'crosshair',
    requiresPoints: 1,
    settings: {
      color: '#dc3545',
      lineWidth: 2,
      lineStyle: 'dashed',
      infinite: true
    }
  },
  
  // Shape tools
  {
    id: 'rectangle',
    name: 'Rectangle',
    icon: '▭',
    description: 'Draw rectangles and channels',
    category: 'shapes',
    cursor: 'crosshair',
    requiresPoints: 2,
    settings: {
      color: '#007bff',
      lineWidth: 2,
      lineStyle: 'solid',
      fillColor: 'rgba(0, 123, 255, 0.1)',
      fill: false
    }
  },
  {
    id: 'ellipse',
    name: 'Ellipse',
    icon: '⭕',
    description: 'Draw ellipses and circles',
    category: 'shapes',
    cursor: 'crosshair',
    requiresPoints: 2,
    settings: {
      color: '#6f42c1',
      lineWidth: 2,
      lineStyle: 'solid',
      fillColor: 'rgba(111, 66, 193, 0.1)',
      fill: false
    }
  },
  {
    id: 'triangle',
    name: 'Triangle',
    icon: '△',
    description: 'Draw triangles and patterns',
    category: 'shapes',
    cursor: 'crosshair',
    requiresPoints: 3,
    settings: {
      color: '#fd7e14',
      lineWidth: 2,
      lineStyle: 'solid',
      fillColor: 'rgba(253, 126, 20, 0.1)',
      fill: false
    }
  },
  {
    id: 'arrow',
    name: 'Arrow',
    icon: '➡️',
    description: 'Draw arrows for annotations',
    category: 'shapes',
    cursor: 'crosshair',
    requiresPoints: 2,
    settings: {
      color: '#e83e8c',
      lineWidth: 3,
      lineStyle: 'solid',
      arrowSize: 10
    }
  },
  
  // Text tools
  {
    id: 'text',
    name: 'Text',
    icon: 'T',
    description: 'Add text annotations',
    category: 'text',
    cursor: 'text',
    requiresPoints: 1,
    settings: {
      color: '#212529',
      fontSize: 14,
      fontFamily: 'Arial',
      fontWeight: 'normal',
      backgroundColor: 'rgba(255, 255, 255, 0.8)',
      borderColor: '#dee2e6',
      borderWidth: 1,
      borderRadius: 4,
      padding: 8
    }
  },
  {
    id: 'note',
    name: 'Note',
    icon: '📝',
    description: 'Add sticky notes',
    category: 'text',
    cursor: 'text',
    requiresPoints: 1,
    settings: {
      color: '#212529',
      fontSize: 12,
      fontFamily: 'Arial',
      backgroundColor: '#fff3cd',
      borderColor: '#ffeaa7',
      borderWidth: 1,
      borderRadius: 4,
      padding: 12
    }
  },
  
  // Fibonacci tools
  {
    id: 'fibonacci',
    name: 'Fibonacci Retracement',
    icon: '🌀',
    description: 'Draw fibonacci retracement levels',
    category: 'fibonacci',
    cursor: 'crosshair',
    requiresPoints: 2,
    settings: {
      color: '#17a2b8',
      lineWidth: 1,
      lineStyle: 'solid',
      showLabels: true,
      showPrices: true,
      showPercentages: true,
      levels: [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1.0]
    }
  },
  {
    id: 'fibonacci-extension',
    name: 'Fibonacci Extension',
    icon: '📐',
    description: 'Draw fibonacci extension levels',
    category: 'fibonacci',
    cursor: 'crosshair',
    requiresPoints: 3,
    settings: {
      color: '#20c997',
      lineWidth: 1,
      lineStyle: 'dashed',
      showLabels: true,
      showPrices: true,
      levels: [1.0, 1.272, 1.414, 1.618, 2.0, 2.618]
    }
  },
  {
    id: 'fibonacci-fan',
    name: 'Fibonacci Fan',
    icon: '📊',
    description: 'Draw fibonacci fan lines',
    category: 'fibonacci',
    cursor: 'crosshair',
    requiresPoints: 2,
    settings: {
      color: '#6610f2',
      lineWidth: 1,
      lineStyle: 'solid',
      showLabels: true,
      levels: [0.382, 0.5, 0.618]
    }
  },
  
  // Pattern tools
  {
    id: 'channel',
    name: 'Channel',
    icon: '📈',
    description: 'Draw trend channels',
    category: 'patterns',
    cursor: 'crosshair',
    requiresPoints: 3,
    settings: {
      color: '#ffc107',
      lineWidth: 2,
      lineStyle: 'solid',
      fillColor: 'rgba(255, 193, 7, 0.1)',
      fill: false
    }
  },
  {
    id: 'pitchfork',
    name: 'Andrews Pitchfork',
    icon: '🔱',
    description: 'Draw Andrews pitchfork',
    category: 'patterns',
    cursor: 'crosshair',
    requiresPoints: 3,
    settings: {
      color: '#795548',
      lineWidth: 1,
      lineStyle: 'solid',
      showChannels: true
    }
  },
  {
    id: 'gann-fan',
    name: 'Gann Fan',
    icon: '📡',
    description: 'Draw Gann fan lines',
    category: 'patterns',
    cursor: 'crosshair',
    requiresPoints: 2,
    settings: {
      color: '#607d8b',
      lineWidth: 1,
      lineStyle: 'solid',
      fanLines: 9
    }
  },
  
  // Measurement tools
  {
    id: 'measure',
    name: 'Measure',
    icon: '📏',
    description: 'Measure distance and angles',
    category: 'measurement',
    cursor: 'crosshair',
    requiresPoints: 2,
    settings: {
      color: '#6c757d',
      lineWidth: 1,
      lineStyle: 'solid',
      showDistance: true,
      showAngle: true,
      showPriceChange: true,
      showPercentChange: true,
      showTimeElapsed: true,
      fontSize: 12
    }
  },
  {
    id: 'price-range',
    name: 'Price Range',
    icon: '📊',
    description: 'Measure price ranges',
    category: 'measurement',
    cursor: 'ns-resize',
    requiresPoints: 2,
    settings: {
      color: '#28a745',
      lineWidth: 2,
      lineStyle: 'solid',
      showPriceChange: true,
      showPercentChange: true,
      fontSize: 12
    }
  }
];

const DEFAULT_SETTINGS: ToolSettings = {
  color: '#007bff',
  lineWidth: 2,
  lineStyle: 'solid',
  fillColor: 'transparent',
  fill: false,
  fontSize: 14,
  fontFamily: 'Arial',
  snapToPrice: false,
  snapToTime: false,
  snapTolerance: 5
};

export const useDrawingTools = (options: UseDrawingToolsOptions = {}): UseDrawingToolsReturn => {
  const {
    initialTool,
    defaultSettings = {},
    enableShortcuts = true,
    autoSave = true
  } = options;

  // State
  const [activeTool, setActiveToolState] = useState<string | null>(initialTool || 'select');
  const [toolSettings, setToolSettings] = useState<ToolSettings>({
    ...DEFAULT_SETTINGS,
    ...defaultSettings
  });
  const [drawingState, setDrawingState] = useState<DrawingState>({
    isDrawing: false,
    activeTool: initialTool || null,
    currentPoints: [],
    previewAnnotation: null,
    selectedAnnotations: [],
    hoveredAnnotation: null,
    activeLayers: ['default'],
    visibleLayers: ['default']
  });

  // Refs for persistent data
  const toolPresetsRef = useRef<{ [name: string]: ToolSettings }>({});
  const keyboardShortcutsRef = useRef<{ [key: string]: string }>({
    's': 'select',
    'l': 'line',
    'h': 'horizontal',
    'v': 'vertical',
    'r': 'rectangle',
    'e': 'ellipse',
    't': 'text',
    'f': 'fibonacci',
    'm': 'measure'
  });

  // Load saved presets on mount
  useEffect(() => {
    const savedPresets = localStorage.getItem('drawing-tool-presets');
    if (savedPresets) {
      try {
        toolPresetsRef.current = JSON.parse(savedPresets);
      } catch (error) {
        console.warn('Failed to load tool presets:', error);
      }
    }
  }, []);

  // Save presets when they change
  useEffect(() => {
    if (autoSave && Object.keys(toolPresetsRef.current).length > 0) {
      localStorage.setItem('drawing-tool-presets', JSON.stringify(toolPresetsRef.current));
    }
  }, [autoSave]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!enableShortcuts) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't trigger shortcuts if user is typing in an input
      if (event.target instanceof HTMLInputElement || 
          event.target instanceof HTMLTextAreaElement ||
          event.target instanceof HTMLSelectElement) {
        return;
      }

      const key = event.key.toLowerCase();
      const toolId = keyboardShortcutsRef.current[key];
      
      if (toolId && event.ctrlKey === false && event.metaKey === false) {
        event.preventDefault();
        setActiveTool(toolId);
      }

      // Escape to select tool
      if (key === 'escape') {
        event.preventDefault();
        setActiveTool('select');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enableShortcuts]);

  // Tool management
  const setActiveTool = useCallback((toolId: string | null) => {
    setActiveToolState(toolId);
    setDrawingState(prev => ({
      ...prev,
      activeTool: toolId,
      isDrawing: false,
      currentPoints: [],
      previewAnnotation: null
    }));

    // Update tool-specific settings
    if (toolId) {
      const tool = DEFAULT_TOOLS.find(t => t.id === toolId);
      if (tool?.settings) {
        setToolSettings(prev => ({
          ...prev,
          ...tool.settings
        }));
      }
    }
  }, []);

  const getToolById = useCallback((toolId: string): DrawingTool | null => {
    return DEFAULT_TOOLS.find(tool => tool.id === toolId) || null;
  }, []);

  const getToolsByCategory = useCallback((category: string): DrawingTool[] => {
    return DEFAULT_TOOLS.filter(tool => tool.category === category);
  }, []);

  // Settings management
  const updateToolSettings = useCallback((settings: Partial<ToolSettings>) => {
    setToolSettings(prev => ({ ...prev, ...settings }));
  }, []);

  const resetToolSettings = useCallback(() => {
    setToolSettings({ ...DEFAULT_SETTINGS, ...defaultSettings });
  }, [defaultSettings]);

  const getSettingsForTool = useCallback((toolId: string): ToolSettings => {
    const tool = getToolById(toolId);
    return {
      ...DEFAULT_SETTINGS,
      ...tool?.settings,
      ...toolSettings
    };
  }, [toolSettings, getToolById]);

  const saveToolPreset = useCallback((name: string, settings: ToolSettings) => {
    toolPresetsRef.current[name] = { ...settings };
    if (autoSave) {
      localStorage.setItem('drawing-tool-presets', JSON.stringify(toolPresetsRef.current));
    }
  }, [autoSave]);

  const loadToolPreset = useCallback((name: string): boolean => {
    const preset = toolPresetsRef.current[name];
    if (preset) {
      setToolSettings(preset);
      return true;
    }
    return false;
  }, []);

  const getToolPresets = useCallback(() => {
    return { ...toolPresetsRef.current };
  }, []);

  // Drawing state management
  const startDrawing = useCallback((initialPoint?: { x: number; y: number }) => {
    setDrawingState(prev => ({
      ...prev,
      isDrawing: true,
      currentPoints: initialPoint ? [{
        time: 0,
        price: 0,
        x: initialPoint.x,
        y: initialPoint.y
      }] : [],
      previewAnnotation: null
    }));
  }, []);

  const updateDrawing = useCallback((point: { x: number; y: number }) => {
    setDrawingState(prev => ({
      ...prev,
      currentPoints: [...prev.currentPoints, {
        time: 0,
        price: 0,
        x: point.x,
        y: point.y
      }]
    }));
  }, []);

  const finishDrawing = useCallback(() => {
    setDrawingState(prev => ({
      ...prev,
      isDrawing: false,
      currentPoints: [],
      previewAnnotation: null
    }));
  }, []);

  const cancelDrawing = useCallback(() => {
    setDrawingState(prev => ({
      ...prev,
      isDrawing: false,
      currentPoints: [],
      previewAnnotation: null
    }));
  }, []);

  // Utility functions
  const getToolCursor = useCallback((toolId: string): string => {
    const tool = getToolById(toolId);
    return tool?.cursor || 'default';
  }, [getToolById]);

  const isToolActive = useCallback((toolId: string): boolean => {
    return activeTool === toolId;
  }, [activeTool]);

  const canUseTool = useCallback((toolId: string): boolean => {
    // Add any tool availability logic here
    return DEFAULT_TOOLS.some(tool => tool.id === toolId);
  }, []);

  const getToolShortcut = useCallback((toolId: string): string | null => {
    const shortcut = Object.entries(keyboardShortcutsRef.current)
      .find(([, id]) => id === toolId);
    return shortcut ? shortcut[0].toUpperCase() : null;
  }, []);

  // Style helpers
  const getDefaultStyleForTool = useCallback((toolId: string): AnnotationStyle => {
    const tool = getToolById(toolId);
    const baseStyle: AnnotationStyle = {
      color: toolSettings.color || '#007bff',
      lineWidth: toolSettings.lineWidth || 2,
      lineStyle: toolSettings.lineStyle || 'solid',
      opacity: 1
    };

    // Add tool-specific style defaults
    switch (toolId) {
      case 'text':
      case 'note':
        return {
          ...baseStyle,
          fontSize: toolSettings.fontSize || 14,
          fontFamily: toolSettings.fontFamily || 'Arial',
          fontWeight: 'normal',
          backgroundColor: tool?.settings?.backgroundColor || 'rgba(255, 255, 255, 0.8)',
          borderColor: tool?.settings?.borderColor || '#dee2e6',
          borderWidth: tool?.settings?.borderWidth || 1,
          borderRadius: tool?.settings?.borderRadius || 4,
          padding: tool?.settings?.padding || 8
        };
      
      case 'rectangle':
      case 'ellipse':
      case 'triangle':
        return {
          ...baseStyle,
          fillColor: toolSettings.fillColor || 'transparent',
          fill: toolSettings.fill || false
        };
      
      case 'arrow':
        return {
          ...baseStyle,
          arrowSize: toolSettings.arrowSize || 10
        };
      
      default:
        return baseStyle;
    }
  }, [toolId, toolSettings, getToolById]);

  const applyStyleToTool = useCallback((toolId: string, style: Partial<AnnotationStyle>) => {
    if (toolId === activeTool) {
      updateToolSettings(style as Partial<ToolSettings>);
    }
  }, [activeTool, updateToolSettings]);

  // Validation
  const validateToolSettings = useCallback((toolId: string, settings: ToolSettings): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];
    
    // Common validations
    if (settings.lineWidth && settings.lineWidth <= 0) {
      errors.push('Line width must be positive');
    }
    
    if (settings.opacity && (settings.opacity < 0 || settings.opacity > 1)) {
      errors.push('Opacity must be between 0 and 1');
    }
    
    if (settings.fontSize && settings.fontSize <= 0) {
      errors.push('Font size must be positive');
    }
    
    if (settings.snapTolerance && settings.snapTolerance < 0) {
      errors.push('Snap tolerance must be non-negative');
    }

    // Tool-specific validations
    const tool = getToolById(toolId);
    if (tool) {
      switch (tool.category) {
        case 'fibonacci':
          if (settings.levels && (!Array.isArray(settings.levels) || settings.levels.length === 0)) {
            errors.push('Fibonacci levels must be a non-empty array');
          }
          break;
        
        case 'patterns':
          if (toolId === 'gann-fan' && settings.fanLines && settings.fanLines <= 0) {
            errors.push('Gann fan lines must be positive');
          }
          break;
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }, [getToolById]);

  // Update drawing state when active tool changes
  useEffect(() => {
    setDrawingState(prev => ({
      ...prev,
      activeTool
    }));
  }, [activeTool]);

  return {
    // Tool state
    activeTool,
    tools: DEFAULT_TOOLS,
    toolSettings,
    drawingState,
    
    // Tool management
    setActiveTool,
    getToolById,
    getToolsByCategory,
    
    // Settings management
    updateToolSettings,
    resetToolSettings,
    getSettingsForTool,
    saveToolPreset,
    loadToolPreset,
    getToolPresets,
    
    // Drawing state management
    startDrawing,
    updateDrawing,
    finishDrawing,
    cancelDrawing,
    
    // Utility functions
    getToolCursor,
    isToolActive,
    canUseTool,
    getToolShortcut,
    
    // Style helpers
    getDefaultStyleForTool,
    applyStyleToTool,
    
    // Validation
    validateToolSettings
  };
};