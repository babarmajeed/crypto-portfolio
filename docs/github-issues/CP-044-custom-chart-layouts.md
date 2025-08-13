# CP-044: Custom Chart Layouts and Multi-Panel Views

## Overview
Create a flexible charting system that allows users to build custom layouts with multiple chart panels, arrange different chart types, and save personalized workspace configurations for advanced technical analysis.

## Objectives
- Build drag-and-drop chart layout designer
- Implement multi-panel chart views with synchronization
- Create chart workspace presets and customization
- Add layout persistence and sharing capabilities

## Acceptance Criteria
- [ ] Drag-and-drop chart panel arrangement
- [ ] Multi-panel views (2x2, 3x1, custom grids)
- [ ] Chart synchronization across panels (time, zoom, crosshair)
- [ ] Different chart types per panel (price, volume, indicators)
- [ ] Workspace presets (Day Trading, Swing Trading, Analysis)
- [ ] Save and load custom layouts
- [ ] Share layouts with other users
- [ ] Panel resizing and maximization
- [ ] Mobile-responsive layout adaptation
- [ ] Layout templates marketplace

## Technical Implementation

### File Structure
```
src/
  components/
    ChartLayouts/
      ChartLayoutDesigner.jsx
      MultiPanelChart.jsx
      ChartPanel.jsx
      LayoutPresets.jsx
      PanelControls.jsx
      LayoutSidebar.jsx
      WorkspaceManager.jsx
  hooks/
    useChartLayout.js
    usePanelSync.js
    useLayoutPresets.js
  services/
    ChartLayoutService.js
    LayoutSharingService.js
  utils/
    layoutUtils.js
    panelSync.js
```

