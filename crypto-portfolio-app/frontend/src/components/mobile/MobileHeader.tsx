import React, { useState, useCallback } from 'react';
import { useResponsive } from '../../hooks/useResponsive';

export interface MobileHeaderProps {
  title?: string;
  subtitle?: string;
  showLogo?: boolean;
  showMenuButton?: boolean;
  showBackButton?: boolean;
  showSearchButton?: boolean;
  showNotificationButton?: boolean;
  notificationCount?: number;
  onMenuClick?: () => void;
  onBackClick?: () => void;
  onSearchClick?: () => void;
  onNotificationClick?: () => void;
  rightContent?: React.ReactNode;
  className?: string;
}

const MobileHeader: React.FC<MobileHeaderProps> = ({
  title = 'Portfolio',
  subtitle,
  showLogo = true,
  showMenuButton = true,
  showBackButton = false,
  showSearchButton = true,
  showNotificationButton = true,
  notificationCount = 0,
  onMenuClick,
  onBackClick,
  onSearchClick,
  onNotificationClick,
  rightContent,
  className = ''
}) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const { isMobile, isTablet } = useResponsive();

  // Handle scroll effect for header
  React.useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleMenuClick = useCallback(() => {
    onMenuClick?.();
  }, [onMenuClick]);

  const handleBackClick = useCallback(() => {
    onBackClick?.();
  }, [onBackClick]);

  const handleSearchClick = useCallback(() => {
    onSearchClick?.();
  }, [onSearchClick]);

  const handleNotificationClick = useCallback(() => {
    onNotificationClick?.();
  }, [onNotificationClick]);

  if (!isMobile && !isTablet) {
    return null; // Don't render mobile header on desktop
  }

  return (
    <header 
      className={`mobile-header ${isScrolled ? 'scrolled' : ''} ${className}`}
      role="banner"
    >
      <div className="mobile-header-content safe-area-top">
        {/* Left Section */}
        <div className="header-left">
          {showBackButton ? (
            <button
              className="header-btn back-btn touch-target"
              onClick={handleBackClick}
              aria-label="Go back"
              type="button"
            >
              <span className="btn-icon">←</span>
            </button>
          ) : showMenuButton ? (
            <button
              className="header-btn menu-btn touch-target"
              onClick={handleMenuClick}
              aria-label="Open menu"
              type="button"
            >
              <span className="btn-icon">
                <span className="hamburger-line"></span>
                <span className="hamburger-line"></span>
                <span className="hamburger-line"></span>
              </span>
            </button>
          ) : null}
        </div>

        {/* Center Section */}
        <div className="header-center">
          <div className="header-title">
            {showLogo && (
              <div className="header-logo">
                <img src="/logo.svg" alt="Logo" className="logo-image" />
              </div>
            )}
            <div className="title-content">
              <h1 className="title-text">{title}</h1>
              {subtitle && <p className="subtitle-text">{subtitle}</p>}
            </div>
          </div>
        </div>

        {/* Right Section */}
        <div className="header-right">
          {rightContent || (
            <>
              {showSearchButton && (
                <button
                  className="header-btn search-btn touch-target"
                  onClick={handleSearchClick}
                  aria-label="Search"
                  type="button"
                >
                  <span className="btn-icon">🔍</span>
                </button>
              )}

              {showNotificationButton && (
                <button
                  className="header-btn notification-btn touch-target"
                  onClick={handleNotificationClick}
                  aria-label={`Notifications${notificationCount > 0 ? ` (${notificationCount})` : ''}`}
                  type="button"
                >
                  <span className="btn-icon">🔔</span>
                  {notificationCount > 0 && (
                    <span className="notification-badge" aria-label={`${notificationCount} unread notifications`}>
                      {notificationCount > 99 ? '99+' : notificationCount}
                    </span>
                  )}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Header Shadow/Border */}
      <div className="header-shadow" />
    </header>
  );
};

export default MobileHeader;