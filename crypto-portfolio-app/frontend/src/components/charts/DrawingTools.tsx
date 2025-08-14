import React, { useState, useCallback, useEffect } from 'react';
import { 
  Minus, 
  TrendingUp, 
  Square, 
  Circle, 
  Type, 
  Ruler, 
  MousePointer, 
  Trash2,
  Undo,
  Redo,
  Save,
  Palette
} from 'lucide-react';
import { IChartApi, ISeriesApi, createPriceLine } from 'lightweight-charts';
import { useResponsive } from '../../hooks/useResponsive';

interface DrawingTool {
  id: string;
  type: 'line' | 'trend' | 'horizontal' | 'vertical' | 'rectangle' | 'circle' | 'text' | 'fibonacci';
  name: string;
  icon: React.ComponentType<any>;
  cursor: string;
}

interface DrawingObject {
  id: string;
  type: string;
  points: Array<{ time: number; price: number }>;
  style: {
    color: string;
    lineWidth: number;
    lineStyle: 'solid' | 'dashed' | 'dotted';
  };
  text?: string;
  visible: boolean;
}

interface DrawingToolsProps {
  chart: IChartApi | null;
  onDrawingChange?: (drawings: DrawingObject[]) => void;
  className?: string;
}

const drawingTools: DrawingTool[] = [
  {
    id: 'select',
    type: 'line',
    name: 'Select',
    icon: MousePointer,
    cursor: 'default'
  },
  {
    id: 'trend',
    type: 'trend',
    name: 'Trend Line',
    icon: TrendingUp,
    cursor: 'crosshair'
  },
  {
    id: 'horizontal',
    type: 'horizontal',
    name: 'Horizontal Line',
    icon: Minus,
    cursor: 'crosshair'
  },
  {
    id: 'vertical',
    type: 'vertical',
    name: 'Vertical Line',
    icon: Ruler,
    cursor: 'crosshair'
  },
  {
    id: 'rectangle',
    type: 'rectangle',
    name: 'Rectangle',
    icon: Square,
    cursor: 'crosshair'
  },
  {
    id: 'circle',
    type: 'circle',
    name: 'Circle',
    icon: Circle,
    cursor: 'crosshair'
  },
  {
    id: 'text',
    type: 'text',
    name: 'Text',
    icon: Type,
    cursor: 'text'
  }
];

const colors = [
  '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6',
  '#f97316', '#06b6d4', '#84cc16', '#ec4899', '#6366f1'
];