### Chart Layout Designer Component
```jsx
// ChartLayoutDesigner.jsx
import React, { useState, useRef, useCallback } from 'react';
import { DndContext, DragOverlay, useSensor, useSensors, PointerSensor } from '@dnd-kit/core';
import { arrayMove, SortableContext, rectSortingStrategy } from '@dnd-kit/sortable';
import { useChartLayout } from '../hooks/useChartLayout';
import { usePanelSync } from '../hooks/usePanelSync';
import ChartPanel from './ChartPanel';
import LayoutSidebar from './LayoutSidebar';
import WorkspaceManager from './WorkspaceManager';

const ChartLayoutDesigner = ({ symbols = ['BTC', 'ETH'], initialLayout }) => {
  const [isDesignMode, setIsDesignMode] = useState(false);
  const [selectedPanel, setSelectedPanel] = useState(null);
  const [activeId, setActiveId] = useState(null);
  
  const {
    layout,
    panels,
    updateLayout,
    addPanel,
    removePanel,
    updatePanel,
    saveLayout,
    loadLayout,
    resetLayout
  } = useChartLayout(initialLayout);

  const {
    syncedTimeRange,
    syncedZoom,
    crosshairPosition,
    updateTimeRange,
    updateZoom,
    updateCrosshair,
    enableSync,
    disableSync,
    isSyncEnabled
  } = usePanelSync();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const handleDragStart = useCallback((event) => {
    setActiveId(event.active.id);
  }, []);

  const handleDragEnd = useCallback((event) => {
    const { active, over } = event;

    if (active.id !== over?.id) {
      const oldIndex = panels.findIndex(panel => panel.id === active.id);
      const newIndex = panels.findIndex(panel => panel.id === over.id);

      const newPanels = arrayMove(panels, oldIndex, newIndex);
      updateLayout({ ...layout, panels: newPanels });
    }

    setActiveId(null);
  }, [panels, layout, updateLayout]);

  const handlePanelUpdate = (panelId, updates) => {
    updatePanel(panelId, updates);
  };

  const handleAddPanel = () => {
    const newPanel = {
      id: `panel-${Date.now()}`,
      type: 'price',
      symbol: symbols[0],
      indicators: [],
      timeframe: '1h',
      position: { x: 0, y: 0, width: 6, height: 4 }
    };
    addPanel(newPanel);
  };

  const handleLayoutPreset = (presetName) => {
    switch (presetName) {
      case 'single':
        resetLayout({
          name: 'Single Chart',
          grid: { columns: 12, rows: 8 },
          panels: [{
            id: 'main',
            type: 'price',
            symbol: symbols[0],
            position: { x: 0, y: 0, width: 12, height: 8 }
          }]
        });
        break;
      
      case 'dual':
        resetLayout({
          name: 'Dual Charts',
          grid: { columns: 12, rows: 8 },
          panels: [
            {
              id: 'chart1',
              type: 'price',
              symbol: symbols[0],
              position: { x: 0, y: 0, width: 6, height: 8 }
            },
            {
              id: 'chart2',
              type: 'price',
              symbol: symbols[1] || symbols[0],
              position: { x: 6, y: 0, width: 6, height: 8 }
            }
          ]
        });
        break;
      
      case 'trading':
        resetLayout({
          name: 'Trading Layout',
          grid: { columns: 12, rows: 12 },
          panels: [
            {
              id: 'main-chart',
              type: 'price',
              symbol: symbols[0],
              position: { x: 0, y: 0, width: 8, height: 8 }
            },
            {
              id: 'volume',
              type: 'volume',
              symbol: symbols[0],
              position: { x: 0, y: 8, width: 8, height: 4 }
            },
            {
              id: 'orderbook',
              type: 'orderbook',
              symbol: symbols[0],
              position: { x: 8, y: 0, width: 4, height: 6 }
            },
            {
              id: 'trades',
              type: 'trades',
              symbol: symbols[0],
              position: { x: 8, y: 6, width: 4, height: 6 }
            }
          ]
        });
        break;

      case 'analysis':
        resetLayout({
          name: 'Technical Analysis',
          grid: { columns: 12, rows: 16 },
          panels: [
            {
              id: 'price-chart',
              type: 'price',
              symbol: symbols[0],
              indicators: ['sma20', 'sma50', 'bollinger'],
              position: { x: 0, y: 0, width: 12, height: 8 }
            },
            {
              id: 'rsi',
              type: 'indicator',
              symbol: symbols[0],
              indicator: 'rsi',
              position: { x: 0, y: 8, width: 6, height: 4 }
            },
            {
              id: 'macd',
              type: 'indicator',
              symbol: symbols[0],
              indicator: 'macd',
              position: { x: 6, y: 8, width: 6, height: 4 }
            },
            {
              id: 'volume-analysis',
              type: 'volume',
              symbol: symbols[0],
              position: { x: 0, y: 12, width: 12, height: 4 }
            }
          ]
        });
        break;
    }
  };

  const renderGridOverlay = () => {
    if (!isDesignMode) return null;

    const { columns, rows } = layout.grid;
    const gridItems = [];

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < columns; col++) {
        gridItems.push(
          <div
            key={`${col}-${row}`}
            className="grid-cell"
            style={{
              gridColumn: col + 1,
              gridRow: row + 1
            }}
          />
        );
      }
    }

    return (
      <div 
        className="grid-overlay"
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${columns}, 1fr)`,
          gridTemplateRows: `repeat(${rows}, 1fr)`,
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          pointerEvents: 'none',
          zIndex: 1000
        }}
      >
        {gridItems}
      </div>
    );
  };

  return (
    <div className="chart-layout-designer">
      <div className="layout-header">
        <div className="layout-title">
          <h2>{layout.name || 'Custom Layout'}</h2>
          <span className="panel-count">{panels.length} panels</span>
        </div>

        <div className="layout-controls">
          <button
            onClick={() => setIsDesignMode(!isDesignMode)}
            className={`design-mode-btn ${isDesignMode ? 'active' : ''}`}
          >
            {isDesignMode ? 'Exit Design' : 'Design Mode'}
          </button>

          <div className="sync-controls">
            <label>
              <input
                type="checkbox"
                checked={isSyncEnabled}
                onChange={(e) => e.target.checked ? enableSync() : disableSync()}
              />
              Sync Panels
            </label>
          </div>

          <WorkspaceManager
            currentLayout={layout}
            onSave={saveLayout}
            onLoad={loadLayout}
            onPreset={handleLayoutPreset}
          />
        </div>
      </div>

      <div className="layout-content">
        {isDesignMode && (
          <LayoutSidebar
            onAddPanel={handleAddPanel}
            onLayoutPreset={handleLayoutPreset}
            selectedPanel={selectedPanel}
            onPanelSelect={setSelectedPanel}
          />
        )}

        <div className="chart-container">
          <DndContext
            sensors={sensors}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <div 
              className="chart-grid"
              style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${layout.grid.columns}, 1fr)`,
                gridTemplateRows: `repeat(${layout.grid.rows}, 1fr)`,
                gap: '4px',
                height: '100%',
                position: 'relative'
              }}
            >
              {renderGridOverlay()}
              
              <SortableContext items={panels.map(p => p.id)} strategy={rectSortingStrategy}>
                {panels.map(panel => (
                  <ChartPanel
                    key={panel.id}
                    panel={panel}
                    isDesignMode={isDesignMode}
                    isSelected={selectedPanel === panel.id}
                    syncedTimeRange={isSyncEnabled ? syncedTimeRange : null}
                    syncedZoom={isSyncEnabled ? syncedZoom : null}
                    crosshairPosition={isSyncEnabled ? crosshairPosition : null}
                    onUpdate={(updates) => handlePanelUpdate(panel.id, updates)}
                    onSelect={() => setSelectedPanel(panel.id)}
                    onRemove={() => removePanel(panel.id)}
                    onTimeRangeChange={updateTimeRange}
                    onZoomChange={updateZoom}
                    onCrosshairMove={updateCrosshair}
                  />
                ))}
              </SortableContext>
            </div>

            <DragOverlay>
              {activeId ? (
                <div className="drag-overlay">
                  {panels.find(p => p.id === activeId)?.type} Panel
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        </div>
      </div>
    </div>
  );
};

export default ChartLayoutDesigner;
```

