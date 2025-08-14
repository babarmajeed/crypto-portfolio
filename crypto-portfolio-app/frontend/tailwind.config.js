/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // Mobile-first responsive breakpoints
      screens: {
        'xs': '320px',   // Small phones
        'sm': '576px',   // Large phones
        'md': '768px',   // Tablets
        'lg': '992px',   // Small laptops
        'xl': '1200px',  // Large laptops
        'xxl': '1400px', // Large desktops
        // Orientation-specific breakpoints
        'tall': { 'raw': '(min-height: 800px)' },
        'short': { 'raw': '(max-height: 600px)' },
      },
      
      // Touch-friendly spacing
      spacing: {
        'touch': '44px',     // Minimum touch target size
        'touch-sm': '36px',  // Small touch targets
        'touch-lg': '56px',  // Large touch targets
        'safe-top': 'env(safe-area-inset-top)',
        'safe-bottom': 'env(safe-area-inset-bottom)',
        'safe-left': 'env(safe-area-inset-left)',
        'safe-right': 'env(safe-area-inset-right)',
      },
      
      // Mobile-optimized typography
      fontSize: {
        'xs-mobile': ['0.75rem', { lineHeight: '1.4' }],
        'sm-mobile': ['0.875rem', { lineHeight: '1.4' }],
        'base-mobile': ['1rem', { lineHeight: '1.5' }],
        'lg-mobile': ['1.125rem', { lineHeight: '1.5' }],
        'xl-mobile': ['1.25rem', { lineHeight: '1.4' }],
        '2xl-mobile': ['1.5rem', { lineHeight: '1.3' }],
      },
      
      // Mobile-first container sizes
      maxWidth: {
        'mobile': '100%',
        'mobile-lg': '480px',
        'tablet': '768px',
        'desktop': '1200px',
        'desktop-xl': '1400px',
      },
      
      // Touch-optimized shadows for depth perception
      boxShadow: {
        'touch': '0 2px 8px rgba(0, 0, 0, 0.1)',
        'touch-hover': '0 4px 16px rgba(0, 0, 0, 0.15)',
        'touch-active': '0 1px 4px rgba(0, 0, 0, 0.2)',
        'mobile-card': '0 2px 12px rgba(0, 0, 0, 0.08)',
        'mobile-modal': '0 8px 32px rgba(0, 0, 0, 0.24)',
      },
      
      // Animation for mobile interactions
      animation: {
        'slide-in-right': 'slideInRight 0.3s ease-out',
        'slide-out-right': 'slideOutRight 0.3s ease-in',
        'slide-in-up': 'slideInUp 0.3s ease-out',
        'slide-out-down': 'slideOutDown 0.3s ease-in',
        'fade-in-up': 'fadeInUp 0.3s ease-out',
        'bounce-gentle': 'bounceGentle 0.6s ease-out',
        'scale-tap': 'scaleTap 0.15s ease-out',
      },
      
      keyframes: {
        slideInRight: {
          '0%': { transform: 'translateX(100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        slideOutRight: {
          '0%': { transform: 'translateX(0)', opacity: '1' },
          '100%': { transform: 'translateX(100%)', opacity: '0' },
        },
        slideInUp: {
          '0%': { transform: 'translateY(100%)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideOutDown: {
          '0%': { transform: 'translateY(0)', opacity: '1' },
          '100%': { transform: 'translateY(100%)', opacity: '0' },
        },
        fadeInUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        bounceGentle: {
          '0%, 20%, 53%, 80%, 100%': { transform: 'translateY(0)' },
          '40%, 43%': { transform: 'translateY(-5px)' },
          '70%': { transform: 'translateY(-2px)' },
          '90%': { transform: 'translateY(-1px)' },
        },
        scaleTap: {
          '0%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(0.95)' },
          '100%': { transform: 'scale(1)' },
        },
      },
      
      // Mobile-optimized color palette
      colors: {
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
        touch: {
          primary: '#3b82f6',
          secondary: '#6b7280',
          success: '#10b981',
          warning: '#f59e0b',
          error: '#ef4444',
          info: '#06b6d4',
        },
        mobile: {
          background: '#ffffff',
          surface: '#f8fafc',
          overlay: 'rgba(0, 0, 0, 0.5)',
          divider: '#e2e8f0',
          text: '#1e293b',
          'text-secondary': '#64748b',
          'text-muted': '#94a3b8',
        },
      },
      
      // Mobile-specific z-index layers
      zIndex: {
        'mobile-nav': '1000',
        'mobile-modal': '1100',
        'mobile-toast': '1200',
        'mobile-tooltip': '1300',
        'mobile-overlay': '999',
      },
    },
  },
  plugins: [
    // Custom mobile-first utilities
    function({ addUtilities, theme }) {
      const mobileUtilities = {
        // Touch target utilities
        '.touch-target': {
          minWidth: theme('spacing.touch'),
          minHeight: theme('spacing.touch'),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          cursor: 'pointer',
          userSelect: 'none',
          WebkitTapHighlightColor: 'transparent',
        },
        '.touch-target-sm': {
          minWidth: theme('spacing.touch-sm'),
          minHeight: theme('spacing.touch-sm'),
        },
        '.touch-target-lg': {
          minWidth: theme('spacing.touch-lg'),
          minHeight: theme('spacing.touch-lg'),
        },
        
        // Safe area utilities
        '.safe-area-top': {
          paddingTop: 'env(safe-area-inset-top)',
        },
        '.safe-area-bottom': {
          paddingBottom: 'env(safe-area-inset-bottom)',
        },
        '.safe-area-left': {
          paddingLeft: 'env(safe-area-inset-left)',
        },
        '.safe-area-right': {
          paddingRight: 'env(safe-area-inset-right)',
        },
        '.safe-area-inset': {
          paddingTop: 'env(safe-area-inset-top)',
          paddingRight: 'env(safe-area-inset-right)',
          paddingBottom: 'env(safe-area-inset-bottom)',
          paddingLeft: 'env(safe-area-inset-left)',
        },
        
        // Mobile-specific utilities
        '.mobile-scroll': {
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
          scrollBehavior: 'smooth',
        },
        '.mobile-snap-x': {
          scrollSnapType: 'x mandatory',
        },
        '.mobile-snap-y': {
          scrollSnapType: 'y mandatory',
        },
        '.mobile-snap-start': {
          scrollSnapAlign: 'start',
        },
        '.mobile-snap-center': {
          scrollSnapAlign: 'center',
        },
        
        // Touch feedback utilities
        '.touch-feedback': {
          position: 'relative',
          overflow: 'hidden',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: '50%',
            left: '50%',
            width: '0',
            height: '0',
            borderRadius: '50%',
            backgroundColor: 'rgba(255, 255, 255, 0.5)',
            transform: 'translate(-50%, -50%)',
            transition: 'width 0.15s ease-out, height 0.15s ease-out',
          },
          '&:active::before': {
            width: '100%',
            height: '100%',
          },
        },
        
        // Mobile modal utilities
        '.mobile-modal-backdrop': {
          position: 'fixed',
          top: '0',
          left: '0',
          right: '0',
          bottom: '0',
          backgroundColor: theme('colors.mobile.overlay'),
          backdropFilter: 'blur(4px)',
          zIndex: theme('zIndex.mobile-overlay'),
        },
        
        // Mobile grid utilities
        '.mobile-grid': {
          display: 'grid',
          gap: '1rem',
          gridTemplateColumns: '1fr',
          '@media (min-width: 576px)': {
            gridTemplateColumns: 'repeat(2, 1fr)',
          },
          '@media (min-width: 768px)': {
            gridTemplateColumns: 'repeat(3, 1fr)',
          },
          '@media (min-width: 1200px)': {
            gridTemplateColumns: 'repeat(4, 1fr)',
          },
        },
        
        // Mobile typography utilities
        '.mobile-heading': {
          fontSize: theme('fontSize.xl-mobile[0]'),
          lineHeight: theme('fontSize.xl-mobile[1].lineHeight'),
          fontWeight: '600',
          '@media (min-width: 768px)': {
            fontSize: theme('fontSize.2xl[0]'),
            lineHeight: theme('fontSize.2xl[1].lineHeight'),
          },
        },
        
        // Prevent scroll chaining on mobile
        '.prevent-scroll-chaining': {
          overscrollBehavior: 'contain',
        },
        
        // iOS momentum scrolling
        '.momentum-scroll': {
          WebkitOverflowScrolling: 'touch',
        },
      };
      
      addUtilities(mobileUtilities);
    },
    
    // Responsive visibility utilities
    function({ addUtilities }) {
      const responsiveUtilities = {
        '.mobile-only': {
          '@media (min-width: 768px)': {
            display: 'none !important',
          },
        },
        '.tablet-only': {
          '@media (max-width: 767px), (min-width: 1024px)': {
            display: 'none !important',
          },
        },
        '.desktop-only': {
          '@media (max-width: 1023px)': {
            display: 'none !important',
          },
        },
        '.mobile-tablet': {
          '@media (min-width: 1024px)': {
            display: 'none !important',
          },
        },
        '.tablet-desktop': {
          '@media (max-width: 767px)': {
            display: 'none !important',
          },
        },
      };
      
      addUtilities(responsiveUtilities);
    },
  ],
}