// Central export file for all React hooks

// Existing hooks
export { useAuth } from './useAuth';
export { useProfile } from './useProfile';
export { useOnboarding } from './useOnboarding';
export { useAuditLogs } from './useAuditLogs';
export { usePreferences } from './usePreferences';
export { useDashboardData } from './useDashboardData';
export { usePortfolioAllocation } from './usePortfolioAllocation';
export { useTransactionData } from './useTransactionData';
export { useTableVirtualization } from './useTableVirtualization';
export { usePriceAlerts } from './usePriceAlerts';
export { useNotifications } from './useNotifications';

// Asset hooks
export { useAssetData } from './useAsset/useAssetData';
export { useAssetActions } from './useAsset/useAssetActions';

// Search hooks
export { useAssetSearch } from './useSearch/useAssetSearch';
export { useSearchFilters } from './useSearch/useSearchFilters';

// Settings hooks
export { useTheme } from './useSettings/useTheme';
export { useSettings } from './useSettings/useSettings';

// CP-034: Responsive Design Hooks
export { useResponsive } from './useResponsive';
export { useTouch } from './useTouch';
export { useSwipe } from './useSwipe';

// Hook types
export type {
  // Responsive types
  UseResponsiveReturn,
  ResponsiveState,
  UseTouchReturn,
  UseSwipeReturn,
  TouchHookOptions,
  SwipeHookOptions,
  ResponsiveHookOptions,
  TapEvent,
  PinchEvent,
  GestureEvent,
  SwipeEvent,
  SwipeDirection,
  TouchPoint,
  Breakpoint,
  ScreenSize,
  DeviceInfo
} from '../types/responsive.types';

export type {
  // Settings types
  UseThemeReturn,
  UseSettingsReturn,
  ThemeDefinition,
  UserSettings,
  GeneralSettings,
  DisplaySettings,
  NotificationSettings,
  SecuritySettings,
  DataSettings
} from '../types/settings.types';

// Re-export constants
export {
  DEFAULT_BREAKPOINTS,
  TOUCH_EVENTS,
  DEVICE_THRESHOLDS
} from '../types/responsive.types';