### Chart Panel Component
```jsx
// ChartPanel.jsx
import React, { useState, useRef, useEffect } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import AdvancedChart from '../Charts/AdvancedChart';
import VolumeChart from '../Charts/VolumeChart';
import OrderBookVisualization from '../VolumeAnalysis/OrderBookVisualization';
import PanelControls from './PanelControls';

const ChartPanel = ({
  panel,
  isDesignMode,
  isSelected,
  syncedTimeRange,
  syncedZoom,
  crosshairPosition,
  onUpdate,
  onSelect,
  onRemove,
  onTimeRangeChange,
  onZoomChange,
  onCrosshairMove
}) => {
  const [showControls, setShowControls] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const panelRef = useRef(null);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({
    id: panel.id,
    disabled: !isDesignMode
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    gridColumn: `${panel.position.x + 1} / ${panel.position.x + panel.position.width + 1}`,
    gridRow: `${panel.position.y + 1} / ${panel.position.y + panel.position.height + 1}`,
    opacity: isDragging ? 0.5 : 1
  };

  useEffect(() => {
    if (isMaximized) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isMaximized]);

  const handlePanelClick = () => {
    if (isDesignMode) {
      onSelect();
    }
  };

  const handleMaximize = () => {
    setIsMaximized(true);
  };

  const handleMinimize = () => {
    setIsMaximized(false);
  };

  const renderPanelContent = () => {
    const commonProps = {
      symbol: panel.symbol,
      timeframe: panel.timeframe || '1h',
      height: isMaximized ? window.innerHeight - 100 : undefined,
      width: isMaximized ? window.innerWidth - 100 : undefined,
      syncedTimeRange,
      syncedZoom,
      crosshairPosition,
      onTimeRangeChange,
      onZoomChange,
      onCrosshairMove
    };

    switch (panel.type) {
      case 'price':
        return (
          <AdvancedChart
            {...commonProps}
            indicators={panel.indicators || []}
            chartType={panel.chartType || 'candlestick'}
          />
        );
      
      case 'volume':
        return (
          <VolumeChart
            {...commonProps}
            volumeIndicators={panel.volumeIndicators || []}
          />
        );
      
      case 'indicator':
        return (
          <AdvancedChart
            {...commonProps}
            focusIndicator={panel.indicator}
            showPriceChart={false}
          />
        );
      
      case 'orderbook':
        return (
          <OrderBookVisualization
            symbol={panel.symbol}
            height={commonProps.height || 300}
          />
        );
      
      case 'trades':
        return (
          <div className="trades-panel">
            {/* Time and Sales component would go here */}
            <p>Recent Trades for {panel.symbol}</p>
          </div>
        );
      
      default:
        return (
          <div className="empty-panel">
            <p>Select a chart type</p>
          </div>
        );
    }
  };

  const panelClass = `
    chart-panel
    ${isDesignMode ? 'design-mode' : ''}
    ${isSelected ? 'selected' : ''}
    ${isDragging ? 'dragging' : ''}
    ${isMaximized ? 'maximized' : ''}
  `.trim();

  if (isMaximized) {
    return (
      <div className="panel-maximized-overlay">
        <div className="maximized-panel">
          <div className="maximized-header">
            <h3>{panel.symbol} - {panel.type}</h3>
            <button onClick={handleMinimize} className="minimize-btn">
              ×
            </button>
          </div>
          <div className="maximized-content">
            {renderPanelContent()}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={panelClass}
      onClick={handlePanelClick}
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => setShowControls(false)}
      {...attributes}
    >
      {isDesignMode && (
        <div className="panel-drag-handle" {...listeners}>
          ⋮⋮
        </div>
      )}

      <div className="panel-header">
        <div className="panel-title">
          <span className="panel-symbol">{panel.symbol}</span>
          <span className="panel-type">{panel.type}</span>
        </div>

        {(showControls || isDesignMode) && (
          <div className="panel-actions">
            <button
              onClick={handleMaximize}
              className="panel-action-btn"
              title="Maximize"
            >
              ⛶
            </button>
            
            {isDesignMode && (
              <>
                <button
                  onClick={() => {/* Open panel settings */}}
                  className="panel-action-btn"
                  title="Settings"
                >
                  ⚙️
                </button>
                
                <button
                  onClick={() => onRemove()}
                  className="panel-action-btn remove"
                  title="Remove"
                >
                  ×
                </button>
              </>
            )}
          </div>
        )}
      </div>

      <div className="panel-content">
        {renderPanelContent()}
      </div>

      {isDesignMode && isSelected && (
        <PanelControls
          panel={panel}
          onUpdate={onUpdate}
        />
      )}
    </div>
  );
};

export default ChartPanel;
```

