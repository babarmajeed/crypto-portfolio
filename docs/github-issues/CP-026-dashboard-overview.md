# CP-026: Main Dashboard Overview Component

## Overview
Create the main dashboard overview component that provides users with a comprehensive at-a-glance view of their entire crypto portfolio performance, key metrics, and recent activity.

## Objectives
- Build responsive dashboard layout with key portfolio metrics
- Implement real-time portfolio value updates
- Create performance indicators and trend visualizations
- Design intuitive navigation and quick action buttons

## Acceptance Criteria
- [ ] Responsive dashboard layout for desktop and mobile
- [ ] Real-time portfolio total value display
- [ ] 24h, 7d, 30d performance indicators with percentage changes
- [ ] Top performing and worst performing assets cards
- [ ] Recent transactions summary
- [ ] Quick action buttons (buy, sell, transfer)
- [ ] Exchange status indicators
- [ ] Portfolio allocation donut chart
- [ ] Profit/loss indicators with color coding
- [ ] Customizable dashboard widgets

## Technical Implementation

### File Structure
```
src/
  components/
    Dashboard/
      DashboardOverview.jsx
      PortfolioSummary.jsx
      PerformanceMetrics.jsx
      QuickActions.jsx
      RecentActivity.jsx
      AllocationChart.jsx
  styles/
    Dashboard.css
  hooks/
    useDashboardData.js
```

### Core Component
```jsx
// DashboardOverview.jsx
import React from 'react';
import { useDashboardData } from '../hooks/useDashboardData';
import PortfolioSummary from './PortfolioSummary';
import PerformanceMetrics from './PerformanceMetrics';
import QuickActions from './QuickActions';
import RecentActivity from './RecentActivity';
import AllocationChart from './AllocationChart';
import './Dashboard.css';

const DashboardOverview = () => {
  const {
    portfolioData,
    performanceData,
    recentTransactions,
    isLoading,
    error
  } = useDashboardData();

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  if (error) {
    return <ErrorBoundary error={error} />;
  }

  return (
    <div className="dashboard-overview">
      <div className="dashboard-header">
        <h1>Portfolio Overview</h1>
        <QuickActions />
      </div>
      
      <div className="dashboard-grid">
        <div className="portfolio-summary-card">
          <PortfolioSummary data={portfolioData} />
        </div>
        
        <div className="performance-metrics-card">
          <PerformanceMetrics data={performanceData} />
        </div>
        
        <div className="allocation-chart-card">
          <AllocationChart data={portfolioData.allocation} />
        </div>
        
        <div className="recent-activity-card">
          <RecentActivity transactions={recentTransactions} />
        </div>
      </div>
    </div>
  );
};

export default DashboardOverview;
```

### Portfolio Summary Component
```jsx
// PortfolioSummary.jsx
import React from 'react';
import { formatCurrency, formatPercentage } from '../utils/formatters';

const PortfolioSummary = ({ data }) => {
  const {
    totalValue,
    totalValue24hAgo,
    totalValueChange24h,
    totalValueChangePercentage24h
  } = data;

  const isPositive = totalValueChange24h >= 0;

  return (
    <div className="portfolio-summary">
      <div className="total-value">
        <h2>Total Portfolio Value</h2>
        <div className="value-amount">
          {formatCurrency(totalValue)}
        </div>
      </div>
      
      <div className={`value-change ${isPositive ? 'positive' : 'negative'}`}>
        <span className="change-amount">
          {isPositive ? '+' : ''}{formatCurrency(totalValueChange24h)}
        </span>
        <span className="change-percentage">
          ({isPositive ? '+' : ''}{formatPercentage(totalValueChangePercentage24h)})
        </span>
        <span className="change-period">24h</span>
      </div>

      <div className="portfolio-stats">
        <div className="stat">
          <label>Total Assets</label>
          <value>{data.totalAssets}</value>
        </div>
        <div className="stat">
          <label>Connected Exchanges</label>
          <value>{data.connectedExchanges}</value>
        </div>
        <div className="stat">
          <label>Last Updated</label>
          <value>{data.lastUpdated}</value>
        </div>
      </div>
    </div>
  );
};
```

