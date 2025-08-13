import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import Cookies from 'js-cookie';
import { authService, AuthResponse, User } from '../services/auth.service';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string, remember?: boolean) => Promise<AuthResponse>;
  register: (data: RegisterData) => Promise<AuthResponse>;
  logout: () => void;
  refreshToken: () => Promise<boolean>;
  updateUser: (user: User) => void;
}

interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const isAuthenticated = !!user;

  // Initialize auth state from tokens
  useEffect(() => {
    const initializeAuth = async () => {
      const accessToken = Cookies.get('accessToken');
      const refreshToken = Cookies.get('refreshToken');

      if (accessToken && refreshToken) {
        try {
          // Verify token and get user info
          const userInfo = await authService.getCurrentUser();
          setUser(userInfo);
        } catch (error) {
          // Try to refresh token
          const refreshed = await refreshTokens();
          if (!refreshed) {
            // Clear invalid tokens
            clearTokens();
          }
        }
      }
      setIsLoading(false);
    };

    initializeAuth();
  }, []);

  const setTokens = (accessToken: string, refreshToken: string, remember: boolean = false) => {
    const cookieOptions = {
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict' as const,
      expires: remember ? 30 : undefined, // 30 days if remember me
    };

    Cookies.set('accessToken', accessToken, {
      ...cookieOptions,
      expires: remember ? 30 : undefined, // Session cookie if not remembered
    });

    Cookies.set('refreshToken', refreshToken, {
      ...cookieOptions,
      expires: 7, // Always 7 days for refresh token
    });
  };

  const clearTokens = () => {
    Cookies.remove('accessToken');
    Cookies.remove('refreshToken');
    setUser(null);
  };

  const refreshTokens = async (): Promise<boolean> => {
    try {
      const refreshToken = Cookies.get('refreshToken');
      if (!refreshToken) return false;

      const response = await authService.refreshToken(refreshToken);
      setTokens(response.accessToken, response.refreshToken, true);
      
      // Get updated user info
      const userInfo = await authService.getCurrentUser();
      setUser(userInfo);
      
      return true;
    } catch (error) {
      clearTokens();
      return false;
    }
  };

  const login = async (email: string, password: string, remember = false): Promise<AuthResponse> => {
    try {
      setIsLoading(true);
      const response = await authService.login({ email, password });
      
      setTokens(response.accessToken, response.refreshToken, remember);
      setUser(response.user);
      
      return response;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (data: RegisterData): Promise<AuthResponse> => {
    try {
      setIsLoading(true);
      const response = await authService.register(data);
      
      setTokens(response.accessToken, response.refreshToken, false);
      setUser(response.user);
      
      return response;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      const refreshToken = Cookies.get('refreshToken');
      if (refreshToken) {
        await authService.logout(refreshToken);
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      clearTokens();
    }
  };

  const updateUser = (updatedUser: User) => {
    setUser(updatedUser);
  };

  const value: AuthContextType = {
    user,
    isAuthenticated,
    isLoading,
    login,
    register,
    logout,
    refreshToken: refreshTokens,
    updateUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthContext;