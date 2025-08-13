# CP-045: Chart Annotation and Drawing Tools

## Overview
Implement comprehensive chart annotation tools that allow users to draw technical analysis patterns, add notes, create alerts from drawings, and save/share annotated charts for advanced market analysis.

## Objectives
- Build drawing tools for technical analysis (trend lines, channels, patterns)
- Implement text annotations and notes system
- Create shape tools (rectangles, ellipses, arrows)
- Add fibonacci retracement and extension tools

## Acceptance Criteria
- [ ] Line drawing tools (trend lines, horizontal/vertical lines)
- [ ] Geometric shapes (rectangles, ellipses, triangles)
- [ ] Fibonacci retracement and extension tools
- [ ] Text annotations with customizable styling
- [ ] Pattern recognition tools (head & shoulders, triangles)
- [ ] Measurement tools (distance, angle, price range)
- [ ] Alert creation from drawings
- [ ] Save and load annotated charts
- [ ] Share annotations with other users
- [ ] Layer management for annotations

## Technical Implementation

### File Structure
```
src/
  components/
    ChartAnnotations/
      AnnotationToolbar.jsx
      DrawingCanvas.jsx
      AnnotationLayer.jsx
      FibonacciTool.jsx
      PatternTool.jsx
      TextAnnotation.jsx
      ShapeTools.jsx
      MeasurementTool.jsx
  hooks/
    useDrawingTools.js
    useAnnotations.js
    useFibonacci.js
  services/
    AnnotationService.js
    PatternRecognitionService.js
  utils/
    drawingUtils.js
    geometryUtils.js
    patternUtils.js
```

