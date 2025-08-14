import { useState, useEffect } from 'react';

interface MobileDetectionResult {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  screenWidth: number;
  orientation: 'portrait' | 'landscape';
  isTouchDevice: boolean;
}

export const useMobileDetection = (): MobileDetectionResult => {
  const [detection, setDetection] = useState<MobileDetectionResult>({
    isMobile: false,
    isTablet: false,
    isDesktop: true,
    screenWidth: 0,
    orientation: 'landscape',
    isTouchDevice: false
  });

  useEffect(() => {
    const updateDetection = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      
      // Breakpoints
      const isMobile = width < 768;
      const isTablet = width >= 768 && width < 1024;
      const isDesktop = width >= 1024;
      
      // Orientation
      const orientation = height > width ? 'portrait' : 'landscape';
      
      // Touch device detection
      const isTouchDevice = 'ontouchstart' in window || 
                           navigator.maxTouchPoints > 0 ||
                           (navigator as any).msMaxTouchPoints > 0;

      setDetection({
        isMobile,
        isTablet,
        isDesktop,
        screenWidth: width,
        orientation,
        isTouchDevice
      });
    };

    // Initial detection
    updateDetection();

    // Listen for resize events
    window.addEventListener('resize', updateDetection);
    window.addEventListener('orientationchange', updateDetection);

    return () => {
      window.removeEventListener('resize', updateDetection);
      window.removeEventListener('orientationchange', updateDetection);
    };
  }, []);

  return detection;
};

// Hook for responsive navigation behavior
export const useResponsiveNavigation = () => {
  const { isMobile, isTablet } = useMobileDetection();
  const [isNavOpen, setIsNavOpen] = useState(false);

  // Close navigation when switching to desktop
  useEffect(() => {
    if (!isMobile && !isTablet) {
      setIsNavOpen(false);
    }
  }, [isMobile, isTablet]);

  const toggleNav = () => setIsNavOpen(!isNavOpen);
  const closeNav = () => setIsNavOpen(false);
  const openNav = () => setIsNavOpen(true);

  return {
    isMobile,
    isTablet,
    isNavOpen,
    toggleNav,
    closeNav,
    openNav,
    shouldShowMobileNav: isMobile || isTablet
  };
};