import React, { useState } from 'react';
import { DashboardOverview } from '../components/dashboard/DashboardOverview';
import MobileHeader from '../components/Mobile/MobileHeader';
import MobileNavigation from '../components/Mobile/MobileNavigation';
import NavigationDrawer from '../components/Mobile/NavigationDrawer';
import { useResponsive } from '../hooks/useResponsive';

export function Dashboard() {
  const [isNavigationOpen, setIsNavigationOpen] = useState(false);
  const [notificationCount] = useState(3); // Mock notification count
  const { isMobile, isTablet } = useResponsive();

  const handleMenuClick = () => {
    setIsNavigationOpen(true);
  };

  const handleCloseNavigation = () => {
    setIsNavigationOpen(false);
  };

  const handleSearchClick = () => {
    // Handle search action
    console.log('Search clicked');
  };

  const handleNotificationClick = () => {
    // Handle notification action
    console.log('Notifications clicked');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile Header */}
      {(isMobile || isTablet) && (
        <MobileHeader
          title="Crypto Portfolio"
          subtitle="Track your investments"
          showLogo={true}
          showMenuButton={true}
          showSearchButton={true}
          showNotificationButton={true}
          notificationCount={notificationCount}
          onMenuClick={handleMenuClick}
          onSearchClick={handleSearchClick}
          onNotificationClick={handleNotificationClick}
        />
      )}

      {/* Mobile Navigation Drawer */}
      <NavigationDrawer
        isOpen={isNavigationOpen}
        onClose={handleCloseNavigation}
        position="left"
      >
        <MobileNavigation onNavigate={handleCloseNavigation} />
      </NavigationDrawer>

      {/* Main Dashboard Content */}
      <div className={`${(isMobile || isTablet) ? 'pt-16' : ''}`}>
        <DashboardOverview />
      </div>
    </div>
  );
}