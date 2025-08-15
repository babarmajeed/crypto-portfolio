import { useState, useCallback, useEffect, useRef } from 'react';
import {
  Annotation,
  AnnotationLayer,
  AnnotationEvent,
  AnnotationAction,
  AnnotationHistory,
  AnnotationManager,
  AnnotationFilter,
  AnnotationPoint,
  AnnotationUpdateData,
  CreateAnnotationData,
  AnnotationHitTest,
  AnnotationBounds
} from '../types/annotation.types';
import { annotationService } from '../services/AnnotationService';

interface UseAnnotationsOptions {
  chartId: string;
  maxHistorySize?: number;
  autoSave?: boolean;
  autoSaveInterval?: number;
  enableRealTimeSync?: boolean;
}

interface UseAnnotationsReturn {
  // State
  annotations: Annotation[];
  layers: AnnotationLayer[];
  selectedAnnotations: string[];
  hoveredAnnotation: string | null;
  isLoading: boolean;
  isSaving: boolean;
  
  // CRUD operations
  addAnnotation: (annotation: CreateAnnotationData) => Promise<string>;
  updateAnnotation: (id: string, updates: AnnotationUpdateData) => Promise<boolean>;
  deleteAnnotation: (id: string) => Promise<boolean>;
  duplicateAnnotation: (id: string) => Promise<string | null>;
  
  // Bulk operations
  addAnnotations: (annotations: CreateAnnotationData[]) => Promise<string[]>;
  deleteAnnotations: (ids: string[]) => Promise<boolean>;
  clearAnnotations: () => Promise<boolean>;
  
  // Selection management
  selectAnnotation: (id: string) => void;
  selectAnnotations: (ids: string[]) => void;
  deselectAnnotation: (id: string) => void;
  deselectAll: () => void;
  toggleSelection: (id: string) => void;
  selectAll: () => void;
  
  // Hover management
  setHoveredAnnotation: (id: string | null) => void;
  
  // Layer management
  createLayer: (layer: Omit<AnnotationLayer, 'id'>) => Promise<string>;
  updateLayer: (id: string, updates: Partial<AnnotationLayer>) => Promise<boolean>;
  deleteLayer: (id: string) => Promise<boolean>;
  moveAnnotationToLayer: (annotationId: string, layerId: string) => Promise<boolean>;
  toggleLayerVisibility: (id: string) => Promise<boolean>;
  toggleLayerLock: (id: string) => Promise<boolean>;
  reorderLayers: (layerIds: string[]) => Promise<boolean>;
  
  // Filtering and search
  filterAnnotations: (filter: AnnotationFilter) => Annotation[];
  searchAnnotations: (query: string) => Annotation[];
  getAnnotationsByType: (type: string) => Annotation[];
  getAnnotationsByLayer: (layerId: string) => Annotation[];
  getVisibleAnnotations: () => Annotation[];
  
  // Hit testing and interaction
  hitTest: (point: AnnotationPoint, tolerance?: number) => AnnotationHitTest[];
  getAnnotationBounds: (id: string) => AnnotationBounds | null;
  isPointInAnnotation: (point: AnnotationPoint, annotationId: string) => boolean;
  
  // Persistence
  saveAnnotations: () => Promise<boolean>;
  loadAnnotations: () => Promise<boolean>;
  exportAnnotations: (format: string) => Promise<string | Blob>;
  importAnnotations: (file: File) => Promise<number>;
  
  // History and undo/redo
  undo: () => boolean;
  redo: () => boolean;
  canUndo: boolean;
  canRedo: boolean;
  clearHistory: () => void;
  getHistory: () => AnnotationHistory;
  
  // Clipboard operations
  copyAnnotations: (ids: string[]) => void;
  cutAnnotations: (ids: string[]) => Promise<boolean>;
  pasteAnnotations: (offset?: { x: number; y: number }) => Promise<string[]>;
  hasClipboardData: () => boolean;
  
  // Transformation
  moveAnnotations: (ids: string[], delta: { x: number; y: number }) => Promise<boolean>;
  scaleAnnotations: (ids: string[], scale: { x: number; y: number }, center?: AnnotationPoint) => Promise<boolean>;
  rotateAnnotations: (ids: string[], angle: number, center?: AnnotationPoint) => Promise<boolean>;
  
