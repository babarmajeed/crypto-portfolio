import axios, { AxiosResponse } from 'axios';
import Cookies from 'js-cookie';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

// Create axios instance
const authApi = axios.create({
  baseURL: `${API_BASE_URL}/api/auth`,
  withCredentials: true,
});

// Add token to requests
authApi.interceptors.request.use((config) => {
  const token = Cookies.get('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle token refresh on 401
authApi.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = Cookies.get('refreshToken');
        if (refreshToken) {
          const response = await authApi.post('/refresh', { refreshToken });
          const { accessToken } = response.data;
          
          Cookies.set('accessToken', accessToken);
          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          
          return authApi(originalRequest);
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

export interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role: 'ADMIN' | 'PREMIUM' | 'BASIC';
  emailVerified: boolean;
  twoFactorEnabled: boolean;
  createdAt: string;
  lastLogin?: string;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
  requiresTwoFactor?: boolean;
  tempToken?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

export interface TwoFactorRequest {
  tempToken: string;
  token: string;
}

export interface PasswordResetRequest {
  email: string;
}

export interface PasswordResetConfirmRequest {
  token: string;
  password: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface TwoFactorSetupResponse {
  secret: string;
  qrCodeUrl: string;
  backupCodes: string[];
}

class AuthService {
  // Authentication
  async login(data: LoginRequest): Promise<AuthResponse> {
    const response: AxiosResponse<AuthResponse> = await authApi.post('/login', data);
    return response.data;
  }

  async register(data: RegisterRequest): Promise<AuthResponse> {
    const response: AxiosResponse<AuthResponse> = await authApi.post('/register', data);
    return response.data;
  }

  async verifyTwoFactor(data: TwoFactorRequest): Promise<AuthResponse> {
    const response: AxiosResponse<AuthResponse> = await authApi.post('/verify-2fa', data);
    return response.data;
  }

  async logout(refreshToken: string): Promise<void> {
    await authApi.post('/logout', { refreshToken });
  }

  async refreshToken(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    const response = await authApi.post('/refresh', { refreshToken });
    return response.data;
  }

  // User management
  async getCurrentUser(): Promise<User> {
    const response: AxiosResponse<User> = await authApi.get('/me');
    return response.data;
  }

  async updateProfile(data: Partial<User>): Promise<User> {
    const response: AxiosResponse<User> = await authApi.patch('/profile', data);
    return response.data;
  }

  async changePassword(data: ChangePasswordRequest): Promise<void> {
    await authApi.post('/change-password', data);
  }

  // Email verification
  async sendVerificationEmail(): Promise<void> {
    await authApi.post('/send-verification');
  }

  async verifyEmail(token: string): Promise<void> {
    await authApi.post('/verify-email', { token });
  }

  // Password reset
  async requestPasswordReset(data: PasswordResetRequest): Promise<void> {
    await authApi.post('/forgot-password', data);
  }

  async resetPassword(data: PasswordResetConfirmRequest): Promise<void> {
    await authApi.post('/reset-password', data);
  }

  // Two-factor authentication
  async setupTwoFactor(): Promise<TwoFactorSetupResponse> {
    const response: AxiosResponse<TwoFactorSetupResponse> = await authApi.post('/2fa/setup');
    return response.data;
  }

  async enableTwoFactor(token: string): Promise<{ backupCodes: string[] }> {
    const response = await authApi.post('/2fa/enable', { token });
    return response.data;
  }

  async disableTwoFactor(password: string): Promise<void> {
    await authApi.post('/2fa/disable', { password });
  }

  async generateBackupCodes(): Promise<{ backupCodes: string[] }> {
    const response = await authApi.post('/2fa/backup-codes');
    return response.data;
  }

  // OAuth2
  getGoogleAuthUrl(): string {
    return `${API_BASE_URL}/api/auth/google`;
  }

  getGitHubAuthUrl(): string {
    return `${API_BASE_URL}/api/auth/github`;
  }

  // Session management
  async getSessions(): Promise<any[]> {
    const response = await authApi.get('/sessions');
    return response.data;
  }

  async revokeSession(sessionId: string): Promise<void> {
    await authApi.delete(`/sessions/${sessionId}`);
  }

  async revokeAllSessions(): Promise<void> {
    await authApi.delete('/sessions');
  }
}

export const authService = new AuthService();
export default authService;