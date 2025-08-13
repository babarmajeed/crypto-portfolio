# CP-034: Mobile-First Responsive Design Implementation

## Overview
Implement comprehensive mobile-first responsive design across the entire application, ensuring optimal user experience on smartphones, tablets, and desktop devices with touch-friendly interfaces and adaptive layouts.

## Objectives
- Design mobile-first responsive layouts for all components
- Implement touch-friendly navigation and interactions
- Optimize performance for mobile devices
- Create progressive web app (PWA) capabilities

## Acceptance Criteria
- [ ] Mobile-first responsive design for all pages and components
- [ ] Touch-friendly navigation with swipe gestures
- [ ] Optimized layouts for portrait and landscape orientations
- [ ] Collapsible navigation and mobile menu
- [ ] Touch-optimized charts and interactive elements
- [ ] Progressive Web App (PWA) implementation
- [ ] Offline functionality for core features
- [ ] Performance optimization for slower networks
- [ ] Accessibility compliance for mobile users
- [ ] Cross-browser compatibility testing

## Technical Implementation

### File Structure
```
src/
  styles/
    responsive/
      breakpoints.scss
      mobile.scss
      tablet.scss
      desktop.scss
    components/
      mobile-navigation.scss
      responsive-charts.scss
      touch-interactions.scss
  components/
    Mobile/
      MobileNavigation.jsx
      MobileHeader.jsx
      MobileDashboard.jsx
      SwipeableViews.jsx
      TouchOptimizedChart.jsx
  hooks/
    useResponsive.js
    useTouch.js
    useSwipe.js
  utils/
    responsive.utils.js
```

### Responsive Design System
```scss
// breakpoints.scss
$breakpoints: (
  'xs': 320px,   // Small phones
  'sm': 576px,   // Large phones
  'md': 768px,   // Tablets
  'lg': 992px,   // Small laptops
  'xl': 1200px,  // Large laptops
  'xxl': 1400px  // Desktops
);

@mixin respond-to($breakpoint) {
  @if map-has-key($breakpoints, $breakpoint) {
    @media (min-width: #{map-get($breakpoints, $breakpoint)}) {
      @content;
    }
  } @else {
    @warn "Unknown breakpoint: #{$breakpoint}";
  }
}

@mixin respond-between($min, $max) {
  @media (min-width: #{map-get($breakpoints, $min)}) and (max-width: #{map-get($breakpoints, $max) - 1px}) {
    @content;
  }
}

// Mobile-first base styles
.container {
  width: 100%;
  padding: 0 1rem;
  margin: 0 auto;

  @include respond-to('sm') {
    padding: 0 1.5rem;
  }

  @include respond-to('md') {
    padding: 0 2rem;
  }

  @include respond-to('lg') {
    max-width: 1200px;
    padding: 0 2rem;
  }

  @include respond-to('xl') {
    max-width: 1400px;
  }
}

// Touch-friendly sizing
.touch-target {
  min-height: 44px;
  min-width: 44px;
  padding: 12px;

  @include respond-to('md') {
    min-height: 40px;
    min-width: 40px;
    padding: 8px;
  }
}
```