  // Validation
  validateAnnotation: (annotation: Annotation) => { isValid: boolean; errors: string[] };
  validateAnnotations: (annotations: Annotation[]) => { isValid: boolean; errors: string[] };
  
  // Statistics
  getAnnotationCount: () => number;
  getAnnotationsByTypeCount: () => { [type: string]: number };
  getLayerAnnotationCount: (layerId: string) => number;
  
  // Events
  addEventListener: (type: string, listener: Function) => void;
  removeEventListener: (type: string, listener: Function) => void;
  
  // Utility
  getAnnotation: (id: string) => Annotation | null;
  getLayer: (id: string) => AnnotationLayer | null;
  generateAnnotationId: () => string;
  generateLayerId: () => string;
}

export const useAnnotations = (options: UseAnnotationsOptions): UseAnnotationsReturn => {
  const {
    chartId,
    maxHistorySize = 50,
    autoSave = true,
    autoSaveInterval = 30000, // 30 seconds
    enableRealTimeSync = false
  } = options;

  // State
  const [manager, setManager] = useState<AnnotationManager>({
    annotations: new Map(),
    layers: new Map(),
    selectedIds: new Set(),
    clipboard: [],
    history: [],
    historyIndex: -1
  });
  const [hoveredAnnotation, setHoveredAnnotation] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Refs for event handling and timers
  const eventListenersRef = useRef<Map<string, Set<Function>>>(new Map());
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastSaveRef = useRef<string | null>(null);

  // Derived state
  const annotations = Array.from(manager.annotations.values());
  const layers = Array.from(manager.layers.values()).sort((a, b) => a.zIndex - b.zIndex);
  const selectedAnnotations = Array.from(manager.selectedIds);

  // Initialize default layer
  useEffect(() => {
    if (manager.layers.size === 0) {
      const defaultLayer: AnnotationLayer = {
        id: 'default',
        name: 'Default Layer',
        visible: true,
        locked: false,
        opacity: 1,
        zIndex: 0,
        annotations: []
      };
      
      setManager(prev => ({
        ...prev,
        layers: new Map([...prev.layers, [defaultLayer.id, defaultLayer]])
      }));
    }
  }, []);

  // Auto-save functionality
  useEffect(() => {
    if (autoSave && manager.annotations.size > 0 && !isSaving) {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
      
      autoSaveTimerRef.current = setTimeout(() => {
        saveAnnotations();
      }, autoSaveInterval);
    }

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [manager.annotations, autoSave, autoSaveInterval, isSaving]);

  // Load annotations on mount
  useEffect(() => {
    loadAnnotations();
  }, [chartId]);

  // Event system
  const dispatchEvent = useCallback((event: AnnotationEvent) => {
    const listeners = eventListenersRef.current.get(event.type);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(event);
        } catch (error) {
          console.error('Error in annotation event listener:', error);
        }
      });
    }
  }, []);

  const addEventListener = useCallback((type: string, listener: Function) => {
    if (!eventListenersRef.current.has(type)) {
      eventListenersRef.current.set(type, new Set());
    }
    eventListenersRef.current.get(type)!.add(listener);
  }, []);

  const removeEventListener = useCallback((type: string, listener: Function) => {
    const listeners = eventListenersRef.current.get(type);
    if (listeners) {
      listeners.delete(listener);
    }
  }, []);

  // History management
  const addToHistory = useCallback((action: AnnotationAction) => {
    setManager(prev => {
      const newHistory = prev.history.slice(0, prev.historyIndex + 1);
      newHistory.push(action);
      
      // Limit history size
      if (newHistory.length > maxHistorySize) {
        newHistory.shift();
      } else {
        return {
          ...prev,
          history: newHistory,
          historyIndex: newHistory.length - 1
        };
      }
      
      return {
        ...prev,
        history: newHistory,
        historyIndex: newHistory.length - 1
      };
    });
  }, [maxHistorySize]);

  // CRUD operations
  const addAnnotation = useCallback(async (annotationData: CreateAnnotationData): Promise<string> => {
    try {
      const id = generateAnnotationId();
      const now = new Date().toISOString();
      
      const annotation: Annotation = {
        ...annotationData,
        id,
        createdAt: now,
        updatedAt: now,
        visible: annotationData.visible !== false,
        layer: annotationData.layer || 'default'
      } as Annotation;

      setManager(prev => ({
        ...prev,
        annotations: new Map([...prev.annotations, [id, annotation]])
      }));

      // Add to layer
      if (annotation.layer) {
        setManager(prev => {
          const layer = prev.layers.get(annotation.layer!);
          if (layer) {
            const updatedLayer = {
              ...layer,
              annotations: [...layer.annotations, id]
            };
            return {
              ...prev,
              layers: new Map([...prev.layers, [layer.id, updatedLayer]])
            };
          }
          return prev;
        });
      }

      // Add to history
      addToHistory({
        type: 'create',
        annotationId: id,
        afterState: annotation,
        timestamp: now
      });

      // Dispatch event
      dispatchEvent({
        type: 'create',
        annotation,
        timestamp: now
      });

      return id;
    } catch (error) {
      console.error('Error adding annotation:', error);
      throw error;
    }
  }, [addToHistory, dispatchEvent]);

  const updateAnnotation = useCallback(async (id: string, updates: AnnotationUpdateData): Promise<boolean> => {
    try {
      const existing = manager.annotations.get(id);
      if (!existing) return false;

      const now = new Date().toISOString();
      const updated: Annotation = {
        ...existing,
        ...updates,
        id, // Ensure ID doesn't change
        updatedAt: now
      };

      setManager(prev => ({
        ...prev,
        annotations: new Map([...prev.annotations, [id, updated]])
      }));

      // Add to history
      addToHistory({
        type: 'update',
        annotationId: id,
        beforeState: existing,
        afterState: updated,
        timestamp: now
      });

      // Dispatch event
      dispatchEvent({
        type: 'update',
        annotation: updated,
        previousState: existing,
        timestamp: now
      });

      return true;
    } catch (error) {
      console.error('Error updating annotation:', error);
      return false;
    }
  }, [manager.annotations, addToHistory, dispatchEvent]);

  const deleteAnnotation = useCallback(async (id: string): Promise<boolean> => {
    try {
      const existing = manager.annotations.get(id);
      if (!existing) return false;

      setManager(prev => {
        const newAnnotations = new Map(prev.annotations);
        newAnnotations.delete(id);
        
        const newSelectedIds = new Set(prev.selectedIds);
        newSelectedIds.delete(id);

        // Remove from layers
        const newLayers = new Map();
        prev.layers.forEach((layer, layerId) => {
          const updatedLayer = {
            ...layer,
            annotations: layer.annotations.filter(aid => aid !== id)
          };
          newLayers.set(layerId, updatedLayer);
        });

        return {
          ...prev,
          annotations: newAnnotations,
          selectedIds: newSelectedIds,
          layers: newLayers
        };
      });

      // Add to history
      addToHistory({
        type: 'delete',
        annotationId: id,
        beforeState: existing,
        timestamp: new Date().toISOString()
      });

      // Dispatch event
      dispatchEvent({
        type: 'delete',
        annotation: existing,
        timestamp: new Date().toISOString()
      });

      return true;
    } catch (error) {
      console.error('Error deleting annotation:', error);
      return false;
    }
  }, [manager.annotations, addToHistory, dispatchEvent]);

  const duplicateAnnotation = useCallback(async (id: string): Promise<string | null> => {
    try {
      const existing = manager.annotations.get(id);
      if (!existing) return null;

      const { id: _, createdAt, updatedAt, ...annotationData } = existing;
      const offset = { x: 20, y: 20 }; // Slight offset for the duplicate

      // Apply offset to points/position
      let duplicateData = { ...annotationData };
      if ('points' in existing && existing.points) {
        duplicateData = {
          ...duplicateData,
          points: existing.points.map(point => ({
            ...point,
            x: (point.x || 0) + offset.x,
            y: (point.y || 0) + offset.y
          }))
        } as any;
      } else if ('position' in existing && existing.position) {
        duplicateData = {
          ...duplicateData,
          position: {
            ...existing.position,
            x: (existing.position.x || 0) + offset.x,
            y: (existing.position.y || 0) + offset.y
          }
        } as any;
      }

      return await addAnnotation(duplicateData as CreateAnnotationData);
    } catch (error) {
      console.error('Error duplicating annotation:', error);
      return null;
    }
  }, [manager.annotations, addAnnotation]);

  // Bulk operations
  const addAnnotations = useCallback(async (annotationsData: CreateAnnotationData[]): Promise<string[]> => {
    try {
      const ids: string[] = [];
      for (const data of annotationsData) {
        const id = await addAnnotation(data);
        ids.push(id);
      }
      return ids;
    } catch (error) {
      console.error('Error adding annotations:', error);
      throw error;
    }
  }, [addAnnotation]);

  const deleteAnnotations = useCallback(async (ids: string[]): Promise<boolean> => {
    try {
      let allDeleted = true;
      for (const id of ids) {
        const deleted = await deleteAnnotation(id);
        if (!deleted) allDeleted = false;
      }
      return allDeleted;
    } catch (error) {
      console.error('Error deleting annotations:', error);
      return false;
    }
  }, [deleteAnnotation]);

  const clearAnnotations = useCallback(async (): Promise<boolean> => {
    try {
      const allIds = Array.from(manager.annotations.keys());
      return await deleteAnnotations(allIds);
    } catch (error) {
      console.error('Error clearing annotations:', error);
      return false;
    }
  }, [manager.annotations, deleteAnnotations]);

  // Selection management
  const selectAnnotation = useCallback((id: string) => {
    setManager(prev => ({
      ...prev,
      selectedIds: new Set([id])
    }));

    dispatchEvent({
      type: 'select',
      annotation: manager.annotations.get(id)!,
      timestamp: new Date().toISOString()
    });
  }, [manager.annotations, dispatchEvent]);

  const selectAnnotations = useCallback((ids: string[]) => {
    setManager(prev => ({
      ...prev,
      selectedIds: new Set(ids.filter(id => prev.annotations.has(id)))
    }));
  }, []);

  const deselectAnnotation = useCallback((id: string) => {
    setManager(prev => {
      const newSelectedIds = new Set(prev.selectedIds);
      newSelectedIds.delete(id);
      return {
        ...prev,
        selectedIds: newSelectedIds
      };
    });
  }, []);

  const deselectAll = useCallback(() => {
    setManager(prev => ({
      ...prev,
      selectedIds: new Set()
    }));

    dispatchEvent({
      type: 'deselect',
      annotation: {} as Annotation,
      timestamp: new Date().toISOString()
    });
  }, [dispatchEvent]);

  const toggleSelection = useCallback((id: string) => {
    if (manager.selectedIds.has(id)) {
      deselectAnnotation(id);
    } else {
      selectAnnotation(id);
    }
  }, [manager.selectedIds, deselectAnnotation, selectAnnotation]);

  const selectAll = useCallback(() => {
    setManager(prev => ({
      ...prev,
      selectedIds: new Set(prev.annotations.keys())
    }));
  }, []);

  // Layer management
  const createLayer = useCallback(async (layerData: Omit<AnnotationLayer, 'id'>): Promise<string> => {
    try {
      const id = generateLayerId();
      const layer: AnnotationLayer = {
        ...layerData,
        id,
        annotations: []
      };

      setManager(prev => ({
        ...prev,
        layers: new Map([...prev.layers, [id, layer]])
      }));

      return id;
    } catch (error) {
      console.error('Error creating layer:', error);
      throw error;
    }
  }, []);

  const updateLayer = useCallback(async (id: string, updates: Partial<AnnotationLayer>): Promise<boolean> => {
    try {
      const existing = manager.layers.get(id);
      if (!existing) return false;

      const updated = { ...existing, ...updates, id };
      setManager(prev => ({
        ...prev,
        layers: new Map([...prev.layers, [id, updated]])
      }));

      return true;
    } catch (error) {
      console.error('Error updating layer:', error);
      return false;
    }
  }, [manager.layers]);

  const deleteLayer = useCallback(async (id: string): Promise<boolean> => {
    try {
      if (id === 'default') return false; // Cannot delete default layer

      const layer = manager.layers.get(id);
      if (!layer) return false;

      // Move annotations to default layer
      const defaultLayer = manager.layers.get('default');
      if (defaultLayer) {
        const updatedDefaultLayer = {
          ...defaultLayer,
          annotations: [...defaultLayer.annotations, ...layer.annotations]
        };
        
        setManager(prev => {
          const newLayers = new Map(prev.layers);
          newLayers.delete(id);
          newLayers.set('default', updatedDefaultLayer);
          
          return {
            ...prev,
            layers: newLayers
          };
        });

        // Update annotation layer references
        for (const annotationId of layer.annotations) {
          await updateAnnotation(annotationId, { layer: 'default' });
        }
      }

      return true;
    } catch (error) {
      console.error('Error deleting layer:', error);
      return false;
    }
  }, [manager.layers, updateAnnotation]);

  const moveAnnotationToLayer = useCallback(async (annotationId: string, layerId: string): Promise<boolean> => {
    try {
      const annotation = manager.annotations.get(annotationId);
      const targetLayer = manager.layers.get(layerId);
      
      if (!annotation || !targetLayer) return false;

      // Remove from current layer
      if (annotation.layer) {
        const currentLayer = manager.layers.get(annotation.layer);
        if (currentLayer) {
          const updatedCurrentLayer = {
            ...currentLayer,
            annotations: currentLayer.annotations.filter(id => id !== annotationId)
          };
          setManager(prev => ({
            ...prev,
            layers: new Map([...prev.layers, [currentLayer.id, updatedCurrentLayer]])
          }));
        }
      }

      // Add to target layer
      const updatedTargetLayer = {
        ...targetLayer,
        annotations: [...targetLayer.annotations, annotationId]
      };
      setManager(prev => ({
        ...prev,
        layers: new Map([...prev.layers, [layerId, updatedTargetLayer]])
      }));

      // Update annotation
      await updateAnnotation(annotationId, { layer: layerId });

      return true;
    } catch (error) {
      console.error('Error moving annotation to layer:', error);
      return false;
    }
  }, [manager.annotations, manager.layers, updateAnnotation]);

  const toggleLayerVisibility = useCallback(async (id: string): Promise<boolean> => {
    const layer = manager.layers.get(id);
    if (!layer) return false;
    return await updateLayer(id, { visible: !layer.visible });
  }, [manager.layers, updateLayer]);

  const toggleLayerLock = useCallback(async (id: string): Promise<boolean> => {
    const layer = manager.layers.get(id);
    if (!layer) return false;
    return await updateLayer(id, { locked: !layer.locked });
  }, [manager.layers, updateLayer]);

  const reorderLayers = useCallback(async (layerIds: string[]): Promise<boolean> => {
    try {
      const updatedLayers = new Map();
      layerIds.forEach((layerId, index) => {
        const layer = manager.layers.get(layerId);
        if (layer) {
          updatedLayers.set(layerId, { ...layer, zIndex: index });
        }
      });

      setManager(prev => ({
        ...prev,
        layers: updatedLayers
      }));

      return true;
    } catch (error) {
      console.error('Error reordering layers:', error);
      return false;
    }
  }, [manager.layers]);

  // Filtering and search
  const filterAnnotations = useCallback((filter: AnnotationFilter): Annotation[] => {
    return annotationService.filterAnnotations(annotations, filter);
  }, [annotations]);

  const searchAnnotations = useCallback((query: string): Annotation[] => {
    return annotationService.searchAnnotations(annotations, query);
  }, [annotations]);

  const getAnnotationsByType = useCallback((type: string): Annotation[] => {
    return annotations.filter(annotation => annotation.type === type);
  }, [annotations]);

  const getAnnotationsByLayer = useCallback((layerId: string): Annotation[] => {
    return annotations.filter(annotation => annotation.layer === layerId);
  }, [annotations]);

  const getVisibleAnnotations = useCallback((): Annotation[] => {
    return annotations.filter(annotation => {
      if (!annotation.visible) return false;
      const layer = manager.layers.get(annotation.layer || 'default');
      return layer?.visible !== false;
    });
  }, [annotations, manager.layers]);

  // Hit testing (simplified implementation)
  const hitTest = useCallback((point: AnnotationPoint, tolerance = 5): AnnotationHitTest[] => {
    const hits: AnnotationHitTest[] = [];
    
    for (const annotation of getVisibleAnnotations()) {
      // Simplified hit testing - would need more sophisticated geometry calculations
      let distance = Infinity;
      let isHit = false;

      if ('position' in annotation) {
        const dx = (annotation.position.x || 0) - (point.x || 0);
        const dy = (annotation.position.y || 0) - (point.y || 0);
        distance = Math.sqrt(dx * dx + dy * dy);
        isHit = distance <= tolerance;
      } else if ('points' in annotation && annotation.points.length > 0) {
        // Check distance to first point (simplified)
        const firstPoint = annotation.points[0];
        const dx = (firstPoint.x || 0) - (point.x || 0);
        const dy = (firstPoint.y || 0) - (point.y || 0);
        distance = Math.sqrt(dx * dx + dy * dy);
        isHit = distance <= tolerance;
      }

      if (isHit) {
        hits.push({
          annotation,
          distance,
          point,
          isOnLine: true
        });
      }
    }

    return hits.sort((a, b) => a.distance - b.distance);
  }, [getVisibleAnnotations]);

  const getAnnotationBounds = useCallback((id: string): AnnotationBounds | null => {
    const annotation = manager.annotations.get(id);
    if (!annotation) return null;

    // Simplified bounds calculation
    let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;

    if ('position' in annotation) {
      left = right = annotation.position.x || 0;
      top = bottom = annotation.position.y || 0;
    } else if ('points' in annotation) {
      for (const point of annotation.points) {
        left = Math.min(left, point.x || 0);
        right = Math.max(right, point.x || 0);
        top = Math.min(top, point.y || 0);
        bottom = Math.max(bottom, point.y || 0);
      }
    }

    if (left === Infinity) return null;

    return {
      left,
      top,
      right,
      bottom,
      width: right - left,
      height: bottom - top,
      center: { x: (left + right) / 2, y: (top + bottom) / 2 }
    };
  }, [manager.annotations]);

  const isPointInAnnotation = useCallback((point: AnnotationPoint, annotationId: string): boolean => {
    const hits = hitTest(point, 1);
    return hits.some(hit => hit.annotation.id === annotationId);
  }, [hitTest]);

  // Persistence
  const saveAnnotations = useCallback(async (): Promise<boolean> => {
    try {
      setIsSaving(true);
      const success = await annotationService.saveAnnotations(chartId, annotations, layers);
      lastSaveRef.current = new Date().toISOString();
      return success;
    } catch (error) {
      console.error('Error saving annotations:', error);
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [chartId, annotations, layers]);

  const loadAnnotations = useCallback(async (): Promise<boolean> => {
    try {
      setIsLoading(true);
      const { annotations: loadedAnnotations, layers: loadedLayers } = await annotationService.loadAnnotations(chartId);
      
      setManager(prev => ({
        ...prev,
        annotations: new Map(loadedAnnotations.map(a => [a.id, a])),
        layers: new Map(loadedLayers.map(l => [l.id, l]))
      }));

      return true;
    } catch (error) {
      console.error('Error loading annotations:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [chartId]);

  const exportAnnotations = useCallback(async (format: string): Promise<string | Blob> => {
    return await annotationService.exportAnnotations(chartId, { format: format as any });
  }, [chartId]);

  const importAnnotations = useCallback(async (file: File): Promise<number> => {
    try {
      const result = await annotationService.importAnnotations(file, chartId);
      if (result.imported > 0) {
        await loadAnnotations(); // Reload to get imported annotations
      }
      return result.imported;
    } catch (error) {
      console.error('Error importing annotations:', error);
      throw error;
    }
  }, [chartId, loadAnnotations]);

  // History and undo/redo
  const undo = useCallback((): boolean => {
    if (manager.historyIndex <= 0) return false;

    const action = manager.history[manager.historyIndex];
    if (!action) return false;

    try {
      // Reverse the action
      switch (action.type) {
        case 'create':
          setManager(prev => {
            const newAnnotations = new Map(prev.annotations);
            newAnnotations.delete(action.annotationId);
            return {
              ...prev,
              annotations: newAnnotations,
              historyIndex: prev.historyIndex - 1
            };
          });
          break;

        case 'delete':
          if (action.beforeState) {
            setManager(prev => ({
              ...prev,
              annotations: new Map([...prev.annotations, [action.annotationId, action.beforeState!]]),
              historyIndex: prev.historyIndex - 1
            }));
          }
          break;

        case 'update':
          if (action.beforeState) {
            setManager(prev => ({
              ...prev,
              annotations: new Map([...prev.annotations, [action.annotationId, action.beforeState!]]),
              historyIndex: prev.historyIndex - 1
            }));
          }
          break;
      }

      return true;
    } catch (error) {
      console.error('Error during undo:', error);
      return false;
    }
  }, [manager.history, manager.historyIndex]);

  const redo = useCallback((): boolean => {
    if (manager.historyIndex >= manager.history.length - 1) return false;

    const nextIndex = manager.historyIndex + 1;
    const action = manager.history[nextIndex];
    if (!action) return false;

    try {
      // Redo the action
      switch (action.type) {
        case 'create':
          if (action.afterState) {
            setManager(prev => ({
              ...prev,
              annotations: new Map([...prev.annotations, [action.annotationId, action.afterState!]]),
              historyIndex: nextIndex
            }));
          }
          break;

        case 'delete':
          setManager(prev => {
            const newAnnotations = new Map(prev.annotations);
            newAnnotations.delete(action.annotationId);
            return {
              ...prev,
              annotations: newAnnotations,
              historyIndex: nextIndex
            };
          });
          break;

        case 'update':
          if (action.afterState) {
            setManager(prev => ({
              ...prev,
              annotations: new Map([...prev.annotations, [action.annotationId, action.afterState!]]),
              historyIndex: nextIndex
            }));
          }
          break;
      }

      return true;
    } catch (error) {
      console.error('Error during redo:', error);
      return false;
    }
  }, [manager.history, manager.historyIndex]);

  const canUndo = manager.historyIndex > 0;
  const canRedo = manager.historyIndex < manager.history.length - 1;

  const clearHistory = useCallback(() => {
    setManager(prev => ({
      ...prev,
      history: [],
      historyIndex: -1
    }));
  }, []);

  const getHistory = useCallback((): AnnotationHistory => {
    return {
      actions: manager.history,
      currentIndex: manager.historyIndex,
      maxSize: maxHistorySize
    };
  }, [manager.history, manager.historyIndex, maxHistorySize]);

  // Clipboard operations
  const copyAnnotations = useCallback((ids: string[]) => {
    const annotationsToCopy = ids
      .map(id => manager.annotations.get(id))
      .filter(Boolean) as Annotation[];
    
    setManager(prev => ({
      ...prev,
      clipboard: annotationsToCopy
    }));
  }, [manager.annotations]);

  const cutAnnotations = useCallback(async (ids: string[]): Promise<boolean> => {
    copyAnnotations(ids);
    return await deleteAnnotations(ids);
  }, [copyAnnotations, deleteAnnotations]);

  const pasteAnnotations = useCallback(async (offset = { x: 10, y: 10 }): Promise<string[]> => {
    if (manager.clipboard.length === 0) return [];

    const pastedIds: string[] = [];
    for (const annotation of manager.clipboard) {
      const { id: _, createdAt, updatedAt, ...data } = annotation;
      
      // Apply offset
      let pasteData = { ...data };
      if ('points' in annotation && annotation.points) {
        pasteData = {
          ...pasteData,
          points: annotation.points.map(point => ({
            ...point,
            x: (point.x || 0) + offset.x,
            y: (point.y || 0) + offset.y
          }))
        } as any;
      } else if ('position' in annotation && annotation.position) {
        pasteData = {
          ...pasteData,
          position: {
            ...annotation.position,
            x: (annotation.position.x || 0) + offset.x,
            y: (annotation.position.y || 0) + offset.y
          }
        } as any;
      }

      try {
        const id = await addAnnotation(pasteData as CreateAnnotationData);
        pastedIds.push(id);
      } catch (error) {
        console.error('Error pasting annotation:', error);
      }
    }

    return pastedIds;
  }, [manager.clipboard, addAnnotation]);

  const hasClipboardData = useCallback((): boolean => {
    return manager.clipboard.length > 0;
  }, [manager.clipboard]);

  // Transformation operations (simplified implementations)
  const moveAnnotations = useCallback(async (ids: string[], delta: { x: number; y: number }): Promise<boolean> => {
    try {
      for (const id of ids) {
        const annotation = manager.annotations.get(id);
        if (!annotation) continue;

        let updates: AnnotationUpdateData = {};
        
        if ('points' in annotation && annotation.points) {
          updates = {
            points: annotation.points.map(point => ({
              ...point,
              x: (point.x || 0) + delta.x,
              y: (point.y || 0) + delta.y
            }))
          } as any;
        } else if ('position' in annotation && annotation.position) {
          updates = {
            position: {
              ...annotation.position,
              x: (annotation.position.x || 0) + delta.x,
              y: (annotation.position.y || 0) + delta.y
            }
          } as any;
        }

        await updateAnnotation(id, updates);
      }

      return true;
    } catch (error) {
      console.error('Error moving annotations:', error);
      return false;
    }
  }, [manager.annotations, updateAnnotation]);

  const scaleAnnotations = useCallback(async (ids: string[], scale: { x: number; y: number }, center?: AnnotationPoint): Promise<boolean> => {
    // Simplified implementation
    console.log('Scale annotations not fully implemented');
    return true;
  }, []);

  const rotateAnnotations = useCallback(async (ids: string[], angle: number, center?: AnnotationPoint): Promise<boolean> => {
    // Simplified implementation
    console.log('Rotate annotations not fully implemented');
    return true;
  }, []);

  // Validation
  const validateAnnotation = useCallback((annotation: Annotation) => {
    return annotationService.validateAnnotation(annotation);
  }, []);

  const validateAnnotations = useCallback((annotations: Annotation[]) => {
    return annotationService.validateAnnotations(annotations);
  }, []);

  // Statistics
  const getAnnotationCount = useCallback((): number => {
    return manager.annotations.size;
  }, [manager.annotations]);

  const getAnnotationsByTypeCount = useCallback((): { [type: string]: number } => {
    const counts: { [type: string]: number } = {};
    for (const annotation of manager.annotations.values()) {
      counts[annotation.type] = (counts[annotation.type] || 0) + 1;
    }
    return counts;
  }, [manager.annotations]);

  const getLayerAnnotationCount = useCallback((layerId: string): number => {
    const layer = manager.layers.get(layerId);
    return layer?.annotations.length || 0;
  }, [manager.layers]);

  // Utility functions
  const getAnnotation = useCallback((id: string): Annotation | null => {
    return manager.annotations.get(id) || null;
  }, [manager.annotations]);

  const getLayer = useCallback((id: string): AnnotationLayer | null => {
    return manager.layers.get(id) || null;
  }, [manager.layers]);

  const generateAnnotationId = useCallback((): string => {
    return `annotation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  const generateLayerId = useCallback((): string => {
    return `layer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, []);

  return {
    // State
    annotations,
    layers,
    selectedAnnotations,
    hoveredAnnotation,
    isLoading,
    isSaving,
    
    // CRUD operations
    addAnnotation,
    updateAnnotation,
    deleteAnnotation,
    duplicateAnnotation,
    
    // Bulk operations
    addAnnotations,
    deleteAnnotations,
    clearAnnotations,
    
    // Selection management
    selectAnnotation,
    selectAnnotations,
    deselectAnnotation,
    deselectAll,
    toggleSelection,
    selectAll,
    
    // Hover management
    setHoveredAnnotation,
    
    // Layer management
    createLayer,
    updateLayer,
    deleteLayer,
    moveAnnotationToLayer,
    toggleLayerVisibility,
    toggleLayerLock,
    reorderLayers,
    
    // Filtering and search
    filterAnnotations,
    searchAnnotations,
    getAnnotationsByType,
    getAnnotationsByLayer,
    getVisibleAnnotations,
    
    // Hit testing and interaction
    hitTest,
    getAnnotationBounds,
    isPointInAnnotation,
    
    // Persistence
    saveAnnotations,
    loadAnnotations,
    exportAnnotations,
    importAnnotations,
    
    // History and undo/redo
    undo,
    redo,
    canUndo,
    canRedo,
    clearHistory,
    getHistory,
    
    // Clipboard operations
    copyAnnotations,
    cutAnnotations,
    pasteAnnotations,
    hasClipboardData,
    
    // Transformation
    moveAnnotations,
    scaleAnnotations,
    rotateAnnotations,
    
    // Validation
    validateAnnotation,
    validateAnnotations,
    
    // Statistics
    getAnnotationCount,
    getAnnotationsByTypeCount,
    getLayerAnnotationCount,
    
    // Events
    addEventListener,
    removeEventListener,
    
    // Utility
    getAnnotation,
    getLayer,
    generateAnnotationId,
    generateLayerId
  };
};