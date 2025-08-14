/**
 * CP-034: Mobile-First Component Library
 * 
 * Export all mobile-optimized components and utilities
 */

// Layout Components
export { default as Container } from './Container/Container';
export { default as Grid } from './Grid/Grid';
export { default as Layout } from './Layout/Layout';

// Interactive Components
export { default as Button } from './Button/Button';
export { default as Input } from './Input/Input';
export { default as Card } from './Card/Card';

// Navigation Components
export { default as MobileNavigation } from './Navigation/MobileNavigation';
export { default as Header } from './Header/Header';

// Data Display Components
export { default as Table } from './Table/Table';
export { default as Modal } from './Modal/Modal';

// Loading and Feedback Components
export { default as LoadingSpinner } from './Loading/LoadingSpinner';
export { default as Skeleton } from './Loading/Skeleton';

// Utility Components
export { default as SafeAreaView } from './Utility/SafeAreaView';
export { default as TouchFeedback } from './Utility/TouchFeedback';

// Types
export type {
  ResponsiveValue,
  Breakpoint,
  TouchTargetSize,
  ContainerProps,
  GridProps,
  LayoutProps,
  ButtonProps,
  InputProps,
  CardProps,
  MobileNavigationProps,
  HeaderProps,
  TableProps,
  ModalProps,
  LoadingSpinnerProps,
  SkeletonProps,
} from './types';

// Hooks (re-export from hooks directory)
export {
  useBreakpoint,
  useResponsiveValue,
  useContainerQuery,
  useDeviceDetection,
  useTouchFeedback,
  useSafeAreaInsets,
  useResponsiveGrid,
  useOrientation,
  useViewportVisibility,
  useScrollDirection,
  useResponsiveFontSize,
  useNetworkStatus,
  useDebouncedResize,
  useTouchTargetValidation,
  useResponsiveClassName,
} from '../hooks/useResponsive';

// Utilities (re-export from utils directory)
export {
  BREAKPOINTS,
  TOUCH_TARGETS,
  createMediaQuery,
  createMaxMediaQuery,
  getResponsiveValue,
  isTouchDevice,
  isIOSDevice,
  isAndroidDevice,
  hasSafeArea,
  getResponsiveColumns,
  getSafeAreaInsets,
  getViewportSize,
  getResponsiveFontSize,
  createResponsiveStyles,
  addTouchFeedback,
  ensureMinimumTouchTarget,
  formatResponsiveClassName,
  debounceResize,
  throttleResize,
} from '../utils/responsive';