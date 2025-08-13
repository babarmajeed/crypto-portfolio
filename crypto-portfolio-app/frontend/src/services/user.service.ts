import axios, { AxiosResponse } from 'axios';
import Cookies from 'js-cookie';
import {
  UserProfile,
  UserPreferences,
  AuditLogEntry,
  TrustedDevice,
  SecuritySettings,
  UserSession,
  OnboardingProgress,
  UserStats,
  UpdateProfileRequest,
  UpdatePreferencesRequest,
  ChangePasswordRequest,
  DeleteAccountRequest,
  ExportDataRequest,
  AuditLogFilter,
  AvatarUploadRequest,
  AvatarUploadResponse,
  Currency,
  Timezone,
  Language,
} from '../types/user';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

// Create axios instance for user operations
const userApi = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  withCredentials: true,
});

// Add token to requests
userApi.interceptors.request.use((config) => {
  const token = Cookies.get('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle token refresh on 401
userApi.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = Cookies.get('refreshToken');
        if (refreshToken) {
          const response = await userApi.post('/auth/refresh', { refreshToken });
          const { accessToken } = response.data;
          
          Cookies.set('accessToken', accessToken);
          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          
          return userApi(originalRequest);
        }
      } catch (refreshError) {
        // Refresh failed, redirect to login
        Cookies.remove('accessToken');
        Cookies.remove('refreshToken');
        window.location.href = '/login';
      }
    }

    return Promise.reject(error);
  }
);

class UserService {
  // Profile Management
  async getProfile(): Promise<UserProfile> {
    const response: AxiosResponse<UserProfile> = await userApi.get('/users/profile');
    return response.data;
  }

  async updateProfile(data: UpdateProfileRequest): Promise<UserProfile> {
    const response: AxiosResponse<UserProfile> = await userApi.patch('/users/profile', data);
    return response.data;
  }