### Drawing Canvas Component
```jsx
// DrawingCanvas.jsx
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useDrawingTools } from '../hooks/useDrawingTools';
import { useAnnotations } from '../hooks/useAnnotations';
import AnnotationLayer from './AnnotationLayer';
import AnnotationToolbar from './AnnotationToolbar';

const DrawingCanvas = ({ 
  chartRef, 
  chartData, 
  width, 
  height,
  priceScale,
  timeScale,
  onAnnotationCreate,
  onAnnotationUpdate,
  onAnnotationDelete
}) => {
  const canvasRef = useRef(null);
  const overlayRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState(null);
  const [currentPoint, setCurrentPoint] = useState(null);

  const {
    activeTool,
    toolSettings,
    setActiveTool,
    updateToolSettings,
    tools
  } = useDrawingTools();

  const {
    annotations,
    selectedAnnotation,
    addAnnotation,
    updateAnnotation,
    deleteAnnotation,
    selectAnnotation,
    clearSelection
  } = useAnnotations();

  const [drawingPreview, setDrawingPreview] = useState(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const overlay = overlayRef.current;
    
    if (!canvas || !overlay) return;

    canvas.width = width;
    canvas.height = height;
    overlay.width = width;
    overlay.height = height;

    redrawAnnotations();
  }, [width, height, annotations]);

  const getChartCoordinates = useCallback((clientX, clientY) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    // Convert pixel coordinates to chart data coordinates
    const time = timeScale.invert(x);
    const price = priceScale.invert(y);

    return { x, y, time, price };
  }, [timeScale, priceScale]);

  const getPixelCoordinates = useCallback((time, price) => {
    const x = timeScale(time);
    const y = priceScale(price);
    return { x, y };
  }, [timeScale, priceScale]);

  const handleMouseDown = useCallback((event) => {
    if (!activeTool || activeTool === 'select') return;

    const coords = getChartCoordinates(event.clientX, event.clientY);
    if (!coords) return;

    setIsDrawing(true);
    setStartPoint(coords);
    setCurrentPoint(coords);

    // Handle single-click tools
    if (activeTool === 'text') {
      handleTextAnnotation(coords);
    } else if (activeTool === 'note') {
      handleNoteAnnotation(coords);
    }
  }, [activeTool, getChartCoordinates]);

  const handleMouseMove = useCallback((event) => {
    const coords = getChartCoordinates(event.clientX, event.clientY);
    if (!coords) return;

    if (isDrawing && startPoint) {
      setCurrentPoint(coords);
      updateDrawingPreview(startPoint, coords);
    }

    // Handle hover effects for existing annotations
    const hoveredAnnotation = findAnnotationAtPoint(coords);
    if (hoveredAnnotation !== selectedAnnotation) {
      // Update cursor or highlight
    }
  }, [isDrawing, startPoint, getChartCoordinates, selectedAnnotation]);

  const handleMouseUp = useCallback((event) => {
    if (!isDrawing || !startPoint || !currentPoint) {
      setIsDrawing(false);
      return;
    }

    const coords = getChartCoordinates(event.clientX, event.clientY);
    if (!coords) return;

    // Create annotation based on active tool
    const annotation = createAnnotationFromTool(activeTool, startPoint, coords);
    if (annotation) {
      addAnnotation(annotation);
      onAnnotationCreate?.(annotation);
    }

    setIsDrawing(false);
    setStartPoint(null);
    setCurrentPoint(null);
    setDrawingPreview(null);
  }, [isDrawing, startPoint, currentPoint, activeTool, getChartCoordinates, addAnnotation, onAnnotationCreate]);

  const createAnnotationFromTool = useCallback((tool, start, end) => {
    const baseAnnotation = {
      id: `annotation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: tool,
      createdAt: new Date().toISOString(),
      style: { ...toolSettings }
    };

    switch (tool) {
      case 'line':
      case 'trend':
        return {
          ...baseAnnotation,
          points: [
            { time: start.time, price: start.price },
            { time: end.time, price: end.price }
          ]
        };

      case 'horizontal':
        return {
          ...baseAnnotation,
          points: [
            { time: start.time, price: start.price },
            { time: end.time, price: start.price }
          ]
        };

      case 'vertical':
        return {
          ...baseAnnotation,
          points: [
            { time: start.time, price: start.price },
            { time: start.time, price: end.price }
          ]
        };

      case 'rectangle':
        return {
          ...baseAnnotation,
          points: [
            { time: start.time, price: start.price },
            { time: end.time, price: end.price }
          ],
          shape: 'rectangle'
        };

      case 'ellipse':
        return {
          ...baseAnnotation,
          points: [
            { time: start.time, price: start.price },
            { time: end.time, price: end.price }
          ],
          shape: 'ellipse'
        };

      case 'fibonacci':
        return {
          ...baseAnnotation,
          points: [
            { time: start.time, price: start.price },
            { time: end.time, price: end.price }
          ],
          fibLevels: [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1.0]
        };

      case 'arrow':
        return {
          ...baseAnnotation,
          points: [
            { time: start.time, price: start.price },
            { time: end.time, price: end.price }
          ],
          arrowHead: true
        };

      default:
        return null;
    }
  }, [toolSettings]);

  const updateDrawingPreview = useCallback((start, current) => {
    const preview = createAnnotationFromTool(activeTool, start, current);
    setDrawingPreview(preview);
  }, [activeTool, createAnnotationFromTool]);

  const handleTextAnnotation = useCallback((coords) => {
    const text = prompt('Enter annotation text:');
    if (text) {
      const annotation = {
        id: `text_${Date.now()}`,
        type: 'text',
        text,
        position: { time: coords.time, price: coords.price },
        style: { ...toolSettings },
        createdAt: new Date().toISOString()
      };
      addAnnotation(annotation);
      onAnnotationCreate?.(annotation);
    }
    setIsDrawing(false);
  }, [toolSettings, addAnnotation, onAnnotationCreate]);

  const handleNoteAnnotation = useCallback((coords) => {
    const note = prompt('Enter note:');
    if (note) {
      const annotation = {
        id: `note_${Date.now()}`,
        type: 'note',
        text: note,
        position: { time: coords.time, price: coords.price },
        style: { ...toolSettings },
        createdAt: new Date().toISOString()
      };
      addAnnotation(annotation);
      onAnnotationCreate?.(annotation);
    }
    setIsDrawing(false);
  }, [toolSettings, addAnnotation, onAnnotationCreate]);

  const findAnnotationAtPoint = useCallback((coords) => {
    // Find annotation that contains the given point
    return annotations.find(annotation => {
      // Implementation depends on annotation type
      return false; // Simplified
    });
  }, [annotations]);

  const redrawAnnotations = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw all annotations
    annotations.forEach(annotation => {
      drawAnnotation(ctx, annotation);
    });

    // Draw preview if drawing
    if (drawingPreview) {
      ctx.save();
      ctx.globalAlpha = 0.7;
      drawAnnotation(ctx, drawingPreview);
      ctx.restore();
    }
  }, [annotations, drawingPreview]);

  const drawAnnotation = useCallback((ctx, annotation) => {
    ctx.save();

    // Apply style
    ctx.strokeStyle = annotation.style.color || '#007bff';
    ctx.lineWidth = annotation.style.lineWidth || 2;
    ctx.fillStyle = annotation.style.fillColor || 'transparent';

    if (annotation.style.lineStyle === 'dashed') {
      ctx.setLineDash([5, 5]);
    }

    switch (annotation.type) {
      case 'line':
      case 'trend':
      case 'horizontal':
      case 'vertical':
        drawLine(ctx, annotation);
        break;

      case 'rectangle':
        drawRectangle(ctx, annotation);
        break;

      case 'ellipse':
        drawEllipse(ctx, annotation);
        break;

      case 'fibonacci':
        drawFibonacci(ctx, annotation);
        break;

      case 'arrow':
        drawArrow(ctx, annotation);
        break;

      case 'text':
      case 'note':
        drawText(ctx, annotation);
        break;
    }

    ctx.restore();
  }, []);

  const drawLine = useCallback((ctx, annotation) => {
    const points = annotation.points.map(p => getPixelCoordinates(p.time, p.price));
    
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    ctx.lineTo(points[1].x, points[1].y);
    ctx.stroke();
  }, [getPixelCoordinates]);

  const drawRectangle = useCallback((ctx, annotation) => {
    const [start, end] = annotation.points.map(p => getPixelCoordinates(p.time, p.price));
    
    const x = Math.min(start.x, end.x);
    const y = Math.min(start.y, end.y);
    const w = Math.abs(end.x - start.x);
    const h = Math.abs(end.y - start.y);

    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.stroke();
    
    if (annotation.style.fill) {
      ctx.fill();
    }
  }, [getPixelCoordinates]);

  const drawEllipse = useCallback((ctx, annotation) => {
    const [start, end] = annotation.points.map(p => getPixelCoordinates(p.time, p.price));
    
    const centerX = (start.x + end.x) / 2;
    const centerY = (start.y + end.y) / 2;
    const radiusX = Math.abs(end.x - start.x) / 2;
    const radiusY = Math.abs(end.y - start.y) / 2;

    ctx.beginPath();
    ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, 2 * Math.PI);
    ctx.stroke();
    
    if (annotation.style.fill) {
      ctx.fill();
    }
  }, [getPixelCoordinates]);

  const drawFibonacci = useCallback((ctx, annotation) => {
    const [start, end] = annotation.points.map(p => getPixelCoordinates(p.time, p.price));
    const priceRange = annotation.points[1].price - annotation.points[0].price;

    // Draw main line
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();

    // Draw fibonacci levels
    annotation.fibLevels.forEach(level => {
      const price = annotation.points[0].price + (priceRange * level);
      const y = priceScale(price);
      
      ctx.save();
      ctx.setLineDash([2, 2]);
      ctx.globalAlpha = 0.7;
      
      ctx.beginPath();
      ctx.moveTo(start.x, y);
      ctx.lineTo(end.x, y);
      ctx.stroke();
      
      // Add level label
      ctx.fillStyle = annotation.style.color;
      ctx.font = '12px Arial';
      ctx.fillText(`${(level * 100).toFixed(1)}%`, end.x + 5, y + 4);
      
      ctx.restore();
    });
  }, [getPixelCoordinates, priceScale]);

  const drawArrow = useCallback((ctx, annotation) => {
    const [start, end] = annotation.points.map(p => getPixelCoordinates(p.time, p.price));
    
    // Draw line
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();

    // Draw arrow head
    const angle = Math.atan2(end.y - start.y, end.x - start.x);
    const headLength = 10;
    
    ctx.beginPath();
    ctx.moveTo(end.x, end.y);
    ctx.lineTo(
      end.x - headLength * Math.cos(angle - Math.PI / 6),
      end.y - headLength * Math.sin(angle - Math.PI / 6)
    );
    ctx.moveTo(end.x, end.y);
    ctx.lineTo(
      end.x - headLength * Math.cos(angle + Math.PI / 6),
      end.y - headLength * Math.sin(angle + Math.PI / 6)
    );
    ctx.stroke();
  }, [getPixelCoordinates]);

  const drawText = useCallback((ctx, annotation) => {
    const pos = getPixelCoordinates(annotation.position.time, annotation.position.price);
    
    ctx.fillStyle = annotation.style.color || '#333';
    ctx.font = `${annotation.style.fontSize || 12}px ${annotation.style.fontFamily || 'Arial'}`;
    
    // Add background if specified
    if (annotation.style.backgroundColor) {
      const metrics = ctx.measureText(annotation.text);
      const padding = 4;
      
      ctx.fillStyle = annotation.style.backgroundColor;
      ctx.fillRect(
        pos.x - padding,
        pos.y - metrics.actualBoundingBoxAscent - padding,
        metrics.width + padding * 2,
        metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent + padding * 2
      );
    }
    
    ctx.fillStyle = annotation.style.color || '#333';
    ctx.fillText(annotation.text, pos.x, pos.y);
  }, [getPixelCoordinates]);

  useEffect(() => {
    redrawAnnotations();
  }, [redrawAnnotations]);

  return (
    <div className="drawing-canvas-container">
      <AnnotationToolbar
        activeTool={activeTool}
        toolSettings={toolSettings}
        tools={tools}
        onToolChange={setActiveTool}
        onSettingsChange={updateToolSettings}
        onClearAll={() => {
          annotations.forEach(a => deleteAnnotation(a.id));
        }}
      />

      <div className="canvas-wrapper" style={{ position: 'relative', width, height }}>
        <canvas
          ref={canvasRef}
          className="annotation-canvas"
          style={{ position: 'absolute', top: 0, left: 0, zIndex: 10 }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={() => {
            setIsDrawing(false);
            setDrawingPreview(null);
          }}
        />
        
        <canvas
          ref={overlayRef}
          className="overlay-canvas"
          style={{ position: 'absolute', top: 0, left: 0, zIndex: 5, pointerEvents: 'none' }}
        />
      </div>

      <AnnotationLayer
        annotations={annotations}
        selectedAnnotation={selectedAnnotation}
        onSelect={selectAnnotation}
        onUpdate={updateAnnotation}
        onDelete={deleteAnnotation}
      />
    </div>
  );
};