### Chart Layout Hook
```javascript
// useChartLayout.js
import { useState, useCallback } from 'react';
import { chartLayoutService } from '../services/ChartLayoutService';

export const useChartLayout = (initialLayout) => {
  const [layout, setLayout] = useState(initialLayout || {
    name: 'Default Layout',
    grid: { columns: 12, rows: 8 },
    panels: []
  });

  const [panels, setPanels] = useState(initialLayout?.panels || []);

  const updateLayout = useCallback((newLayout) => {
    setLayout(newLayout);
    setPanels(newLayout.panels);
  }, []);

  const addPanel = useCallback((panel) => {
    const newPanels = [...panels, panel];
    setPanels(newPanels);
    setLayout(prev => ({ ...prev, panels: newPanels }));
  }, [panels]);

  const removePanel = useCallback((panelId) => {
    const newPanels = panels.filter(p => p.id !== panelId);
    setPanels(newPanels);
    setLayout(prev => ({ ...prev, panels: newPanels }));
  }, [panels]);

  const updatePanel = useCallback((panelId, updates) => {
    const newPanels = panels.map(panel =>
      panel.id === panelId ? { ...panel, ...updates } : panel
    );
    setPanels(newPanels);
    setLayout(prev => ({ ...prev, panels: newPanels }));
  }, [panels]);

  const saveLayout = useCallback(async (name) => {
    try {
      const layoutToSave = { ...layout, name };
      await chartLayoutService.saveLayout(layoutToSave);
      setLayout(layoutToSave);
      return true;
    } catch (error) {
      console.error('Failed to save layout:', error);
      return false;
    }
  }, [layout]);

  const loadLayout = useCallback(async (layoutId) => {
    try {
      const loadedLayout = await chartLayoutService.loadLayout(layoutId);
      updateLayout(loadedLayout);
      return true;
    } catch (error) {
      console.error('Failed to load layout:', error);
      return false;
    }
  }, [updateLayout]);

  const resetLayout = useCallback((newLayout) => {
    updateLayout(newLayout);
  }, [updateLayout]);

  return {
    layout,
    panels,
    updateLayout,
    addPanel,
    removePanel,
    updatePanel,
    saveLayout,
    loadLayout,
    resetLayout
  };
};
```

### Panel Synchronization Hook
```javascript
// usePanelSync.js
import { useState, useCallback } from 'react';

export const usePanelSync = () => {
  const [isSyncEnabled, setIsSyncEnabled] = useState(false);
  const [syncedTimeRange, setSyncedTimeRange] = useState(null);
  const [syncedZoom, setSyncedZoom] = useState(null);
  const [crosshairPosition, setCrosshairPosition] = useState(null);

  const enableSync = useCallback(() => {
    setIsSyncEnabled(true);
  }, []);

  const disableSync = useCallback(() => {
    setIsSyncEnabled(false);
    setSyncedTimeRange(null);
    setSyncedZoom(null);
    setCrosshairPosition(null);
  }, []);

  const updateTimeRange = useCallback((timeRange) => {
    if (isSyncEnabled) {
      setSyncedTimeRange(timeRange);
    }
  }, [isSyncEnabled]);

  const updateZoom = useCallback((zoom) => {
    if (isSyncEnabled) {
      setSyncedZoom(zoom);
    }
  }, [isSyncEnabled]);

  const updateCrosshair = useCallback((position) => {
    if (isSyncEnabled) {
      setCrosshairPosition(position);
    }
  }, [isSyncEnabled]);

  return {
    isSyncEnabled,
    syncedTimeRange,
    syncedZoom,
    crosshairPosition,
    enableSync,
    disableSync,
    updateTimeRange,
    updateZoom,
    updateCrosshair
  };
};
```