### Mobile Navigation Component
```jsx
// MobileNavigation.jsx
import React, { useState, useEffect } from 'react';
import { useSwipe } from '../hooks/useSwipe';
import { useResponsive } from '../hooks/useResponsive';

const MobileNavigation = ({ isOpen, onClose, navigationItems }) => {
  const [activeItem, setActiveItem] = useState(null);
  const { isMobile, isTablet } = useResponsive();
  const swipeHandlers = useSwipe({
    onSwipedLeft: () => onClose(),
    onSwipedRight: () => {}, // Could open additional menu
    threshold: 100
  });

  useEffect(() => {
    // Prevent body scroll when menu is open on mobile
    if (isOpen && isMobile) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, isMobile]);

  const handleItemClick = (item) => {
    if (item.children) {
      setActiveItem(activeItem === item.id ? null : item.id);
    } else {
      // Navigate to item
      onClose();
    }
  };

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div 
          className="mobile-nav-backdrop"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Navigation Menu */}
      <nav 
        className={`mobile-navigation ${isOpen ? 'open' : ''}`}
        {...swipeHandlers}
        role="navigation"
        aria-label="Main navigation"
      >
        <div className="mobile-nav-header">
          <div className="nav-title">
            <img src="/logo.svg" alt="Crypto Portfolio" className="nav-logo" />
            <h2>Portfolio</h2>
          </div>
          
          <button
            className="close-nav-btn touch-target"
            onClick={onClose}
            aria-label="Close navigation"
          >
            ×
          </button>
        </div>

        <div className="mobile-nav-content">
          <ul className="nav-items">
            {navigationItems.map(item => (
              <li key={item.id} className="nav-item">
                <button
                  className={`nav-link touch-target ${activeItem === item.id ? 'active' : ''}`}
                  onClick={() => handleItemClick(item)}
                  aria-expanded={item.children ? activeItem === item.id : undefined}
                >
                  <span className="nav-icon">{item.icon}</span>
                  <span className="nav-text">{item.label}</span>
                  {item.children && (
                    <span className={`nav-arrow ${activeItem === item.id ? 'rotated' : ''}`}>
                      ›
                    </span>
                  )}
                </button>

                {item.children && activeItem === item.id && (
                  <ul className="nav-subitems">
                    {item.children.map(child => (
                      <li key={child.id} className="nav-subitem">
                        <button
                          className="nav-sublink touch-target"
                          onClick={() => {
                            // Navigate to child item
                            onClose();
                          }}
                        >
                          <span className="nav-subicon">{child.icon}</span>
                          <span className="nav-subtext">{child.label}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>

          {/* User Profile Section */}
          <div className="nav-user-section">
            <div className="user-info">
              <div className="user-avatar">
                <img src="/default-avatar.png" alt="User" />
              </div>
              <div className="user-details">
                <p className="user-name">John Doe</p>
                <p className="user-email">john@example.com</p>
              </div>
            </div>
            
            <button className="logout-btn touch-target">
              <span className="logout-icon">🚪</span>
              <span>Logout</span>
            </button>
          </div>
        </div>
      </nav>
    </>
  );
};

export default MobileNavigation;
```

### Responsive Hook
```javascript
// useResponsive.js
import { useState, useEffect } from 'react';

export const useResponsive = () => {
  const [screenSize, setScreenSize] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 1200,
    height: typeof window !== 'undefined' ? window.innerHeight : 800
  });

  const [orientation, setOrientation] = useState('portrait');

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      
      setScreenSize({ width, height });
      setOrientation(width > height ? 'landscape' : 'portrait');
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);

    // Initial check
    handleResize();

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  const isMobile = screenSize.width < 768;
  const isTablet = screenSize.width >= 768 && screenSize.width < 1024;
  const isDesktop = screenSize.width >= 1024;
  const isSmallMobile = screenSize.width < 576;

  const breakpoint = (() => {
    if (screenSize.width < 576) return 'xs';
    if (screenSize.width < 768) return 'sm';
    if (screenSize.width < 992) return 'md';
    if (screenSize.width < 1200) return 'lg';
    if (screenSize.width < 1400) return 'xl';
    return 'xxl';
  })();

  return {
    screenSize,
    orientation,
    isMobile,
    isTablet,
    isDesktop,
    isSmallMobile,
    breakpoint,
    isPortrait: orientation === 'portrait',
    isLandscape: orientation === 'landscape'
  };
};
```

