/**
 * CP-034: Mobile-First Component Types
 * 
 * TypeScript type definitions for mobile-optimized components
 */

import { ReactNode, CSSProperties } from 'react';

// Base responsive types
export type ResponsiveValue<T> = {
  xs?: T;
  sm?: T;
  md?: T;
  lg?: T;
  xl?: T;
  xxl?: T;
};

export type Breakpoint = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl';

export type TouchTargetSize = 'min' | 'comfortable' | 'large' | 'xl';

// Common props
export interface BaseComponentProps {
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
  testId?: string;
}

// Layout Component Types
export interface ContainerProps extends BaseComponentProps {
  variant?: 'fluid' | 'mobile' | 'desktop';
  padding?: ResponsiveValue<string>;
  maxWidth?: ResponsiveValue<string>;
  center?: boolean;
}

export interface GridProps extends BaseComponentProps {
  columns?: ResponsiveValue<number>;
  gap?: ResponsiveValue<string>;
  minItemWidth?: number;
  autoFlow?: 'row' | 'column' | 'dense';
  alignItems?: 'start' | 'center' | 'end' | 'stretch';
  justifyItems?: 'start' | 'center' | 'end' | 'stretch';
}

export interface LayoutProps extends BaseComponentProps {
  header?: ReactNode;
  sidebar?: ReactNode;
  footer?: ReactNode;
  mobileNavItems?: NavItem[];
  sidebarCollapsed?: boolean;
  onSidebarToggle?: () => void;
}

// Interactive Component Types
export interface ButtonProps extends BaseComponentProps {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'warning';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  touchSize?: TouchTargetSize;
  fullWidth?: boolean;
  isLoading?: boolean;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
  startIcon?: ReactNode;
  endIcon?: ReactNode;
  ripple?: boolean;
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  onTouchStart?: (event: React.TouchEvent<HTMLButtonElement>) => void;
  onTouchEnd?: (event: React.TouchEvent<HTMLButtonElement>) => void;
}

export interface InputProps extends BaseComponentProps {
  type?: 'text' | 'email' | 'password' | 'number' | 'tel' | 'url' | 'search';
  placeholder?: string;
  value?: string;
  defaultValue?: string;
  label?: string;
  helper?: string;
  error?: string;
  success?: string;
  disabled?: boolean;
  readonly?: boolean;
  required?: boolean;
  autoComplete?: string;
  autoFocus?: boolean;
  maxLength?: number;
  pattern?: string;
  startAdornment?: ReactNode;
  endAdornment?: ReactNode;
  onChange?: (value: string, event: React.ChangeEvent<HTMLInputElement>) => void;
  onFocus?: (event: React.FocusEvent<HTMLInputElement>) => void;
  onBlur?: (event: React.FocusEvent<HTMLInputElement>) => void;
  onKeyDown?: (event: React.KeyboardEvent<HTMLInputElement>) => void;
}

export interface CardProps extends BaseComponentProps {
  variant?: 'default' | 'elevated' | 'outlined' | 'ghost';
  padding?: ResponsiveValue<string>;
  radius?: ResponsiveValue<string>;
  interactive?: boolean;
  hoverable?: boolean;
  header?: ReactNode;
  footer?: ReactNode;
  onClick?: (event: React.MouseEvent<HTMLDivElement>) => void;
  onDoubleClick?: (event: React.MouseEvent<HTMLDivElement>) => void;
}

// Navigation Component Types
export interface NavItem {
  id: string;
  label: string;
  icon?: ReactNode;
  href?: string;
  onClick?: () => void;
  badge?: number | string;
  disabled?: boolean;
  external?: boolean;
}

export interface MobileNavigationProps extends BaseComponentProps {
  items: NavItem[];
  activeId?: string;
  variant?: 'bottom' | 'tabs';
  showLabels?: boolean;
  onChange?: (activeId: string) => void;
}

