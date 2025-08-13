import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { userService } from '../services/user.service';
import { 
  UserPreferences, 
  UpdatePreferencesRequest
} from '../types/user';

export const usePreferences = () => {
  const queryClient = useQueryClient();

  // Get preferences
  const {
    data: preferences,
    isLoading: isLoadingPreferences,
    error: preferencesError,
  } = useQuery({
    queryKey: ['user-preferences'],
    queryFn: userService.getPreferences,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Get utility data
  const { data: currencies = [], isLoading: isLoadingCurrencies } = useQuery({
    queryKey: ['currencies'],
    queryFn: userService.getCurrencies,
    staleTime: 60 * 60 * 1000, // 1 hour
  });

  const { data: timezones = [], isLoading: isLoadingTimezones } = useQuery({
    queryKey: ['timezones'],
    queryFn: userService.getTimezones,
    staleTime: 60 * 60 * 1000, // 1 hour
  });

  const { data: languages = [], isLoading: isLoadingLanguages } = useQuery({
    queryKey: ['languages'],
    queryFn: userService.getLanguages,
    staleTime: 60 * 60 * 1000, // 1 hour
  });

  const { data: countries = [], isLoading: isLoadingCountries } = useQuery({
    queryKey: ['countries'],
    queryFn: userService.getCountries,
    staleTime: 60 * 60 * 1000, // 1 hour
  });

  // Update preferences
  const updatePreferencesMutation = useMutation({
    mutationFn: (data: UpdatePreferencesRequest) => userService.updatePreferences(data),
    onSuccess: (updatedPreferences) => {
      queryClient.setQueryData(['user-preferences'], updatedPreferences);
      toast.success('Preferences updated successfully!');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to update preferences');
    },
  });

  // Update theme
  const updateThemeMutation = useMutation({
    mutationFn: (theme: UserPreferences['theme']) => userService.updateTheme(theme),
    onSuccess: (_, theme) => {
      // Update preferences in cache
      const currentPreferences = queryClient.getQueryData<UserPreferences>(['user-preferences']);
      if (currentPreferences) {
        queryClient.setQueryData(['user-preferences'], { ...currentPreferences, theme });
      }
      
      // Apply theme to document
      const root = document.documentElement;
      if (theme === 'dark') {
        root.classList.add('dark');
      } else if (theme === 'light') {
        root.classList.remove('dark');
      } else {
        // Auto theme - check system preference
        const isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (isDarkMode) {
          root.classList.add('dark');
        } else {
          root.classList.remove('dark');
        }
      }
      
      toast.success('Theme updated successfully!');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to update theme');
    },
  });

  // Update notifications
  const updateNotificationsMutation = useMutation({
    mutationFn: (notifications: UserPreferences['notifications']) => 
      userService.updateNotificationPreferences(notifications),
    onSuccess: (_, notifications) => {
      const currentPreferences = queryClient.getQueryData<UserPreferences>(['user-preferences']);
      if (currentPreferences) {
        queryClient.setQueryData(['user-preferences'], { 
          ...currentPreferences, 
          notifications 
        });
      }
      toast.success('Notification preferences updated!');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to update notifications');
    },
  });

  // Update privacy settings
  const updatePrivacyMutation = useMutation({
    mutationFn: (privacySettings: UserPreferences['privacySettings']) => 
      userService.updatePrivacySettings(privacySettings),
    onSuccess: (_, privacySettings) => {
      const currentPreferences = queryClient.getQueryData<UserPreferences>(['user-preferences']);
      if (currentPreferences) {
        queryClient.setQueryData(['user-preferences'], { 
          ...currentPreferences, 
          privacySettings 
        });
      }
      toast.success('Privacy settings updated!');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to update privacy settings');
    },
  });

  // Update risk tolerance
  const updateRiskToleranceMutation = useMutation({
    mutationFn: (riskTolerance: UserPreferences['riskTolerance']) => 
      userService.updateRiskTolerance(riskTolerance),
    onSuccess: (_, riskTolerance) => {
      const currentPreferences = queryClient.getQueryData<UserPreferences>(['user-preferences']);
      if (currentPreferences) {
        queryClient.setQueryData(['user-preferences'], { 
          ...currentPreferences, 
          riskTolerance 
        });
      }
      toast.success('Risk tolerance updated!');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to update risk tolerance');
    },
  });

  // Reset preferences
  const resetPreferencesMutation = useMutation({
    mutationFn: userService.resetPreferences,
    onSuccess: (resetPreferences) => {
      queryClient.setQueryData(['user-preferences'], resetPreferences);
      toast.success('Preferences reset to defaults!');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to reset preferences');
    },
  });

  // Test notification
  const testNotificationMutation = useMutation({
    mutationFn: (type: keyof UserPreferences['notifications']) => 
      userService.testNotification(type),
    onSuccess: () => {
      toast.success('Test notification sent!');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to send test notification');
    },
  });

  return {
    // Data
    preferences,
    currencies,
    timezones,
    languages,
    countries,
    
    // Loading states
    isLoadingPreferences,
    isLoadingCurrencies,
    isLoadingTimezones,
    isLoadingLanguages,
    isLoadingCountries,
    isUpdating: updatePreferencesMutation.isPending,
    isUpdatingTheme: updateThemeMutation.isPending,
    isUpdatingNotifications: updateNotificationsMutation.isPending,
    isUpdatingPrivacy: updatePrivacyMutation.isPending,
    isUpdatingRiskTolerance: updateRiskToleranceMutation.isPending,
    isResetting: resetPreferencesMutation.isPending,
    isTesting: testNotificationMutation.isPending,
    
    // Error states
    preferencesError,
    updateError: updatePreferencesMutation.error,
    themeError: updateThemeMutation.error,
    notificationsError: updateNotificationsMutation.error,
    privacyError: updatePrivacyMutation.error,
    riskError: updateRiskToleranceMutation.error,
    resetError: resetPreferencesMutation.error,
    testError: testNotificationMutation.error,
    
    // Actions
    updatePreferences: updatePreferencesMutation.mutate,
    updateTheme: updateThemeMutation.mutate,
    updateNotifications: updateNotificationsMutation.mutate,
    updatePrivacySettings: updatePrivacyMutation.mutate,
    updateRiskTolerance: updateRiskToleranceMutation.mutate,
    resetPreferences: resetPreferencesMutation.mutate,
    testNotification: testNotificationMutation.mutate,
    
    // Reset functions
    resetUpdateError: updatePreferencesMutation.reset,
    resetThemeError: updateThemeMutation.reset,
    resetNotificationsError: updateNotificationsMutation.reset,
    resetPrivacyError: updatePrivacyMutation.reset,
    resetRiskError: updateRiskToleranceMutation.reset,
    resetResetError: resetPreferencesMutation.reset,
    resetTestError: testNotificationMutation.reset,
  };
};