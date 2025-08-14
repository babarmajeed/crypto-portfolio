import { useState, useCallback, useRef, useEffect } from 'react';
import { HeatMapNode } from '../utils/heatMapCalculations';

export interface InteractionState {
  hoveredNode: HeatMapNode | null;
  selectedNode: HeatMapNode | null;
  selectedNodes: HeatMapNode[];
  tooltipData: {
    node: HeatMapNode;
    x: number;
    y: number;
    visible: boolean;
  } | null;
  zoomLevel: number;
  zoomTransform: {
    x: number;
    y: number;
    k: number;
  };
  isZooming: boolean;
  isDragging: boolean;
  selectionMode: 'single' | 'multiple' | 'none';
  lastClickTime: number;
}

export interface UseHeatMapInteractionOptions {
  enableZoom?: boolean;
  enableDrag?: boolean;
  enableSelection?: boolean;
  multiSelect?: boolean;
  doubleClickDelay?: number;
  zoomExtent?: [number, number];
  onNodeHover?: (node: HeatMapNode | null, event: MouseEvent) => void;
  onNodeClick?: (node: HeatMapNode, event: MouseEvent) => void;
  onNodeDoubleClick?: (node: HeatMapNode, event: MouseEvent) => void;
  onSelectionChange?: (selectedNodes: HeatMapNode[]) => void;
  onZoomChange?: (zoomLevel: number, transform: any) => void;
}