export interface HeaderProps extends BaseComponentProps {
  title?: string;
  subtitle?: string;
  leftAction?: ReactNode;
  rightActions?: ReactNode[];
  showBackButton?: boolean;
  backButtonHref?: string;
  transparent?: boolean;
  sticky?: boolean;
  height?: ResponsiveValue<string>;
  onBack?: () => void;
}

// Data Display Component Types
export interface Column<T = any> {
  key: keyof T | string;
  header: string;
  render?: (value: any, row: T, index: number) => ReactNode;
  sortable?: boolean;
  width?: string;
  align?: 'left' | 'center' | 'right';
  sticky?: boolean;
  hidden?: ResponsiveValue<boolean>;
}

export interface TableProps<T = any> extends BaseComponentProps {
  data: T[];
  columns: Column<T>[];
  loading?: boolean;
  empty?: ReactNode;
  mobileCardView?: boolean;
  stickyHeader?: boolean;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
  onRowClick?: (row: T, index: number) => void;
  onSort?: (key: string, direction: 'asc' | 'desc') => void;
  renderMobileCard?: (row: T, index: number) => ReactNode;
}

export interface ModalProps extends BaseComponentProps {
  isOpen: boolean;
  title?: string;
  subtitle?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'full';
  position?: 'center' | 'top' | 'bottom';
  closeOnBackdrop?: boolean;
  closeOnEscape?: boolean;
  showCloseButton?: boolean;
  preventScroll?: boolean;
  header?: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
  onOpen?: () => void;
  onAfterOpen?: () => void;
  onAfterClose?: () => void;
}

// Loading Component Types
export interface LoadingSpinnerProps extends BaseComponentProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  color?: string;
  thickness?: number;
  variant?: 'circular' | 'dots' | 'bars';
}

export interface SkeletonProps extends BaseComponentProps {
  width?: string | number;
  height?: string | number;
  variant?: 'text' | 'circular' | 'rectangular' | 'wave';
  animation?: 'pulse' | 'wave' | 'none';
  count?: number;
}

// Utility Component Types
export interface SafeAreaViewProps extends BaseComponentProps {
  edges?: ('top' | 'bottom' | 'left' | 'right')[];
  mode?: 'padding' | 'margin';
}

export interface TouchFeedbackProps extends BaseComponentProps {
  disabled?: boolean;
  ripple?: boolean;
  scale?: number;
  duration?: number;
  onPress?: () => void;
  onLongPress?: () => void;
}

// Form Types
export interface FormFieldProps extends BaseComponentProps {
  name: string;
  label?: string;
  required?: boolean;
  helper?: string;
  error?: string;
  disabled?: boolean;
}

export interface SelectOption {
  value: string | number;
  label: string;
  disabled?: boolean;
  icon?: ReactNode;
}

export interface SelectProps extends FormFieldProps {
  options: SelectOption[];
  value?: string | number;
  placeholder?: string;
  multiple?: boolean;
  searchable?: boolean;
  clearable?: boolean;
  loading?: boolean;
  onChange?: (value: string | number | (string | number)[]) => void;
}

// Advanced Component Types
export interface VirtualizedListProps<T = any> extends BaseComponentProps {
  items: T[];
  itemHeight: number | ((index: number) => number);
  containerHeight: number;
  renderItem: (item: T, index: number) => ReactNode;
  overscan?: number;
  onEndReached?: () => void;
  onEndReachedThreshold?: number;
}

export interface SwipeableProps extends BaseComponentProps {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  threshold?: number;
  preventDefaultTouchMove?: boolean;
}

export interface CollapsibleProps extends BaseComponentProps {
  isOpen: boolean;
  duration?: number;
  easing?: string;
  onToggle?: (isOpen: boolean) => void;
}

// Layout Types
export interface FlexboxProps extends BaseComponentProps {
  direction?: ResponsiveValue<'row' | 'column' | 'row-reverse' | 'column-reverse'>;
  wrap?: ResponsiveValue<'nowrap' | 'wrap' | 'wrap-reverse'>;
  justify?: ResponsiveValue<'start' | 'center' | 'end' | 'between' | 'around' | 'evenly'>;
  align?: ResponsiveValue<'start' | 'center' | 'end' | 'stretch' | 'baseline'>;
  gap?: ResponsiveValue<string | number>;
}

