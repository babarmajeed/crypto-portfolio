import { useState, useCallback, useEffect, useRef } from 'react';
import {
  ChartLayout,
  ChartPanel,
  LayoutError,
  LayoutValidationResult,
  LayoutManagerState,
  LayoutActionType,
  PanelUpdateData,
  LayoutUpdateData,
  GridCell,
  LayoutAnalytics
} from '../types/chartLayout.types';
import { chartLayoutService } from '../services/ChartLayoutService';

interface UseChartLayoutOptions {
  initialLayout?: ChartLayout;
  autoSave?: boolean;
  autoSaveInterval?: number; // milliseconds
  enableAnalytics?: boolean;
  maxHistorySize?: number;
}

interface UseChartLayoutReturn {
  // Core state
  layout: ChartLayout | null;
  panels: ChartPanel[];
  isDesignMode: boolean;
  isLoading: boolean;
  isSaving: boolean;
  
  // Selection and interaction
  selectedPanelId: string | null;
  hoveredPanelId: string | null;
  
  // Grid state
  gridCells: GridCell[][];
  snapToGrid: boolean;
  showGrid: boolean;
  
  // Validation and errors
  errors: LayoutError[];
  validationResult: LayoutValidationResult | null;
  
  // Analytics
  analytics: LayoutAnalytics | null;
  
  // Layout operations
  createLayout: (layout: Partial<ChartLayout>) => Promise<string>;
  updateLayout: (updates: LayoutUpdateData) => void;
  saveLayout: (name?: string) => Promise<boolean>;
  loadLayout: (layoutId: string) => Promise<boolean>;
  deleteLayout: (layoutId: string) => Promise<boolean>;
  resetLayout: (newLayout?: ChartLayout) => void;
  
  // Panel operations
  addPanel: (panel: Omit<ChartPanel, 'id'>) => string;
  removePanel: (panelId: string) => void;
  updatePanel: (panelId: string, updates: PanelUpdateData) => void;
  movePanel: (panelId: string, newPosition: ChartPanel['position']) => void;
  resizePanel: (panelId: string, newDimensions: Pick<ChartPanel['position'], 'width' | 'height'>) => void;
  clonePanel: (panelId: string) => string | null;
  maximizePanel: (panelId: string) => void;
  minimizePanel: (panelId: string) => void;
  restorePanel: (panelId: string) => void;
  
  // Selection management
  selectPanel: (panelId: string | null) => void;
  setHoveredPanel: (panelId: string | null) => void;
  
  // Grid operations
  updateGrid: (newGrid: ChartLayout['grid']) => void;
  toggleGrid: () => void;
  toggleSnap: () => void;
  getGridCells: () => GridCell[][];
  findEmptySpace: (width: number, height: number) => { x: number; y: number } | null;
  
  // Design mode
  enterDesignMode: () => void;
  exitDesignMode: () => void;
  toggleDesignMode: () => void;
  
  // Validation
  validateLayout: (layoutToValidate?: ChartLayout) => LayoutValidationResult;
  clearErrors: () => void;
  
  // History (undo/redo)
  undo: () => boolean;
  redo: () => boolean;
  canUndo: boolean;
  canRedo: boolean;
  
  // Analytics
  trackInteraction: (action: string, data?: any) => void;
  getAnalytics: () => LayoutAnalytics | null;
}

