import React, { useState } from 'react';
import { Header } from '../layout/Header';
import { Sidebar } from '../layout/Sidebar';
import { MobileBottomNavigation, SwipeGestures } from './';
import { useMobileDetection } from '../../hooks/useMobileDetection';

interface MobileResponsiveLayoutProps {
  children: React.ReactNode;
  showBottomNav?: boolean;
  enableSwipeGestures?: boolean;
}

const MobileResponsiveLayout: React.FC<MobileResponsiveLayoutProps> = ({
  children,
  showBottomNav = true,
  enableSwipeGestures = true
}) => {
  const { isMobile, isTablet } = useMobileDetection();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleSwipeRight = () => {
    if ((isMobile || isTablet) && !sidebarOpen) {
      setSidebarOpen(true);
    }
  };

  const handleSwipeLeft = () => {
    if (sidebarOpen) {
      setSidebarOpen(false);
    }
  };

  const layoutContent = (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Header />
      
      <div className="flex h-[calc(100vh-4rem)]">
        {/* Desktop Sidebar */}
        <Sidebar className={!isMobile && !isTablet ? 'block' : 'hidden'} />
        
        {/* Main Content */}
        <main className={`
          flex-1 overflow-auto transition-all duration-300
          ${isMobile ? 'p-3' : 'p-6'}
          ${showBottomNav && (isMobile || isTablet) ? 'pb-20' : ''}
        `}>
          {children}
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      {showBottomNav && (isMobile || isTablet) && (
        <MobileBottomNavigation />
      )}
    </div>
  );

  if (enableSwipeGestures && (isMobile || isTablet)) {
    return (
      <SwipeGestures
        onSwipeRight={handleSwipeRight}
        onSwipeLeft={handleSwipeLeft}
        threshold={50}
        className="min-h-screen"
      >
        {layoutContent}
      </SwipeGestures>
    );
  }

  return layoutContent;
};

export default MobileResponsiveLayout;