export default DrawingCanvas;
```

### Drawing Tools Hook
```javascript
// useDrawingTools.js
import { useState, useCallback } from 'react';

export const useDrawingTools = () => {
  const [activeTool, setActiveTool] = useState('select');
  const [toolSettings, setToolSettings] = useState({
    color: '#007bff',
    lineWidth: 2,
    lineStyle: 'solid',
    fillColor: 'transparent',
    fill: false,
    fontSize: 12,
    fontFamily: 'Arial',
    backgroundColor: 'transparent'
  });

  const tools = [
    { id: 'select', name: 'Select', icon: '👆', description: 'Select and move annotations' },
    { id: 'line', name: 'Line', icon: '📏', description: 'Draw trend lines' },
    { id: 'horizontal', name: 'Horizontal', icon: '➖', description: 'Horizontal support/resistance' },
    { id: 'vertical', name: 'Vertical', icon: '│', description: 'Vertical time lines' },
    { id: 'rectangle', name: 'Rectangle', icon: '▭', description: 'Draw rectangles and channels' },
    { id: 'ellipse', name: 'Ellipse', icon: '⭕', description: 'Draw ellipses and circles' },
    { id: 'arrow', name: 'Arrow', icon: '➡️', description: 'Draw arrows' },
    { id: 'text', name: 'Text', icon: 'T', description: 'Add text annotations' },
    { id: 'note', name: 'Note', icon: '📝', description: 'Add notes' },
    { id: 'fibonacci', name: 'Fibonacci', icon: '🌀', description: 'Fibonacci retracements' },
    { id: 'measure', name: 'Measure', icon: '📐', description: 'Measure distance and angles' }
  ];

  const updateToolSettings = useCallback((settings) => {
    setToolSettings(prev => ({ ...prev, ...settings }));
  }, []);

  const resetToolSettings = useCallback(() => {
    setToolSettings({
      color: '#007bff',
      lineWidth: 2,
      lineStyle: 'solid',
      fillColor: 'transparent',
      fill: false,
      fontSize: 12,
      fontFamily: 'Arial',
      backgroundColor: 'transparent'
    });
  }, []);

  return {
    activeTool,
    toolSettings,
    tools,
    setActiveTool,
    updateToolSettings,
    resetToolSettings
  };
};
```

### Annotations Service
```javascript
// AnnotationService.js
class AnnotationService {
  constructor() {
    this.annotations = new Map();
  }

