import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';

export interface AuthUser {
  userId: number;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  accountStatus: string;
  avatarUrl?: string;
  bio?: string;
}

export interface RegisterPayload {
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  password: string;
  gender?: 'male' | 'female' | 'other' | 'prefer_not_to_say';
}

interface AuthContextType {
  currentUser: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (identifier: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (payload: RegisterPayload) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  checkSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check active session on initial load via /api/auth/me
  const checkSession = useCallback(async () => {
    try {
      const response = await api.get('/auth/me');
      if (response.data?.authenticated && response.data?.user) {
        setCurrentUser(response.data.user);
      } else {
        setCurrentUser(null);
      }
    } catch {
      setCurrentUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  const login = async (identifier: string, password: string) => {
    try {
      const response = await api.post('/auth/login', { identifier, password });
      if (response.data?.status === 'success' && response.data?.user) {
        setCurrentUser(response.data.user);
        return { success: true };
      }
      return { success: false, error: 'Unexpected response from server' };
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } }; message?: string };
      const errorMessage =
        error.response?.data?.error || error.message || 'Login failed. Please check your network.';
      return { success: false, error: errorMessage };
    }
  };

  const register = async (payload: RegisterPayload) => {
    try {
      const response = await api.post('/auth/register', payload);
      if (response.data?.status === 'success' && response.data?.user) {
        setCurrentUser(response.data.user);
        return { success: true };
      }
      return { success: false, error: 'Registration failed' };
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } }; message?: string };
      const errorMessage =
        error.response?.data?.error || error.message || 'Registration failed. Please try again.';
      return { success: false, error: errorMessage };
    }
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (err) {
      console.warn('[Logout]: Failed to notify server of logout', err);
    } finally {
      setCurrentUser(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        isAuthenticated: !!currentUser,
        isLoading,
        login,
        register,
        logout,
        checkSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