### Performance Metrics Component
```jsx
// PerformanceMetrics.jsx
import React, { useState } from 'react';
import { formatPercentage, formatCurrency } from '../utils/formatters';

const PerformanceMetrics = ({ data }) => {
  const [selectedPeriod, setSelectedPeriod] = useState('24h');
  
  const periods = ['24h', '7d', '30d', '1y'];
  const currentData = data[selectedPeriod];

  return (
    <div className="performance-metrics">
      <div className="metrics-header">
        <h3>Performance</h3>
        <div className="period-selector">
          {periods.map(period => (
            <button
              key={period}
              className={`period-btn ${selectedPeriod === period ? 'active' : ''}`}
              onClick={() => setSelectedPeriod(period)}
            >
              {period}
            </button>
          ))}
        </div>
      </div>

      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-label">Profit/Loss</div>
          <div className={`metric-value ${currentData.pnl >= 0 ? 'positive' : 'negative'}`}>
            {currentData.pnl >= 0 ? '+' : ''}{formatCurrency(currentData.pnl)}
          </div>
          <div className="metric-change">
            {formatPercentage(currentData.pnlPercentage)}
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-label">Best Performer</div>
          <div className="metric-value positive">
            {currentData.bestPerformer.symbol}
          </div>
          <div className="metric-change">
            +{formatPercentage(currentData.bestPerformer.change)}
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-label">Worst Performer</div>
          <div className="metric-value negative">
            {currentData.worstPerformer.symbol}
          </div>
          <div className="metric-change">
            {formatPercentage(currentData.worstPerformer.change)}
          </div>
        </div>
      </div>
    </div>
  );
};
```

### Custom Hook for Dashboard Data
```javascript
// useDashboardData.js
import { useState, useEffect } from 'react';
import { portfolioService } from '../services/PortfolioService';
import { websocketService } from '../services/WebSocketService';

export const useDashboardData = () => {
  const [portfolioData, setPortfolioData] = useState(null);
  const [performanceData, setPerformanceData] = useState(null);
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadDashboardData();
    setupRealTimeUpdates();

    return () => {
      websocketService.unsubscribeFromPortfolioUpdates();
    };
  }, []);

  const loadDashboardData = async () => {
    try {
      setIsLoading(true);
      
      const [portfolio, performance, transactions] = await Promise.all([
        portfolioService.getPortfolioSummary(),
        portfolioService.getPerformanceMetrics(),
        portfolioService.getRecentTransactions(10)
      ]);

      setPortfolioData(portfolio);
      setPerformanceData(performance);
      setRecentTransactions(transactions);
    } catch (err) {
      setError(err);
    } finally {
      setIsLoading(false);
    }
  };

  const setupRealTimeUpdates = () => {
    websocketService.subscribeToPortfolioUpdates((update) => {
      setPortfolioData(prevData => ({
        ...prevData,
        ...update
      }));
    });
  };

  return {
    portfolioData,
    performanceData,
    recentTransactions,
    isLoading,
    error,
    refresh: loadDashboardData
  };
};
```

### Dashboard Styles
```css
/* Dashboard.css */
.dashboard-overview {
  padding: 2rem;
  max-width: 1400px;
  margin: 0 auto;
}

.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}

.dashboard-grid {
  display: grid;
  grid-template-columns: 2fr 1fr;
  grid-template-rows: auto auto;
  gap: 1.5rem;
  grid-template-areas:
    "summary metrics"
    "allocation activity";
}

.portfolio-summary-card {
  grid-area: summary;
  background: white;
  border-radius: 12px;
  padding: 2rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.performance-metrics-card {
  grid-area: metrics;
  background: white;
  border-radius: 12px;
  padding: 2rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.allocation-chart-card {
  grid-area: allocation;
  background: white;
  border-radius: 12px;
  padding: 2rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.recent-activity-card {
  grid-area: activity;
  background: white;
  border-radius: 12px;
  padding: 2rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

@media (max-width: 768px) {
  .dashboard-grid {
    grid-template-columns: 1fr;
    grid-template-areas:
      "summary"
      "metrics"
      "allocation"
      "activity";
  }
  
  .dashboard-overview {
    padding: 1rem;
  }
}

.positive {
  color: #00c851;
}

.negative {
  color: #ff4444;
}

.metric-card {
  padding: 1rem;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  text-align: center;
}

.period-selector {
  display: flex;
  gap: 0.5rem;
}

.period-btn {
  padding: 0.5rem 1rem;
  border: 1px solid #ddd;
  background: white;
  border-radius: 4px;
  cursor: pointer;
}

.period-btn.active {
  background: #007bff;
  color: white;
  border-color: #007bff;
}
```

## Testing Requirements
- Component rendering tests with different data states
- Responsive design testing across devices
- Real-time update functionality testing
- Performance testing with large portfolios
- Accessibility testing for screen readers

## Dependencies
- Depends on: CP-004 (Portfolio Management)
- Depends on: CP-021 (Real-time WebSocket)
- Blocks: CP-027 (Real-time Portfolio Updates)

## Time Estimate
**Beginner**: 5-6 days
**Intermediate**: 3-4 days
**Advanced**: 2-3 days

## Required Skills
- React.js and component architecture
- CSS Grid and Flexbox layouts
- Responsive web design
- Real-time data handling
- Custom hooks and state management