const DrawingTools: React.FC<DrawingToolsProps> = ({
  chart,
  onDrawingChange,
  className = ''
}) => {
  const [selectedTool, setSelectedTool] = useState<string>('select');
  const [drawings, setDrawings] = useState<DrawingObject[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentDrawing, setCurrentDrawing] = useState<Partial<DrawingObject> | null>(null);
  const [selectedColor, setSelectedColor] = useState('#3b82f6');
  const [lineWidth, setLineWidth] = useState(2);
  const [lineStyle, setLineStyle] = useState<'solid' | 'dashed' | 'dotted'>('solid');
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showStyleMenu, setShowStyleMenu] = useState(false);
  const [undoStack, setUndoStack] = useState<DrawingObject[][]>([]);
  const [redoStack, setRedoStack] = useState<DrawingObject[][]>([]);
  
  const { isMobile } = useResponsive();

  // Handle tool selection
  const handleToolSelect = useCallback((toolId: string) => {
    setSelectedTool(toolId);
    setIsDrawing(false);
    setCurrentDrawing(null);
  }, []);

  // Handle chart click for drawing
  const handleChartClick = useCallback((event: any) => {
    if (!chart || selectedTool === 'select') return;

    const param = event.detail;
    if (!param || !param.time || typeof param.seriesPrices.get === 'undefined') return;

    const time = param.time;
    const price = Array.from(param.seriesPrices.values())[0]?.close || param.point?.y;
    
    if (!price) return;

    const point = { time, price };

    if (!isDrawing) {
      // Start new drawing
      const newDrawing: Partial<DrawingObject> = {
        id: `drawing_${Date.now()}`,
        type: selectedTool,
        points: [point],
        style: {
          color: selectedColor,
          lineWidth,
          lineStyle
        },
        visible: true
      };

      if (selectedTool === 'text') {
        const text = prompt('Enter text:');
        if (text) {
          newDrawing.text = text;
        } else {
          return;
        }
      }

      setCurrentDrawing(newDrawing);
      setIsDrawing(true);
    } else {
      // Complete drawing
      if (currentDrawing) {
        const completedDrawing: DrawingObject = {
          ...currentDrawing,
          points: [...(currentDrawing.points || []), point]
        } as DrawingObject;

        // Save state for undo
        setUndoStack(prev => [...prev, drawings]);
        setRedoStack([]);

        const newDrawings = [...drawings, completedDrawing];
        setDrawings(newDrawings);
        onDrawingChange?.(newDrawings);
        
        setIsDrawing(false);
        setCurrentDrawing(null);
        setSelectedTool('select');
      }
    }
  }, [chart, selectedTool, isDrawing, currentDrawing, drawings, selectedColor, lineWidth, lineStyle, onDrawingChange]);

  // Clear all drawings
  const clearDrawings = useCallback(() => {
    if (drawings.length > 0) {
      setUndoStack(prev => [...prev, drawings]);
      setRedoStack([]);
      setDrawings([]);
      onDrawingChange?.([]);
    }
  }, [drawings, onDrawingChange]);

  // Undo last drawing
  const undoDrawing = useCallback(() => {
    if (undoStack.length > 0) {
      const previousState = undoStack[undoStack.length - 1];
      setRedoStack(prev => [drawings, ...prev]);
      setUndoStack(prev => prev.slice(0, -1));
      setDrawings(previousState);
      onDrawingChange?.(previousState);
    }
  }, [undoStack, drawings, onDrawingChange]);

  // Redo last undone drawing
  const redoDrawing = useCallback(() => {
    if (redoStack.length > 0) {
      const nextState = redoStack[0];
      setUndoStack(prev => [...prev, drawings]);
      setRedoStack(prev => prev.slice(1));
      setDrawings(nextState);
      onDrawingChange?.(nextState);
    }
  }, [redoStack, drawings, onDrawingChange]);

  // Save drawings to localStorage
  const saveDrawings = useCallback(() => {
    try {
      localStorage.setItem('chart-drawings', JSON.stringify(drawings));
      // Show save confirmation (could be a toast notification)
      console.log('Drawings saved successfully');
    } catch (error) {
      console.error('Failed to save drawings:', error);
    }
  }, [drawings]);

  // Load drawings from localStorage
  const loadDrawings = useCallback(() => {
    try {
      const saved = localStorage.getItem('chart-drawings');
      if (saved) {
        const loadedDrawings = JSON.parse(saved);
        setDrawings(loadedDrawings);
        onDrawingChange?.(loadedDrawings);
      }
    } catch (error) {
      console.error('Failed to load drawings:', error);
    }
  }, [onDrawingChange]);

  // Setup chart event listeners
  useEffect(() => {
    if (!chart) return;

    const subscription = chart.subscribeClick(handleChartClick);

    return () => {
      subscription.unsubscribe();
    };
  }, [chart, handleChartClick]);

  // Mobile toolbar
  if (isMobile) {
    return (
      <div className={`drawing-tools-mobile ${className}`}>
        <div className="flex items-center space-x-2 bg-white dark:bg-gray-800 rounded-lg p-2 shadow-lg">
          {/* Tool selector dropdown */}
          <select
            value={selectedTool}
            onChange={(e) => handleToolSelect(e.target.value)}
            className="text-sm bg-transparent border-none focus:outline-none"
          >
            {drawingTools.map(tool => (
              <option key={tool.id} value={tool.id}>
                {tool.name}
              </option>
            ))}
          </select>

          {/* Color picker */}
          <button
            onClick={() => setShowColorPicker(!showColorPicker)}
            className="w-6 h-6 rounded border-2 border-gray-300"
            style={{ backgroundColor: selectedColor }}
          />

          {/* Action buttons */}
          <button
            onClick={undoDrawing}
            disabled={undoStack.length === 0}
            className="p-1 text-gray-500 disabled:opacity-50"
          >
            <Undo className="w-4 h-4" />
          </button>

          <button
            onClick={clearDrawings}
            disabled={drawings.length === 0}
            className="p-1 text-red-500 disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        {/* Color picker popup */}
        {showColorPicker && (
          <div className="absolute top-full left-0 mt-1 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-2 z-50">
            <div className="grid grid-cols-5 gap-1">
              {colors.map(color => (
                <button
                  key={color}
                  onClick={() => {
                    setSelectedColor(color);
                    setShowColorPicker(false);
                  }}
                  className="w-8 h-8 rounded border-2 border-gray-300"
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Desktop toolbar
  return (
    <div className={`drawing-tools ${className}`}>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
        {/* Tool selection */}
        <div className="flex items-center border-b border-gray-200 dark:border-gray-700 p-2">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400 mr-2">
            Tools:
          </span>
          <div className="flex items-center space-x-1">
            {drawingTools.map(tool => {
              const IconComponent = tool.icon;
              return (
                <button
                  key={tool.id}
                  onClick={() => handleToolSelect(tool.id)}
                  className={`p-2 rounded transition-colors ${
                    selectedTool === tool.id
                      ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400'
                      : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                  title={tool.name}
                >
                  <IconComponent className="w-4 h-4" />
                </button>
              );
            })}
          </div>
        </div>

        {/* Style options */}
        <div className="flex items-center justify-between p-2">
          <div className="flex items-center space-x-2">
            {/* Color picker */}
            <div className="relative">
              <button
                onClick={() => setShowColorPicker(!showColorPicker)}
                className="flex items-center space-x-1 p-1"
                title="Color"
              >
                <Palette className="w-4 h-4 text-gray-500" />
                <div
                  className="w-4 h-4 rounded border"
                  style={{ backgroundColor: selectedColor }}
                />
              </button>

              {showColorPicker && (
                <>
                  <div 
                    className="fixed inset-0 z-40"
                    onClick={() => setShowColorPicker(false)}
                  />
                  <div className="absolute top-full left-0 mt-1 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-3 z-50">
                    <div className="grid grid-cols-5 gap-2">
                      {colors.map(color => (
                        <button
                          key={color}
                          onClick={() => {
                            setSelectedColor(color);
                            setShowColorPicker(false);
                          }}
                          className={`w-6 h-6 rounded border-2 transition-all ${
                            selectedColor === color
                              ? 'border-gray-900 dark:border-white scale-110'
                              : 'border-gray-300 hover:scale-105'
                          }`}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Line width */}
            <div className="flex items-center space-x-1">
              <span className="text-xs text-gray-500">Width:</span>
              <select
                value={lineWidth}
                onChange={(e) => setLineWidth(Number(e.target.value))}
                className="text-xs bg-transparent border border-gray-300 dark:border-gray-600 rounded px-1"
              >
                <option value={1}>1px</option>
                <option value={2}>2px</option>
                <option value={3}>3px</option>
                <option value={4}>4px</option>
              </select>
            </div>

            {/* Line style */}
            <div className="flex items-center space-x-1">
              <span className="text-xs text-gray-500">Style:</span>
              <select
                value={lineStyle}
                onChange={(e) => setLineStyle(e.target.value as any)}
                className="text-xs bg-transparent border border-gray-300 dark:border-gray-600 rounded px-1"
              >
                <option value="solid">Solid</option>
                <option value="dashed">Dashed</option>
                <option value="dotted">Dotted</option>
              </select>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center space-x-1">
            <button
              onClick={undoDrawing}
              disabled={undoStack.length === 0}
              className="p-1 text-gray-500 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Undo"
            >
              <Undo className="w-4 h-4" />
            </button>

            <button
              onClick={redoDrawing}
              disabled={redoStack.length === 0}
              className="p-1 text-gray-500 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Redo"
            >
              <Redo className="w-4 h-4" />
            </button>

            <button
              onClick={saveDrawings}
              className="p-1 text-gray-500 hover:text-gray-700"
              title="Save drawings"
            >
              <Save className="w-4 h-4" />
            </button>

            <button
              onClick={clearDrawings}
              disabled={drawings.length === 0}
              className="p-1 text-red-500 hover:text-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Clear all drawings"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Drawing status */}
        {isDrawing && (
          <div className="px-2 py-1 text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 border-t border-gray-200 dark:border-gray-700">
            {selectedTool === 'text' ? 'Click to place text' : 'Click to complete drawing'}
          </div>
        )}

        {/* Drawings count */}
        {drawings.length > 0 && (
          <div className="px-2 py-1 text-xs text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700">
            {drawings.length} drawing{drawings.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>
    </div>
  );
};

export default DrawingTools;