  async uploadAvatar(data: AvatarUploadRequest): Promise<AvatarUploadResponse> {
    const formData = new FormData();
    formData.append('avatar', data.file);
    
    if (data.cropData) {
      formData.append('cropData', JSON.stringify(data.cropData));
    }

    const response: AxiosResponse<AvatarUploadResponse> = await userApi.post('/users/avatar', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  }

  async deleteAvatar(): Promise<void> {
    await userApi.delete('/users/avatar');
  }

  // Preferences Management
  async getPreferences(): Promise<UserPreferences> {
    const response: AxiosResponse<UserPreferences> = await userApi.get('/preferences');
    return response.data;
  }

  async updatePreferences(data: UpdatePreferencesRequest): Promise<UserPreferences> {
    const response: AxiosResponse<UserPreferences> = await userApi.patch('/preferences', data);
    return response.data;
  }

  async resetPreferences(): Promise<UserPreferences> {
    const response: AxiosResponse<UserPreferences> = await userApi.post('/preferences/reset');
    return response.data;
  }

  // Account Management
  async changePassword(data: ChangePasswordRequest): Promise<void> {
    await userApi.post('/users/change-password', data);
  }

  async deleteAccount(data: DeleteAccountRequest): Promise<void> {
    await userApi.post('/users/delete-account', data);
  }

  async exportData(data: ExportDataRequest): Promise<Blob> {
    const response = await userApi.post('/users/export-data', data, {
      responseType: 'blob',
    });
    return response.data;
  }

  // Security Management
  async getSecuritySettings(): Promise<SecuritySettings> {
    const response: AxiosResponse<SecuritySettings> = await userApi.get('/security/settings');
    return response.data;
  }

  async updateSecuritySettings(data: Partial<SecuritySettings>): Promise<SecuritySettings> {
    const response: AxiosResponse<SecuritySettings> = await userApi.patch('/security/settings', data);
    return response.data;
  }

  async getTrustedDevices(): Promise<TrustedDevice[]> {
    const response: AxiosResponse<TrustedDevice[]> = await userApi.get('/security/trusted-devices');
    return response.data;
  }

  async trustDevice(deviceId: string): Promise<void> {
    await userApi.post(`/security/trusted-devices/${deviceId}/trust`);
  }

  async untrustDevice(deviceId: string): Promise<void> {
    await userApi.delete(`/security/trusted-devices/${deviceId}`);
  }

  async getAuditLogs(filter?: AuditLogFilter): Promise<{
    logs: AuditLogEntry[];
    total: number;
    hasMore: boolean;
  }> {
    const params = new URLSearchParams();
    if (filter) {
      if (filter.startDate) params.append('startDate', filter.startDate.toISOString());
      if (filter.endDate) params.append('endDate', filter.endDate.toISOString());
      if (filter.actions) filter.actions.forEach(action => params.append('actions', action));
      if (filter.resources) filter.resources.forEach(resource => params.append('resources', resource));
      if (filter.success !== undefined) params.append('success', filter.success.toString());
      if (filter.limit) params.append('limit', filter.limit.toString());
      if (filter.offset) params.append('offset', filter.offset.toString());
    }

    const response = await userApi.get(`/security/audit-logs?${params.toString()}`);
    return response.data;
  }

  // Session Management
  async getSessions(): Promise<UserSession[]> {
    const response: AxiosResponse<UserSession[]> = await userApi.get('/security/sessions');
    return response.data;
  }

  async revokeSession(sessionId: string): Promise<void> {
    await userApi.delete(`/security/sessions/${sessionId}`);
  }

  async revokeAllSessions(): Promise<void> {
    await userApi.delete('/security/sessions');
  }

  // Onboarding Management
  async getOnboardingProgress(): Promise<OnboardingProgress> {
    const response: AxiosResponse<OnboardingProgress> = await userApi.get('/users/onboarding');
    return response.data;
  }

  async updateOnboardingProgress(data: Partial<OnboardingProgress>): Promise<OnboardingProgress> {
    const response: AxiosResponse<OnboardingProgress> = await userApi.patch('/users/onboarding', data);
    return response.data;
  }

  async completeOnboarding(): Promise<void> {
    await userApi.post('/users/onboarding/complete');
  }

  // User Statistics
  async getUserStats(): Promise<UserStats> {
    const response: AxiosResponse<UserStats> = await userApi.get('/users/stats');
    return response.data;
  }

  // Utility APIs
  async getCurrencies(): Promise<Currency[]> {
    const response: AxiosResponse<Currency[]> = await userApi.get('/utils/currencies');
    return response.data;
  }

  async getTimezones(): Promise<Timezone[]> {
    const response: AxiosResponse<Timezone[]> = await userApi.get('/utils/timezones');
    return response.data;
  }

  async getLanguages(): Promise<Language[]> {
    const response: AxiosResponse<Language[]> = await userApi.get('/utils/languages');
    return response.data;
  }

  async getCountries(): Promise<{ code: string; name: string; flag?: string }[]> {
    const response = await userApi.get('/utils/countries');
    return response.data;
  }

  // Notification preferences
  async updateNotificationPreferences(notifications: UserPreferences['notifications']): Promise<void> {
    await userApi.patch('/preferences/notifications', { notifications });
  }

  async testNotification(type: keyof UserPreferences['notifications']): Promise<void> {
    await userApi.post('/preferences/notifications/test', { type });
  }

  // Privacy settings
  async updatePrivacySettings(privacySettings: UserPreferences['privacySettings']): Promise<void> {
    await userApi.patch('/preferences/privacy', { privacySettings });
  }

  async downloadGDPRData(): Promise<Blob> {
    const response = await userApi.get('/users/gdpr-export', {
      responseType: 'blob',
    });
    return response.data;
  }

  // Theme and appearance
  async updateTheme(theme: UserPreferences['theme']): Promise<void> {
    await userApi.patch('/preferences/theme', { theme });
  }

  async getDashboardLayout(): Promise<UserPreferences['dashboardLayout']> {
    const response = await userApi.get('/preferences/dashboard-layout');
    return response.data;
  }

  async updateDashboardLayout(layout: UserPreferences['dashboardLayout']): Promise<void> {
    await userApi.patch('/preferences/dashboard-layout', { layout });
  }

  // Risk assessment
  async updateRiskTolerance(riskTolerance: UserPreferences['riskTolerance']): Promise<void> {
    await userApi.patch('/preferences/risk-tolerance', { riskTolerance });
  }

  async getRiskAssessment(): Promise<{
    score: number;
    level: UserPreferences['riskTolerance'];
    recommendations: string[];
  }> {
    const response = await userApi.get('/users/risk-assessment');
    return response.data;
  }
}

export const userService = new UserService();
export default userService;