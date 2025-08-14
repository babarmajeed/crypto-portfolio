import { useState, useEffect } from 'react';

interface BreakpointState {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  screenSize: 'mobile' | 'tablet' | 'desktop';
  width: number;
}

export const useMobileResponsive = (): BreakpointState => {
  const [breakpoint, setBreakpoint] = useState<BreakpointState>({
    isMobile: false,
    isTablet: false,
    isDesktop: false,
    screenSize: 'desktop',
    width: 0
  });

  useEffect(() => {
    const updateBreakpoint = () => {
      const width = window.innerWidth;
      const isMobile = width < 768;
      const isTablet = width >= 768 && width < 1024;
      const isDesktop = width >= 1024;
      
      let screenSize: 'mobile' | 'tablet' | 'desktop' = 'desktop';
      if (isMobile) screenSize = 'mobile';
      else if (isTablet) screenSize = 'tablet';

      setBreakpoint({
        isMobile,
        isTablet,
        isDesktop,
        screenSize,
        width
      });
    };

    updateBreakpoint();
    window.addEventListener('resize', updateBreakpoint);
    
    return () => window.removeEventListener('resize', updateBreakpoint);
  }, []);

  return breakpoint;
};