### Touch-Optimized Chart Component
```jsx
// TouchOptimizedChart.jsx
import React, { useRef, useEffect, useState } from 'react';
import { useTouch } from '../hooks/useTouch';
import { useResponsive } from '../hooks/useResponsive';

const TouchOptimizedChart = ({ data, onDataPointSelect, className }) => {
  const chartRef = useRef(null);
  const [selectedPoint, setSelectedPoint] = useState(null);
  const [isZoomed, setIsZoomed] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const { isMobile, isTablet } = useResponsive();

  const {
    touchStart,
    touchMove,
    touchEnd,
    isPinching,
    pinchScale,
    panOffset
  } = useTouch({
    onPinch: (scale) => {
      setZoomLevel(Math.max(1, Math.min(3, scale)));
    },
    onTap: (point) => {
      const dataPoint = getDataPointFromCoordinates(point);
      if (dataPoint) {
        setSelectedPoint(dataPoint);
        onDataPointSelect?.(dataPoint);
      }
    },
    onDoubleTap: () => {
      setIsZoomed(!isZoomed);
      setZoomLevel(isZoomed ? 1 : 2);
    }
  });

  const getDataPointFromCoordinates = (point) => {
    // Convert touch coordinates to data point
    const rect = chartRef.current?.getBoundingClientRect();
    if (!rect) return null;

    const x = point.x - rect.left;
    const y = point.y - rect.top;

    // Calculate which data point this corresponds to
    const dataIndex = Math.round((x / rect.width) * (data.length - 1));
    return data[dataIndex];
  };

  const chartHeight = isMobile ? 200 : isTablet ? 300 : 400;
  const showTooltip = isMobile || isTablet;

  return (
    <div className={`touch-chart-container ${className}`}>
      <div
        ref={chartRef}
        className="touch-chart"
        style={{
          height: chartHeight,
          transform: `scale(${zoomLevel}) translate(${panOffset.x}px, ${panOffset.y}px)`
        }}
        onTouchStart={touchStart}
        onTouchMove={touchMove}
        onTouchEnd={touchEnd}
        role="img"
        aria-label="Price chart"
      >
        <svg width="100%" height="100%" className="chart-svg">
          {/* Chart rendering logic */}
          <g className="chart-content">
            {/* Render chart lines, bars, etc. */}
            {data.map((point, index) => (
              <circle
                key={index}
                cx={`${(index / (data.length - 1)) * 100}%`}
                cy={`${(1 - (point.value / Math.max(...data.map(d => d.value)))) * 100}%`}
                r={isMobile ? "6" : "4"}
                fill={selectedPoint === point ? "#007bff" : "#ccc"}
                className="chart-point"
              />
            ))}
          </g>

          {/* Touch feedback overlay */}
          {isPinching && (
            <circle
              cx="50%"
              cy="50%"
              r="20"
              fill="rgba(0, 123, 255, 0.2)"
              stroke="#007bff"
              strokeWidth="2"
              className="pinch-indicator"
            />
          )}
        </svg>

        {/* Mobile tooltip */}
        {showTooltip && selectedPoint && (
          <div className="mobile-tooltip">
            <div className="tooltip-content">
              <p className="tooltip-value">${selectedPoint.value}</p>
              <p className="tooltip-date">{selectedPoint.date}</p>
            </div>
          </div>
        )}
      </div>

      {/* Chart controls for mobile */}
      {isMobile && (
        <div className="chart-controls">
          <button
            className="chart-control-btn"
            onClick={() => setZoomLevel(1)}
          >
            Reset Zoom
          </button>
          
          <button
            className="chart-control-btn"
            onClick={() => setSelectedPoint(null)}
          >
            Clear Selection
          </button>
        </div>
      )}
    </div>
  );
};

export default TouchOptimizedChart;
```