export const useChartLayout = (options: UseChartLayoutOptions = {}): UseChartLayoutReturn => {
  const {
    initialLayout,
    autoSave = false,
    autoSaveInterval = 30000, // 30 seconds
    enableAnalytics = true,
    maxHistorySize = 50
  } = options;

  // Core state
  const [state, setState] = useState<LayoutManagerState>({
    currentLayout: initialLayout || null,
    availableLayouts: [],
    presets: [],
    templates: [],
    isDesignMode: false,
    isLoading: false,
    isSaving: false,
    selectedPanelId: null,
    draggedPanelId: null,
    hoveredPanelId: null,
    gridCells: [],
    snapToGrid: true,
    showGrid: false,
    syncedState: {},
    syncSettings: {
      syncTimeRange: false,
      syncZoom: false,
      syncCrosshair: false,
      syncSymbol: false,
      syncTimeframe: false
    },
    errors: [],
    validationResult: null,
    analytics: null
  });

  // History for undo/redo
  const [history, setHistory] = useState<ChartLayout[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const analyticsRef = useRef<{ [action: string]: number }>({});

  // Derived state
  const panels = state.currentLayout?.panels || [];
  const layout = state.currentLayout;

  // Initialize grid cells when layout changes
  useEffect(() => {
    if (layout?.grid) {
      const cells = initializeGridCells(layout.grid, panels);
      setState(prev => ({ ...prev, gridCells: cells }));
    }
  }, [layout?.grid, panels]);

  // Auto-save functionality
  useEffect(() => {
    if (autoSave && layout?.id && !state.isSaving) {
      autoSaveTimerRef.current = setTimeout(() => {
        saveLayout();
      }, autoSaveInterval);
    }

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [layout, autoSave, autoSaveInterval, state.isSaving]);

  // Initialize grid cells
  const initializeGridCells = useCallback((grid: ChartLayout['grid'], panelList: ChartPanel[]): GridCell[][] => {
    const cells: GridCell[][] = [];
    
    for (let row = 0; row < grid.rows; row++) {
      cells[row] = [];
      for (let col = 0; col < grid.columns; col++) {
        cells[row][col] = {
          x: col,
          y: row,
          isOccupied: false,
          isHighlighted: false,
          isDropTarget: false
        };
      }
    }

    // Mark occupied cells
    panelList.forEach(panel => {
      const { x, y, width, height } = panel.position;
      for (let row = y; row < y + height; row++) {
        for (let col = x; col < x + width; col++) {
          if (cells[row] && cells[row][col]) {
            cells[row][col].isOccupied = true;
            cells[row][col].panelId = panel.id;
          }
        }
      }
    });

    return cells;
  }, []);

  // Add to history
  const addToHistory = useCallback((newLayout: ChartLayout) => {
    setHistory(prev => {
      const newHistory = prev.slice(0, historyIndex + 1);
      newHistory.push(JSON.parse(JSON.stringify(newLayout)));
      
      // Limit history size
      if (newHistory.length > maxHistorySize) {
        newHistory.shift();
      } else {
        setHistoryIndex(newHistory.length - 1);
      }
      
      return newHistory;
    });
  }, [historyIndex, maxHistorySize]);

  // Update layout with history tracking
  const updateLayoutWithHistory = useCallback((updates: Partial<ChartLayout>) => {
    setState(prev => {
      if (!prev.currentLayout) return prev;
      
      const updatedLayout = {
        ...prev.currentLayout,
        ...updates,
        updatedAt: new Date().toISOString()
      };
      
      // Validate layout
      const validation = chartLayoutService.validateLayout(updatedLayout);
      
      // Add to history if valid
      if (validation.isValid) {
        addToHistory(updatedLayout);
      }
      
      return {
        ...prev,
        currentLayout: updatedLayout,
        validationResult: validation,
        errors: validation.isValid ? [] : validation.errors.map(error => ({
          code: 'VALIDATION_ERROR',
          message: error,
          source: 'layout' as const,
          severity: 'error' as const,
          timestamp: new Date().toISOString()
        }))
      };
    });
  }, [addToHistory]);

  // Layout operations
  const createLayout = useCallback(async (layoutData: Partial<ChartLayout>): Promise<string> => {
    try {
      setState(prev => ({ ...prev, isLoading: true }));
      
      const newLayout: ChartLayout = {
        name: 'New Layout',
        grid: { columns: 12, rows: 8 },
        panels: [],
        category: 'custom',
        ...layoutData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      const layoutId = await chartLayoutService.saveLayout(newLayout);
      
      setState(prev => ({
        ...prev,
        currentLayout: { ...newLayout, id: layoutId },
        isLoading: false
      }));
      
      addToHistory({ ...newLayout, id: layoutId });
      
      if (enableAnalytics) {
        trackInteraction('layout_created', { layoutId, panelCount: newLayout.panels.length });
      }
      
      return layoutId;
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        errors: [...prev.errors, {
          code: 'CREATE_FAILED',
          message: `Failed to create layout: ${error}`,
          source: 'layout',
          severity: 'error',
          timestamp: new Date().toISOString()
        }]
      }));
      throw error;
    }
  }, [addToHistory, enableAnalytics]);

  const updateLayout = useCallback((updates: LayoutUpdateData) => {
    updateLayoutWithHistory(updates);
    
    if (enableAnalytics) {
      trackInteraction('layout_updated', { updates: Object.keys(updates) });
    }
  }, [updateLayoutWithHistory, enableAnalytics]);

  const saveLayout = useCallback(async (name?: string): Promise<boolean> => {
    if (!layout) return false;
    
    try {
      setState(prev => ({ ...prev, isSaving: true }));
      
      const layoutToSave = {
        ...layout,
        ...(name && { name }),
        updatedAt: new Date().toISOString()
      };
      
      await chartLayoutService.saveLayout(layoutToSave);
      
      setState(prev => ({
        ...prev,
        currentLayout: layoutToSave,
        isSaving: false
      }));
      
      if (enableAnalytics) {
        trackInteraction('layout_saved', { layoutId: layout.id, panelCount: layout.panels.length });
      }
      
      return true;
    } catch (error) {
      setState(prev => ({
        ...prev,
        isSaving: false,
        errors: [...prev.errors, {
          code: 'SAVE_FAILED',
          message: `Failed to save layout: ${error}`,
          source: 'persistence',
          severity: 'error',
          timestamp: new Date().toISOString()
        }]
      }));
      return false;
    }
  }, [layout, enableAnalytics]);

  const loadLayout = useCallback(async (layoutId: string): Promise<boolean> => {
    try {
      setState(prev => ({ ...prev, isLoading: true }));
      
      const loadedLayout = await chartLayoutService.loadLayout(layoutId);
      
      setState(prev => ({
        ...prev,
        currentLayout: loadedLayout,
        isLoading: false,
        selectedPanelId: null
      }));
      
      addToHistory(loadedLayout);
      
      if (enableAnalytics) {
        trackInteraction('layout_loaded', { layoutId, panelCount: loadedLayout.panels.length });
      }
      
      return true;
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        errors: [...prev.errors, {
          code: 'LOAD_FAILED',
          message: `Failed to load layout: ${error}`,
          source: 'persistence',
          severity: 'error',
          timestamp: new Date().toISOString()
        }]
      }));
      return false;
    }
  }, [addToHistory, enableAnalytics]);

  const deleteLayout = useCallback(async (layoutId: string): Promise<boolean> => {
    try {
      await chartLayoutService.deleteLayout(layoutId);
      
      // If we're deleting the current layout, reset to null
      if (layout?.id === layoutId) {
        setState(prev => ({ ...prev, currentLayout: null }));
      }
      
      if (enableAnalytics) {
        trackInteraction('layout_deleted', { layoutId });
      }
      
      return true;
    } catch (error) {
      setState(prev => ({
        ...prev,
        errors: [...prev.errors, {
          code: 'DELETE_FAILED',
          message: `Failed to delete layout: ${error}`,
          source: 'persistence',
          severity: 'error',
          timestamp: new Date().toISOString()
        }]
      }));
      return false;
    }
  }, [layout, enableAnalytics]);

  const resetLayout = useCallback((newLayout?: ChartLayout) => {
    const layoutToReset = newLayout || {
      name: 'New Layout',
      grid: { columns: 12, rows: 8 },
      panels: [],
      category: 'custom' as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    setState(prev => ({
      ...prev,
      currentLayout: layoutToReset,
      selectedPanelId: null
    }));
    
    addToHistory(layoutToReset);
    
    if (enableAnalytics) {
      trackInteraction('layout_reset', { panelCount: layoutToReset.panels.length });
    }
  }, [addToHistory, enableAnalytics]);

  // Panel operations
  const addPanel = useCallback((panelData: Omit<ChartPanel, 'id'>): string => {
    if (!layout) return '';
    
    const panelId = `panel_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newPanel: ChartPanel = {
      ...panelData,
      id: panelId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    // Find empty space if position not specified or invalid
    if (!panelData.position || 
        panelData.position.x + panelData.position.width > layout.grid.columns ||
        panelData.position.y + panelData.position.height > layout.grid.rows) {
      const emptySpace = findEmptySpace(panelData.position?.width || 4, panelData.position?.height || 3);
      if (emptySpace) {
        newPanel.position = {
          x: emptySpace.x,
          y: emptySpace.y,
          width: panelData.position?.width || 4,
          height: panelData.position?.height || 3
        };
      } else {
        // If no space found, place at 0,0 (might overlap)
        newPanel.position = {
          x: 0,
          y: 0,
          width: panelData.position?.width || 4,
          height: panelData.position?.height || 3
        };
      }
    }
    
    updateLayoutWithHistory({
      panels: [...panels, newPanel]
    });
    
    if (enableAnalytics) {
      trackInteraction('panel_added', { panelId, panelType: newPanel.type });
    }
    
    return panelId;
  }, [layout, panels, updateLayoutWithHistory, enableAnalytics]);

  const removePanel = useCallback((panelId: string) => {
    updateLayoutWithHistory({
      panels: panels.filter(p => p.id !== panelId)
    });
    
    // Clear selection if removed panel was selected
    setState(prev => ({
      ...prev,
      selectedPanelId: prev.selectedPanelId === panelId ? null : prev.selectedPanelId
    }));
    
    if (enableAnalytics) {
      trackInteraction('panel_removed', { panelId });
    }
  }, [panels, updateLayoutWithHistory, enableAnalytics]);

  const updatePanel = useCallback((panelId: string, updates: PanelUpdateData) => {
    updateLayoutWithHistory({
      panels: panels.map(panel =>
        panel.id === panelId
          ? { ...panel, ...updates, updatedAt: new Date().toISOString() }
          : panel
      )
    });
    
    if (enableAnalytics) {
      trackInteraction('panel_updated', { panelId, updates: Object.keys(updates) });
    }
  }, [panels, updateLayoutWithHistory, enableAnalytics]);

  const movePanel = useCallback((panelId: string, newPosition: ChartPanel['position']) => {
    updatePanel(panelId, { position: newPosition });
    
    if (enableAnalytics) {
      trackInteraction('panel_moved', { panelId, position: newPosition });
    }
  }, [updatePanel, enableAnalytics]);

  const resizePanel = useCallback((panelId: string, newDimensions: Pick<ChartPanel['position'], 'width' | 'height'>) => {
    const panel = panels.find(p => p.id === panelId);
    if (panel) {
      updatePanel(panelId, {
        position: { ...panel.position, ...newDimensions }
      });
      
      if (enableAnalytics) {
        trackInteraction('panel_resized', { panelId, dimensions: newDimensions });
      }
    }
  }, [panels, updatePanel, enableAnalytics]);

  const clonePanel = useCallback((panelId: string): string | null => {
    const panel = panels.find(p => p.id === panelId);
    if (!panel) return null;
    
    const { id, createdAt, updatedAt, ...panelData } = panel;
    const emptySpace = findEmptySpace(panel.position.width, panel.position.height);
    
    if (emptySpace) {
      const clonedPanelId = addPanel({
        ...panelData,
        position: {
          x: emptySpace.x,
          y: emptySpace.y,
          width: panel.position.width,
          height: panel.position.height
        }
      });
      
      if (enableAnalytics) {
        trackInteraction('panel_cloned', { originalPanelId: panelId, clonedPanelId });
      }
      
      return clonedPanelId;
    }
    
    return null;
  }, [panels, addPanel, enableAnalytics]);

  const maximizePanel = useCallback((panelId: string) => {
    updatePanel(panelId, { isMaximized: true });
    
    if (enableAnalytics) {
      trackInteraction('panel_maximized', { panelId });
    }
  }, [updatePanel, enableAnalytics]);

  const minimizePanel = useCallback((panelId: string) => {
    updatePanel(panelId, { isMinimized: true });
    
    if (enableAnalytics) {
      trackInteraction('panel_minimized', { panelId });
    }
  }, [updatePanel, enableAnalytics]);

  const restorePanel = useCallback((panelId: string) => {
    updatePanel(panelId, { isMaximized: false, isMinimized: false });
    
    if (enableAnalytics) {
      trackInteraction('panel_restored', { panelId });
    }
  }, [updatePanel, enableAnalytics]);

  // Selection management
  const selectPanel = useCallback((panelId: string | null) => {
    setState(prev => ({ ...prev, selectedPanelId: panelId }));
    
    if (enableAnalytics && panelId) {
      trackInteraction('panel_selected', { panelId });
    }
  }, [enableAnalytics]);

  const setHoveredPanel = useCallback((panelId: string | null) => {
    setState(prev => ({ ...prev, hoveredPanelId: panelId }));
  }, []);

  // Grid operations
  const updateGrid = useCallback((newGrid: ChartLayout['grid']) => {
    if (!layout) return;
    
    updateLayoutWithHistory({ grid: newGrid });
    
    if (enableAnalytics) {
      trackInteraction('grid_updated', { grid: newGrid });
    }
  }, [layout, updateLayoutWithHistory, enableAnalytics]);

  const toggleGrid = useCallback(() => {
    setState(prev => ({ ...prev, showGrid: !prev.showGrid }));
    
    if (enableAnalytics) {
      trackInteraction('grid_toggled', { showGrid: !state.showGrid });
    }
  }, [state.showGrid, enableAnalytics]);

  const toggleSnap = useCallback(() => {
    setState(prev => ({ ...prev, snapToGrid: !prev.snapToGrid }));
    
    if (enableAnalytics) {
      trackInteraction('snap_toggled', { snapToGrid: !state.snapToGrid });
    }
  }, [state.snapToGrid, enableAnalytics]);

  const getGridCells = useCallback((): GridCell[][] => {
    return state.gridCells;
  }, [state.gridCells]);

  const findEmptySpace = useCallback((width: number, height: number): { x: number; y: number } | null => {
    if (!layout) return null;
    
    const { columns, rows } = layout.grid;
    
    for (let y = 0; y <= rows - height; y++) {
      for (let x = 0; x <= columns - width; x++) {
        let canPlace = true;
        
        // Check if this position is available
        for (let checkY = y; checkY < y + height && canPlace; checkY++) {
          for (let checkX = x; checkX < x + width && canPlace; checkX++) {
            if (state.gridCells[checkY] && state.gridCells[checkY][checkX] && state.gridCells[checkY][checkX].isOccupied) {
              canPlace = false;
            }
          }
        }
        
        if (canPlace) {
          return { x, y };
        }
      }
    }
    
    return null;
  }, [layout, state.gridCells]);

  // Design mode
  const enterDesignMode = useCallback(() => {
    setState(prev => ({ ...prev, isDesignMode: true, showGrid: true }));
    
    if (enableAnalytics) {
      trackInteraction('design_mode_entered');
    }
  }, [enableAnalytics]);

  const exitDesignMode = useCallback(() => {
    setState(prev => ({ 
      ...prev, 
      isDesignMode: false, 
      selectedPanelId: null,
      showGrid: false 
    }));
    
    if (enableAnalytics) {
      trackInteraction('design_mode_exited');
    }
  }, [enableAnalytics]);

  const toggleDesignMode = useCallback(() => {
    if (state.isDesignMode) {
      exitDesignMode();
    } else {
      enterDesignMode();
    }
  }, [state.isDesignMode, enterDesignMode, exitDesignMode]);

  // Validation
  const validateLayout = useCallback((layoutToValidate?: ChartLayout): LayoutValidationResult => {
    const targetLayout = layoutToValidate || layout;
    if (!targetLayout) {
      return {
        isValid: false,
        errors: ['No layout to validate'],
        warnings: [],
        suggestions: []
      };
    }
    
    return chartLayoutService.validateLayout(targetLayout);
  }, [layout]);

  const clearErrors = useCallback(() => {
    setState(prev => ({ ...prev, errors: [] }));
  }, []);

  // History (undo/redo)
  const undo = useCallback((): boolean => {
    if (historyIndex > 0) {
      const previousLayout = history[historyIndex - 1];
      setState(prev => ({
        ...prev,
        currentLayout: previousLayout,
        selectedPanelId: null
      }));
      setHistoryIndex(historyIndex - 1);
      
      if (enableAnalytics) {
        trackInteraction('undo');
      }
      
      return true;
    }
    return false;
  }, [history, historyIndex, enableAnalytics]);

  const redo = useCallback((): boolean => {
    if (historyIndex < history.length - 1) {
      const nextLayout = history[historyIndex + 1];
      setState(prev => ({
        ...prev,
        currentLayout: nextLayout,
        selectedPanelId: null
      }));
      setHistoryIndex(historyIndex + 1);
      
      if (enableAnalytics) {
        trackInteraction('redo');
      }
      
      return true;
    }
    return false;
  }, [history, historyIndex, enableAnalytics]);

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  // Analytics
  const trackInteraction = useCallback((action: string, data?: any) => {
    if (!enableAnalytics) return;
    
    analyticsRef.current[action] = (analyticsRef.current[action] || 0) + 1;
    
    // In a real implementation, this would send data to an analytics service
    console.debug('Layout interaction:', action, data);
  }, [enableAnalytics]);

  const getAnalytics = useCallback((): LayoutAnalytics | null => {
    return state.analytics;
  }, [state.analytics]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, []);

  return {
    // Core state
    layout,
    panels,
    isDesignMode: state.isDesignMode,
    isLoading: state.isLoading,
    isSaving: state.isSaving,
    
    // Selection and interaction
    selectedPanelId: state.selectedPanelId,
    hoveredPanelId: state.hoveredPanelId,
    
    // Grid state
    gridCells: state.gridCells,
    snapToGrid: state.snapToGrid,
    showGrid: state.showGrid,
    
    // Validation and errors
    errors: state.errors,
    validationResult: state.validationResult,
    
    // Analytics
    analytics: state.analytics,
    
    // Layout operations
    createLayout,
    updateLayout,
    saveLayout,
    loadLayout,
    deleteLayout,
    resetLayout,
    
    // Panel operations
    addPanel,
    removePanel,
    updatePanel,
    movePanel,
    resizePanel,
    clonePanel,
    maximizePanel,
    minimizePanel,
    restorePanel,
    
    // Selection management
    selectPanel,
    setHoveredPanel,
    
    // Grid operations
    updateGrid,
    toggleGrid,
    toggleSnap,
    getGridCells,
    findEmptySpace,
    
    // Design mode
    enterDesignMode,
    exitDesignMode,
    toggleDesignMode,
    
    // Validation
    validateLayout,
    clearErrors,
    
    // History
    undo,
    redo,
    canUndo,
    canRedo,
    
    // Analytics
    trackInteraction,
    getAnalytics
  };
};