export const useHeatMapInteraction = (options: UseHeatMapInteractionOptions = {}) => {
  const {
    enableZoom = true,
    enableDrag = true,
    enableSelection = true,
    multiSelect = false,
    doubleClickDelay = 300,
    zoomExtent = [0.1, 10],
    onNodeHover,
    onNodeClick,
    onNodeDoubleClick,
    onSelectionChange,
    onZoomChange
  } = options;

  // State
  const [state, setState] = useState<InteractionState>({
    hoveredNode: null,
    selectedNode: null,
    selectedNodes: [],
    tooltipData: null,
    zoomLevel: 1,
    zoomTransform: { x: 0, y: 0, k: 1 },
    isZooming: false,
    isDragging: false,
    selectionMode: multiSelect ? 'multiple' : 'single',
    lastClickTime: 0
  });

  // Refs
  const clickTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLElement | null>(null);

  // Handle mouse hover
  const handleHover = useCallback((event: MouseEvent, node: HeatMapNode | null) => {
    setState(prev => ({ ...prev, hoveredNode: node }));

    if (node && event) {
      // Show tooltip
      const rect = (event.target as Element)?.getBoundingClientRect();
      if (rect) {
        setState(prev => ({
          ...prev,
          tooltipData: {
            node,
            x: event.clientX,
            y: event.clientY,
            visible: true
          }
        }));
      }
    } else {
      // Hide tooltip
      setState(prev => ({ ...prev, tooltipData: null }));
    }

    // Call external handler
    if (onNodeHover) {
      onNodeHover(node, event);
    }
  }, [onNodeHover]);

  // Handle mouse leave
  const handleMouseLeave = useCallback(() => {
    setState(prev => ({
      ...prev,
      hoveredNode: null,
      tooltipData: null
    }));
  }, []);

  // Handle node click
  const handleClick = useCallback((event: MouseEvent, node: HeatMapNode) => {
    if (!enableSelection) return;

    const currentTime = Date.now();
    const timeDiff = currentTime - state.lastClickTime;

    // Clear any existing click timeout
    if (clickTimeoutRef.current) {
      clearTimeout(clickTimeoutRef.current);
      clickTimeoutRef.current = null;
    }

    setState(prev => ({ ...prev, lastClickTime: currentTime }));

    // Check for double-click
    if (timeDiff < doubleClickDelay && state.selectedNode?.id === node.id) {
      // Double-click detected
      if (onNodeDoubleClick) {
        onNodeDoubleClick(node, event);
      }
      return;
    }

    // Single-click handling (delayed to allow for double-click detection)
    clickTimeoutRef.current = setTimeout(() => {
      let newSelectedNodes: HeatMapNode[] = [];
      let newSelectedNode: HeatMapNode | null = null;

      if (state.selectionMode === 'multiple') {
        // Multi-select mode
        if (event.ctrlKey || event.metaKey) {
          // Toggle selection
          const isSelected = state.selectedNodes.some(n => n.id === node.id);
          if (isSelected) {
            newSelectedNodes = state.selectedNodes.filter(n => n.id !== node.id);
          } else {
            newSelectedNodes = [...state.selectedNodes, node];
          }
        } else if (event.shiftKey && state.selectedNodes.length > 0) {
          // Range selection (simplified - would need ordered list for proper range)
          newSelectedNodes = [...state.selectedNodes, node];
        } else {
          // Single selection
          newSelectedNodes = [node];
          newSelectedNode = node;
        }
      } else {
        // Single select mode
        newSelectedNodes = [node];
        newSelectedNode = node;
      }

      setState(prev => ({
        ...prev,
        selectedNode: newSelectedNode,
        selectedNodes: newSelectedNodes
      }));

      // Call external handlers
      if (onNodeClick) {
        onNodeClick(node, event);
      }
      if (onSelectionChange) {
        onSelectionChange(newSelectedNodes);
      }
    }, doubleClickDelay);

  }, [
    enableSelection,
    state.lastClickTime,
    state.selectedNode,
    state.selectedNodes,
    state.selectionMode,
    doubleClickDelay,
    onNodeClick,
    onNodeDoubleClick,
    onSelectionChange
  ]);

  // Handle zoom
  const handleZoom = useCallback((zoomLevel: number, transform?: { x: number; y: number; k: number }) => {
    if (!enableZoom) return;

    const [minZoom, maxZoom] = zoomExtent;
    const clampedZoom = Math.max(minZoom, Math.min(maxZoom, zoomLevel));

    const newTransform = transform || {
      ...state.zoomTransform,
      k: clampedZoom
    };

    setState(prev => ({
      ...prev,
      zoomLevel: clampedZoom,
      zoomTransform: newTransform,
      isZooming: true
    }));

    // Reset zooming flag after a delay
    setTimeout(() => {
      setState(prev => ({ ...prev, isZooming: false }));
    }, 100);

    // Call external handler
    if (onZoomChange) {
      onZoomChange(clampedZoom, newTransform);
    }
  }, [enableZoom, zoomExtent, state.zoomTransform, onZoomChange]);

  // Handle zoom in
  const zoomIn = useCallback((factor: number = 1.5) => {
    handleZoom(state.zoomLevel * factor);
  }, [state.zoomLevel, handleZoom]);

  // Handle zoom out
  const zoomOut = useCallback((factor: number = 1.5) => {
    handleZoom(state.zoomLevel / factor);
  }, [state.zoomLevel, handleZoom]);

  // Reset zoom
  const resetZoom = useCallback(() => {
    handleZoom(1, { x: 0, y: 0, k: 1 });
  }, [handleZoom]);

  // Handle pan/drag
  const handlePan = useCallback((deltaX: number, deltaY: number) => {
    if (!enableDrag) return;

    const newTransform = {
      ...state.zoomTransform,
      x: state.zoomTransform.x + deltaX,
      y: state.zoomTransform.y + deltaY
    };

    setState(prev => ({
      ...prev,
      zoomTransform: newTransform,
      isDragging: true
    }));

    // Reset dragging flag after a delay
    setTimeout(() => {
      setState(prev => ({ ...prev, isDragging: false }));
    }, 100);
  }, [enableDrag, state.zoomTransform]);

  // Clear selection
  const clearSelection = useCallback(() => {
    setState(prev => ({
      ...prev,
      selectedNode: null,
      selectedNodes: []
    }));

    if (onSelectionChange) {
      onSelectionChange([]);
    }
  }, [onSelectionChange]);

  // Select all nodes
  const selectAll = useCallback((nodes: HeatMapNode[]) => {
    if (!enableSelection || state.selectionMode !== 'multiple') return;

    setState(prev => ({
      ...prev,
      selectedNodes: [...nodes]
    }));

    if (onSelectionChange) {
      onSelectionChange(nodes);
    }
  }, [enableSelection, state.selectionMode, onSelectionChange]);

  // Toggle selection mode
  const toggleSelectionMode = useCallback(() => {
    const newMode = state.selectionMode === 'single' ? 'multiple' : 'single';
    
    setState(prev => ({
      ...prev,
      selectionMode: newMode,
      selectedNodes: newMode === 'single' ? (prev.selectedNode ? [prev.selectedNode] : []) : prev.selectedNodes
    }));
  }, [state.selectionMode, state.selectedNode]);

  // Get node by coordinates (for click handling)
  const getNodeAtPosition = useCallback((x: number, y: number, nodes: HeatMapNode[]): HeatMapNode | null => {
    // This would need to be implemented based on the specific layout algorithm
    // For now, return null
    return null;
  }, []);

  // Handle keyboard events
  const handleKeydown = useCallback((event: KeyboardEvent) => {
    if (!containerRef.current) return;

    switch (event.key) {
      case 'Escape':
        clearSelection();
        break;
      case '+':
      case '=':
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault();
          zoomIn();
        }
        break;
      case '-':
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault();
          zoomOut();
        }
        break;
      case '0':
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault();
          resetZoom();
        }
        break;
      case 'a':
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault();
          // Would need to pass available nodes
        }
        break;
    }
  }, [clearSelection, zoomIn, zoomOut, resetZoom]);

  // Handle wheel events for zooming
  const handleWheel = useCallback((event: WheelEvent) => {
    if (!enableZoom || !event.ctrlKey) return;

    event.preventDefault();
    
    const zoomFactor = event.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = state.zoomLevel * zoomFactor;
    
    // Calculate zoom center based on mouse position
    const rect = (event.target as Element).getBoundingClientRect();
    const centerX = event.clientX - rect.left;
    const centerY = event.clientY - rect.top;

    handleZoom(newZoom);
  }, [enableZoom, state.zoomLevel, handleZoom]);

  // Set container ref and attach event listeners
  const setContainerRef = useCallback((element: HTMLElement | null) => {
    containerRef.current = element;

    if (element) {
      // Add event listeners
      element.addEventListener('keydown', handleKeydown);
      element.addEventListener('wheel', handleWheel, { passive: false });

      return () => {
        element.removeEventListener('keydown', handleKeydown);
        element.removeEventListener('wheel', handleWheel);
      };
    }
  }, [handleKeydown, handleWheel]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (clickTimeoutRef.current) {
        clearTimeout(clickTimeoutRef.current);
      }
    };
  }, []);

  // Tooltip positioning
  const updateTooltipPosition = useCallback((x: number, y: number) => {
    setState(prev => {
      if (prev.tooltipData) {
        return {
          ...prev,
          tooltipData: {
            ...prev.tooltipData,
            x,
            y
          }
        };
      }
      return prev;
    });
  }, []);

  return {
    // State
    hoveredNode: state.hoveredNode,
    selectedNode: state.selectedNode,
    selectedNodes: state.selectedNodes,
    tooltipData: state.tooltipData,
    zoomLevel: state.zoomLevel,
    zoomTransform: state.zoomTransform,
    isZooming: state.isZooming,
    isDragging: state.isDragging,
    selectionMode: state.selectionMode,

    // Event handlers
    handleHover,
    handleMouseLeave,
    handleClick,
    handleZoom,
    handlePan,

    // Actions
    zoomIn,
    zoomOut,
    resetZoom,
    clearSelection,
    selectAll,
    toggleSelectionMode,
    getNodeAtPosition,
    updateTooltipPosition,
    setContainerRef,

    // Utilities
    isNodeSelected: (node: HeatMapNode) => state.selectedNodes.some(n => n.id === node.id),
    isNodeHovered: (node: HeatMapNode) => state.hoveredNode?.id === node.id
  };
};

export default useHeatMapInteraction;