### Mobile-Specific Styles
```scss
// mobile.scss
.mobile-navigation {
  position: fixed;
  top: 0;
  left: -100%;
  width: 85%;
  max-width: 320px;
  height: 100vh;
  background: var(--nav-background, #ffffff);
  box-shadow: 2px 0 10px rgba(0, 0, 0, 0.1);
  transition: left 0.3s ease-in-out;
  z-index: 1000;

  &.open {
    left: 0;
  }

  .mobile-nav-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem;
    border-bottom: 1px solid var(--border-color, #e0e0e0);

    .nav-title {
      display: flex;
      align-items: center;
      gap: 0.5rem;

      .nav-logo {
        width: 32px;
        height: 32px;
      }

      h2 {
        margin: 0;
        font-size: 1.25rem;
        font-weight: 600;
      }
    }

    .close-nav-btn {
      background: none;
      border: none;
      font-size: 1.5rem;
      color: var(--text-secondary, #666);
      cursor: pointer;
    }
  }

  .mobile-nav-content {
    height: calc(100vh - 80px);
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
  }

  .nav-items {
    list-style: none;
    padding: 0;
    margin: 0;

    .nav-item {
      border-bottom: 1px solid var(--border-light, #f0f0f0);

      .nav-link {
        display: flex;
        align-items: center;
        width: 100%;
        padding: 1rem;
        background: none;
        border: none;
        text-align: left;
        color: var(--text-primary, #333);
        font-size: 1rem;
        cursor: pointer;
        transition: background-color 0.2s;

        &:hover,
        &:focus {
          background-color: var(--background-hover, #f5f5f5);
        }

        &.active {
          background-color: var(--primary-light, #e3f2fd);
          color: var(--primary-color, #007bff);
        }

        .nav-icon {
          margin-right: 0.75rem;
          font-size: 1.25rem;
        }

        .nav-text {
          flex: 1;
        }

        .nav-arrow {
          margin-left: auto;
          font-size: 1.25rem;
          transition: transform 0.2s;

          &.rotated {
            transform: rotate(90deg);
          }
        }
      }

      .nav-subitems {
        list-style: none;
        padding: 0;
        margin: 0;
        background-color: var(--background-light, #f9f9f9);

        .nav-subitem {
          .nav-sublink {
            display: flex;
            align-items: center;
            width: 100%;
            padding: 0.75rem 1rem 0.75rem 3rem;
            background: none;
            border: none;
            text-align: left;
            color: var(--text-secondary, #666);
            font-size: 0.9rem;
            cursor: pointer;

            &:hover,
            &:focus {
              background-color: var(--background-hover, #f0f0f0);
            }

            .nav-subicon {
              margin-right: 0.5rem;
              font-size: 1rem;
            }
          }
        }
      }
    }
  }
}

.mobile-nav-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.5);
  z-index: 999;
}

// Mobile dashboard optimizations
.dashboard-overview {
  @include respond-to('xs') {
    padding: 0.5rem;

    .dashboard-grid {
      grid-template-columns: 1fr;
      gap: 1rem;
      grid-template-areas:
        "summary"
        "metrics"
        "allocation"
        "activity";
    }

    .portfolio-summary-card,
    .performance-metrics-card,
    .allocation-chart-card,
    .recent-activity-card {
      padding: 1rem;
    }
  }
}

// Touch-friendly components
.touch-chart-container {
  .chart-controls {
    display: flex;
    gap: 0.5rem;
    margin-top: 1rem;
    padding: 0 1rem;

    .chart-control-btn {
      flex: 1;
      padding: 0.75rem;
      background: var(--background-secondary, #f8f9fa);
      border: 1px solid var(--border-color, #dee2e6);
      border-radius: 0.375rem;
      font-size: 0.875rem;
      color: var(--text-primary, #333);
      cursor: pointer;

      &:hover,
      &:focus {
        background: var(--background-hover, #e9ecef);
      }
    }
  }

  .mobile-tooltip {
    position: absolute;
    top: 1rem;
    right: 1rem;
    background: rgba(0, 0, 0, 0.8);
    color: white;
    padding: 0.5rem 0.75rem;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    pointer-events: none;

    .tooltip-content {
      text-align: center;

      .tooltip-value {
        font-weight: 600;
        margin: 0 0 0.25rem 0;
      }

      .tooltip-date {
        margin: 0;
        opacity: 0.8;
        font-size: 0.75rem;
      }
    }
  }
}

// Responsive tables
.transaction-table {
  @include respond-to('xs') {
    .table-container {
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
    }

    .table-header-row,
    .transaction-row {
      min-width: 600px; // Ensure table doesn't become too cramped
    }
  }
}
```

## Testing Requirements
- Cross-device responsive testing (phones, tablets, desktop)
- Touch interaction testing on various devices
- Performance testing on slower mobile networks
- PWA functionality testing
- Offline capability testing

## Dependencies
- Depends on: CP-026 (Dashboard Overview)
- Depends on: CP-028 (Asset Allocation Pie Chart)
- Blocks: CP-035 (Progressive Web App)

## Time Estimate
**Beginner**: 8-10 days
**Intermediate**: 5-7 days
**Advanced**: 3-5 days

## Required Skills
- CSS/SCSS and responsive design principles
- Mobile-first design methodology
- Touch event handling
- Progressive Web App concepts
- Performance optimization techniques