export interface StackProps extends BaseComponentProps {
  direction?: 'horizontal' | 'vertical';
  spacing?: ResponsiveValue<string | number>;
  align?: 'start' | 'center' | 'end' | 'stretch';
  divider?: ReactNode;
}

// Theme Types
export interface ThemeConfig {
  colors: {
    primary: string;
    secondary: string;
    success: string;
    warning: string;
    danger: string;
    background: string;
    surface: string;
    text: string;
  };
  breakpoints: Record<Breakpoint, number>;
  spacing: Record<string, string>;
  borderRadius: Record<string, string>;
  shadows: Record<string, string>;
  typography: {
    fontFamily: string;
    fontSize: Record<string, string>;
    fontWeight: Record<string, string>;
    lineHeight: Record<string, string>;
  };
}

// Device Types
export interface DeviceInfo {
  isTouchDevice: boolean;
  isIOSDevice: boolean;
  isAndroidDevice: boolean;
  hasSafeArea: boolean;
  userAgent: string;
  screenSize: { width: number; height: number };
  orientation: 'portrait' | 'landscape';
  pixelRatio: number;
}

// Network Types
export interface NetworkInfo {
  isOnline: boolean;
  connectionSpeed: 'slow' | 'fast';
  effectiveType?: '2g' | '3g' | '4g';
}

// Animation Types
export interface AnimationConfig {
  duration: number;
  easing: string;
  delay?: number;
  direction?: 'normal' | 'reverse' | 'alternate' | 'alternate-reverse';
  fillMode?: 'none' | 'forwards' | 'backwards' | 'both';
  iterationCount?: number | 'infinite';
}

// Accessibility Types
export interface A11yProps {
  'aria-label'?: string;
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
  'aria-expanded'?: boolean;
  'aria-selected'?: boolean;
  'aria-checked'?: boolean;
  'aria-disabled'?: boolean;
  'aria-hidden'?: boolean;
  'aria-live'?: 'off' | 'polite' | 'assertive';
  'aria-atomic'?: boolean;
  'aria-busy'?: boolean;
  'aria-controls'?: string;
  'aria-owns'?: string;
  'aria-haspopup'?: boolean | 'menu' | 'listbox' | 'tree' | 'grid' | 'dialog';
  role?: string;
  tabIndex?: number;
}

// Event Types
export interface TouchEventHandler {
  onTouchStart?: (event: React.TouchEvent) => void;
  onTouchMove?: (event: React.TouchEvent) => void;
  onTouchEnd?: (event: React.TouchEvent) => void;
  onTouchCancel?: (event: React.TouchEvent) => void;
}

export interface GestureEventHandler {
  onSwipe?: (direction: 'left' | 'right' | 'up' | 'down', distance: number) => void;
  onPinch?: (scale: number) => void;
  onRotate?: (angle: number) => void;
  onLongPress?: () => void;
  onDoubleTap?: () => void;
}

// Performance Types
export interface PerformanceMetrics {
  renderTime: number;
  interactionTime: number;
  layoutShiftScore: number;
  memoryUsage: number;
}

// Error Types
export interface ErrorInfo {
  message: string;
  stack?: string;
  componentStack?: string;
  errorBoundary?: boolean;
}

// State Types
export interface LoadingState {
  isLoading: boolean;
  error?: string | Error;
  data?: any;
}

export interface PaginationState {
  page: number;
  pageSize: number;
  total: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface SortState {
  field: string;
  direction: 'asc' | 'desc';
}

export interface FilterState {
  [key: string]: any;
}

// Configuration Types
export interface ComponentConfig {
  defaultProps?: Record<string, any>;
  variants?: Record<string, Record<string, any>>;
  breakpoints?: Partial<Record<Breakpoint, Record<string, any>>>;
}