import React, { useState, useCallback } from 'react';
import { useDashboardData } from '../../hooks/useDashboardData';
import { useResponsive, useBreakpointValue } from '../../hooks/useResponsive';
import { useSwipe } from '../../hooks/useSwipe';
import { useTouch } from '../../hooks/useTouch';
import { PortfolioSummary } from './PortfolioSummary';
import { PerformanceMetrics } from './PerformanceMetrics';
import { QuickActions } from './QuickActions';
import { RecentActivity } from './RecentActivity';
import { AllocationChart } from './AllocationChart';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { ErrorDisplay } from '../ui/ErrorDisplay';
import { CollapsibleSection } from '../ui/CollapsibleSection';
import { SwipeIndicator } from '../ui/SwipeIndicator';
import { TouchCard } from '../ui/TouchCard';

export const DashboardOverview: React.FC = () => {
  const {
    portfolioData,
    performanceData,
    recentTransactions,
    isLoading,
    error,
    refresh
  } = useDashboardData();
  
  const { isMobile, isTablet, isSmallMobile, screenSize, orientation } = useResponsive();
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    portfolio: true,
    performance: !isMobile,
    allocation: !isMobile,
    activity: false
  });
  
  // Current active section for swipe navigation
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
  const dashboardSections = ['Overview', 'Performance', 'Allocation', 'Activity'];
  
  const handleSectionChange = useCallback((sectionIndex: number) => {
    setCurrentSectionIndex(sectionIndex);
    
    // Auto-expand the current section on mobile
    if (isMobile) {
      const sectionKeys = ['portfolio', 'performance', 'allocation', 'activity'];
      const newExpanded = { ...expandedSections };
      
      // Collapse all sections except the active one
      sectionKeys.forEach((key, index) => {
        newExpanded[key] = index === sectionIndex;
      });
      
      setExpandedSections(newExpanded);
    }
  }, [isMobile, expandedSections]);
  
  // Swipe navigation for mobile
  const swipeHandlers = useSwipe({
    threshold: 50,
    onSwipe: (direction) => {
      if (isMobile && direction === 'left' && currentSectionIndex < dashboardSections.length - 1) {
        handleSectionChange(currentSectionIndex + 1);
      } else if (isMobile && direction === 'right' && currentSectionIndex > 0) {
        handleSectionChange(currentSectionIndex - 1);
      }
    }
  });
  
  // Touch handlers for enhanced mobile interactions
  const touchHandlers = useTouch({
    onTap: (point) => {
      // Handle tap interactions on mobile
    },
    onLongPress: (point) => {
      // Handle long press for contextual menus
    }
  });
  
  const toggleSection = useCallback((sectionKey: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionKey]: !prev[sectionKey]
    }));
  }, []);
  
  // Responsive grid columns based on screen size
  const gridColumns = useBreakpointValue({
    xs: 1,
    sm: 2,
    md: 2,
    lg: 3,
    xl: 4,
    xxl: 4
  }) || 1;
  
  // Responsive spacing
  const spacing = useBreakpointValue({
    xs: 'space-y-3',
    sm: 'space-y-4',
    md: 'space-y-6',
    lg: 'space-y-8'
  }) || 'space-y-4';
  
  // Responsive padding
  const containerPadding = useBreakpointValue({
    xs: 'px-3 py-4',
    sm: 'px-4 py-6',
    md: 'px-6 py-8',
    lg: 'px-8 py-10'
  }) || 'px-4 py-6';

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <ErrorDisplay 
          error={error} 
          onRetry={refresh}
          title="Failed to load dashboard data"
        />
      </div>
    );
  }

  // Render mobile-first responsive dashboard
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-4 sm:py-8">
        {/* Mobile-First Dashboard Header */}
        <div className="mb-6 sm:mb-8">
          <div className="flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Portfolio Overview</h1>
              <p className="text-sm sm:text-base text-gray-600 mt-1">
                Track your cryptocurrency portfolio performance in real-time
              </p>
            </div>
            
            {/* Mobile-optimized Quick Actions */}
            <div className="w-full sm:w-auto">
              <QuickActions />
            </div>
          </div>
        </div>

        {/* Mobile Section Navigation Dots */}
        {isMobile && (
          <div className="flex justify-center items-center gap-2 mb-4">
            {dashboardSections.map((section, index) => (
              <button
                key={section}
                onClick={() => handleSectionChange(index)}
                className={`w-2 h-2 rounded-full transition-all duration-200 touch-target ${
                  index === currentSectionIndex
                    ? 'bg-blue-600 w-6'
                    : 'bg-gray-300'
                }`}
                aria-label={`Navigate to ${section} section`}
              />
            ))}
          </div>
        )}

        {/* Mobile-First Dashboard Container */}
        <div
          className={`
            ${isMobile ? 'touch-pan-y' : ''}
            transition-all duration-300 ease-out
            ${containerPadding}
          `}
          {...(isMobile ? { ...swipeHandlers, ...touchHandlers } : {})}
        >
          {/* Dashboard Content - Mobile-First Layout */}
          <div className={spacing}>
            
            {/* Portfolio Summary Section */}
            {isMobile ? (
              <CollapsibleSection
                title="Portfolio Summary"
                isOpenByDefault={expandedSections.portfolio}
                onToggle={(isOpen) => setExpandedSections(prev => ({ ...prev, portfolio: isOpen }))}
                badge={portfolioData?.totalAssets}
                icon={
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                }
                className="mb-4"
              >
                <PortfolioSummary data={portfolioData} />
              </CollapsibleSection>
            ) : (
              <TouchCard className="mb-6">
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <PortfolioSummary data={portfolioData} />
                </div>
              </TouchCard>
            )}

            {/* Performance Metrics Section */}
            {isMobile ? (
              <CollapsibleSection
                title="Performance Metrics"
                isOpenByDefault={expandedSections.performance}
                onToggle={(isOpen) => setExpandedSections(prev => ({ ...prev, performance: isOpen }))}
                icon={
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                }
                className="mb-4"
              >
                <PerformanceMetrics data={performanceData} />
              </CollapsibleSection>
            ) : (
              <TouchCard>
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <PerformanceMetrics data={performanceData} />
                </div>
              </TouchCard>
            )}

            {/* Allocation Chart Section */}
            {isMobile ? (
              <CollapsibleSection
                title="Asset Allocation"
                isOpenByDefault={expandedSections.allocation}
                onToggle={(isOpen) => setExpandedSections(prev => ({ ...prev, allocation: isOpen }))}
                icon={
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
                  </svg>
                }
                className="mb-4"
              >
                <AllocationChart 
                  data={portfolioData?.allocation || []} 
                  totalValue={portfolioData?.totalValue || 0}
                />
              </CollapsibleSection>
            ) : (
              <TouchCard>
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <AllocationChart 
                    data={portfolioData?.allocation || []} 
                    totalValue={portfolioData?.totalValue || 0}
                  />
                </div>
              </TouchCard>
            )}

            {/* Recent Activity Section */}
            {isMobile ? (
              <CollapsibleSection
                title="Recent Activity"
                isOpenByDefault={expandedSections.activity}
                onToggle={(isOpen) => setExpandedSections(prev => ({ ...prev, activity: isOpen }))}
                badge={recentTransactions?.length}
                icon={
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                }
                className="mb-4"
              >
                <RecentActivity transactions={recentTransactions} />
              </CollapsibleSection>
            ) : (
              <TouchCard>
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <RecentActivity transactions={recentTransactions} />
                </div>
              </TouchCard>
            )}
          </div>

          {/* Additional Stats - Mobile-optimized Grid */}
          <div className="mt-6 sm:mt-8">
            <div 
              className={`grid gap-4 sm:gap-6`}
              style={{
                gridTemplateColumns: `repeat(${gridColumns}, 1fr)`
              }}
            >
              {/* Total Assets Card */}
              <TouchCard className="h-full">
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6 h-full">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 sm:w-8 sm:h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                        <svg className="w-5 h-5 sm:w-4 sm:h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                        </svg>
                      </div>
                    </div>
                    <div className="ml-3 sm:ml-4 flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-600 truncate">Total Assets</p>
                      <p className="text-xl sm:text-2xl font-semibold text-gray-900">
                        {portfolioData?.totalAssets || 0}
                      </p>
                    </div>
                  </div>
                </div>
              </TouchCard>

              {/* Connected Exchanges Card */}
              <TouchCard className="h-full">
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6 h-full">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 sm:w-8 sm:h-8 bg-green-100 rounded-lg flex items-center justify-center">
                        <svg className="w-5 h-5 sm:w-4 sm:h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                        </svg>
                      </div>
                    </div>
                    <div className="ml-3 sm:ml-4 flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-600 truncate">Connected Exchanges</p>
                      <p className="text-xl sm:text-2xl font-semibold text-gray-900">
                        {portfolioData?.connectedExchanges || 0}
                      </p>
                    </div>
                  </div>
                </div>
              </TouchCard>

              {/* 24h Volume Card */}
              <TouchCard className="h-full">
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6 h-full">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 sm:w-8 sm:h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                        <svg className="w-5 h-5 sm:w-4 sm:h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                        </svg>
                      </div>
                    </div>
                    <div className="ml-3 sm:ml-4 flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-600 truncate">24h Volume</p>
                      <p className="text-lg sm:text-2xl font-semibold text-gray-900">
                        ${(portfolioData?.volume24h || 0).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              </TouchCard>

              {/* Last Updated Card */}
              <TouchCard className="h-full">
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6 h-full">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 sm:w-8 sm:h-8 bg-orange-100 rounded-lg flex items-center justify-center">
                        <svg className="w-5 h-5 sm:w-4 sm:h-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                    </div>
                    <div className="ml-3 sm:ml-4 flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-600 truncate">Last Updated</p>
                      <p className="text-sm sm:text-base text-gray-900 font-medium">
                        {portfolioData?.lastUpdated ? 
                          new Date(portfolioData.lastUpdated).toLocaleTimeString() : 
                          'Never'
                        }
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {portfolioData?.lastUpdated ? 
                          new Date(portfolioData.lastUpdated).toLocaleDateString() : 
                          ''
                        }
                      </p>
                    </div>
                  </div>
                </div>
              </TouchCard>
            </div>
          </div>
        </div>

        {/* Mobile Navigation Helper */}
        {isMobile && (
          <div className="mt-8 pb-safe flex justify-center items-center gap-4 text-sm text-gray-500">
            <div className="flex items-center gap-2 bg-gray-100 rounded-full px-4 py-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16l-4-4m0 0l4-4m-4 4h18" />
              </svg>
              <span className="text-xs font-medium">Swipe to navigate sections</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </div>
            <div className="text-xs text-gray-400">
              {orientation === 'portrait' ? '📱 Portrait' : '📱 Landscape'}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DashboardOverview;