  async saveAnnotations(chartId, annotations) {
    try {
      const annotationData = {
        chartId,
        annotations,
        savedAt: new Date().toISOString()
      };

      localStorage.setItem(`annotations-${chartId}`, JSON.stringify(annotationData));
      return true;
    } catch (error) {
      console.error('Error saving annotations:', error);
      throw error;
    }
  }

  async loadAnnotations(chartId) {
    try {
      const stored = localStorage.getItem(`annotations-${chartId}`);
      if (stored) {
        const data = JSON.parse(stored);
        return data.annotations;
      }
      return [];
    } catch (error) {
      console.error('Error loading annotations:', error);
      return [];
    }
  }

  async shareAnnotations(chartId, annotations, shareSettings = {}) {
    try {
      const shareId = this.generateShareId();
      const sharedData = {
        chartId,
        annotations,
        shareSettings,
        sharedAt: new Date().toISOString(),
        shareId
      };

      localStorage.setItem(`shared-annotations-${shareId}`, JSON.stringify(sharedData));
      
      return {
        shareId,
        shareUrl: `${window.location.origin}/shared-chart/${shareId}`
      };
    } catch (error) {
      console.error('Error sharing annotations:', error);
      throw error;
    }
  }

  async getSharedAnnotations(shareId) {
    try {
      const stored = localStorage.getItem(`shared-annotations-${shareId}`);
      if (stored) {
        return JSON.parse(stored);
      }
      throw new Error('Shared annotations not found');
    } catch (error) {
      console.error('Error getting shared annotations:', error);
      throw error;
    }
  }