### Chart Layout Service
```javascript
// ChartLayoutService.js
class ChartLayoutService {
  constructor() {
    this.layouts = new Map();
    this.presets = this.getDefaultPresets();
  }

  async saveLayout(layout) {
    try {
      const layoutId = layout.id || this.generateLayoutId();
      const layoutToSave = {
        ...layout,
        id: layoutId,
        createdAt: layout.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // Save to localStorage for now
      localStorage.setItem(`chart-layout-${layoutId}`, JSON.stringify(layoutToSave));
      
      // Also keep in memory
      this.layouts.set(layoutId, layoutToSave);

      return layoutId;
    } catch (error) {
      console.error('Error saving layout:', error);
      throw error;
    }
  }

  async loadLayout(layoutId) {
    try {
      // Try memory first
      if (this.layouts.has(layoutId)) {
        return this.layouts.get(layoutId);
      }

      // Try localStorage
      const stored = localStorage.getItem(`chart-layout-${layoutId}`);
      if (stored) {
        const layout = JSON.parse(stored);
        this.layouts.set(layoutId, layout);
        return layout;
      }

      throw new Error('Layout not found');
    } catch (error) {
      console.error('Error loading layout:', error);
      throw error;
    }
  }

  async getUserLayouts(userId) {
    try {
      const layouts = [];
      
      // Get from localStorage
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('chart-layout-')) {
          const layout = JSON.parse(localStorage.getItem(key));
          layouts.push({
            id: layout.id,
            name: layout.name,
            createdAt: layout.createdAt,
            updatedAt: layout.updatedAt,
            panelCount: layout.panels?.length || 0
          });
        }
      }

      return layouts.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    } catch (error) {
      console.error('Error getting user layouts:', error);
      return [];
    }
  }

  async deleteLayout(layoutId) {
    try {
      localStorage.removeItem(`chart-layout-${layoutId}`);
      this.layouts.delete(layoutId);
      return true;
    } catch (error) {
      console.error('Error deleting layout:', error);
      throw error;
    }
  }

  async shareLayout(layoutId, shareSettings) {
    try {
      const layout = await this.loadLayout(layoutId);
      const shareId = this.generateShareId();
      
      const sharedLayout = {
        ...layout,
        shareId,
        shareSettings,
        sharedAt: new Date().toISOString()
      };

      localStorage.setItem(`shared-layout-${shareId}`, JSON.stringify(sharedLayout));
      
      return shareId;
    } catch (error) {
      console.error('Error sharing layout:', error);
      throw error;
    }
  }

  async getSharedLayout(shareId) {
    try {
      const stored = localStorage.getItem(`shared-layout-${shareId}`);
      if (stored) {
        return JSON.parse(stored);
      }
      throw new Error('Shared layout not found');
    } catch (error) {
      console.error('Error getting shared layout:', error);
      throw error;
    }
  }

  getDefaultPresets() {
    return [
      {
        id: 'single',
        name: 'Single Chart',
        description: 'One main chart panel',
        icon: '📊'
      },
      {
        id: 'dual',
        name: 'Dual Charts',
        description: 'Two side-by-side charts',
        icon: '📈'
      },
      {
        id: 'trading',
        name: 'Trading Layout',
        description: 'Price, volume, orderbook, and trades',
        icon: '💹'
      },
      {
        id: 'analysis',
        name: 'Technical Analysis',
        description: 'Price chart with multiple indicators',
        icon: '🔍'
      }
    ];
  }

  generateLayoutId() {
    return `layout_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  generateShareId() {
    return `share_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  validateLayout(layout) {
    if (!layout.grid || !layout.panels) {
      return false;
    }

    // Check if panels fit within grid
    return layout.panels.every(panel => {
      const { x, y, width, height } = panel.position;
      return (
        x >= 0 && y >= 0 &&
        x + width <= layout.grid.columns &&
        y + height <= layout.grid.rows
      );
    });
  }
}

export const chartLayoutService = new ChartLayoutService();
```

## Testing Requirements
- Drag-and-drop functionality testing
- Panel synchronization accuracy testing
- Layout persistence and loading testing
- Multi-panel performance testing
- Mobile responsiveness validation

## Dependencies
- Depends on: CP-036 (Advanced Price Charts)
- Depends on: CP-039 (Volume Analysis Tools)
- Blocks: CP-045 (Chart Annotation Tools)

## Time Estimate
**Beginner**: 10-12 days
**Intermediate**: 6-8 days
**Advanced**: 4-6 days

## Required Skills
- Drag-and-drop libraries (DnD Kit)
- Complex layout management
- State synchronization patterns
- Grid-based positioning systems
- Local storage and data persistence