  async exportAnnotations(chartId, format = 'json') {
    try {
      const annotations = await this.loadAnnotations(chartId);
      
      switch (format) {
        case 'json':
          return this.exportAsJSON(annotations);
        case 'csv':
          return this.exportAsCSV(annotations);
        default:
          throw new Error('Unsupported export format');
      }
    } catch (error) {
      console.error('Error exporting annotations:', error);
      throw error;
    }
  }

  exportAsJSON(annotations) {
    const data = {
      version: '1.0',
      exportDate: new Date().toISOString(),
      annotations
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json'
    });
    
    return URL.createObjectURL(blob);
  }

  exportAsCSV(annotations) {
    const headers = ['ID', 'Type', 'Text', 'Start Time', 'Start Price', 'End Time', 'End Price', 'Created At'];
    const rows = annotations.map(annotation => [
      annotation.id,
      annotation.type,
      annotation.text || '',
      annotation.points?.[0]?.time || annotation.position?.time || '',
      annotation.points?.[0]?.price || annotation.position?.price || '',
      annotation.points?.[1]?.time || '',
      annotation.points?.[1]?.price || '',
      annotation.createdAt
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    return URL.createObjectURL(blob);
  }

  async importAnnotations(file) {
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      
      if (data.annotations && Array.isArray(data.annotations)) {
        return data.annotations;
      }
      
      throw new Error('Invalid annotation file format');
    } catch (error) {
      console.error('Error importing annotations:', error);
      throw error;
    }
  }

  generateShareId() {
    return `share_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  createAlertFromAnnotation(annotation, alertSettings) {
    // Convert annotation to price alert
    if (annotation.type === 'horizontal' && annotation.points) {
      return {
        type: 'price',
        symbol: alertSettings.symbol,
        price: annotation.points[0].price,
        condition: alertSettings.condition || 'crosses',
        message: `Price alert from annotation: ${annotation.text || 'Horizontal line'}`,
        createdFrom: 'annotation',
        annotationId: annotation.id
      };
    }
    
    return null;
  }
}

export const annotationService = new AnnotationService();
```

## Testing Requirements
- Drawing tool accuracy and precision testing
- Annotation persistence and loading testing
- Cross-browser canvas compatibility testing
- Performance testing with many annotations
- Touch device interaction testing

## Dependencies
- Depends on: CP-036 (Advanced Price Charts)
- Depends on: CP-044 (Custom Chart Layouts)
- Blocks: File import/export features

## Time Estimate
**Beginner**: 10-12 days
**Intermediate**: 6-8 days
**Advanced**: 4-6 days

## Required Skills
- HTML5 Canvas API
- Geometric calculations and algorithms
- Mouse/touch event handling
- Drawing and graphics programming
- Technical analysis pattern knowledge