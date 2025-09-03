import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, AuthContextType, Outlet } from '../types';
import { authAPI, outletsAPI } from '../services/supabaseService';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentOutlet, setCurrentOutlet] = useState<Outlet | null>(null);
  const [isOutletUser, setIsOutletUser] = useState(false);

  useEffect(() => {
    // Check for existing session on app load
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      try {
        const parsedUser = JSON.parse(savedUser);
        setUser(parsedUser);
        
        // Also load outlet data from localStorage if it exists
        const savedOutlet = localStorage.getItem('currentOutlet');
        const savedIsOutletUser = localStorage.getItem('isOutletUser');
        
        if (savedOutlet && savedIsOutletUser === 'true') {
          try {
            const parsedOutlet = JSON.parse(savedOutlet);
            setCurrentOutlet(parsedOutlet);
            setIsOutletUser(true);
          } catch (error) {
            console.error('Error parsing saved outlet:', error);
            localStorage.removeItem('currentOutlet');
            localStorage.removeItem('isOutletUser');
          }
        } else {
          // If no saved outlet data, load it fresh from the database
          loadUserTypeData(parsedUser);
        }
      } catch (error) {
        console.error('Error parsing saved user:', error);
        localStorage.removeItem('user');
      }
    }
    setIsLoading(false);
  }, []);

  // Function to detect user type based on role in public.users table
  const loadUserTypeData = async (user: User) => {
    try {
      // Check if user is an outlet based on their role and associated outlet
      if (user.role === 'outlet') {
        // Find the outlet associated with this user
        const outlets = await outletsAPI.getAll();
        const outlet = outlets.find(o => o.userId === user.id);
        
        if (outlet) {
          setCurrentOutlet(outlet);
          setIsOutletUser(true);
          localStorage.setItem('currentOutlet', JSON.stringify(outlet));
          localStorage.setItem('isOutletUser', 'true');
        }
      } else {
        // Not an outlet user
        setCurrentOutlet(null);
        setIsOutletUser(false);
        localStorage.removeItem('currentOutlet');
        localStorage.removeItem('isOutletUser');
      }
    } catch (error) {
      console.error('Error loading user type data:', error);
      setCurrentOutlet(null);
      setIsOutletUser(false);
    }
  };

  const login = async (email: string, password: string): Promise<void> => {
    setIsLoading(true);
    try {
      // Use Supabase authentication
      const user = await authAPI.login(email, password);
      setUser(user);
      localStorage.setItem('user', JSON.stringify(user));
      
      // Load outlet data if this is an outlet user
      await loadUserTypeData(user);
    } catch (error) {
      console.error('Login error:', error);
      throw new Error('Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async (): Promise<void> => {
    try {
      await authAPI.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setUser(null);
      setCurrentOutlet(null);
      setIsOutletUser(false);
      localStorage.removeItem('user');
      localStorage.removeItem('currentOutlet');
      localStorage.removeItem('isOutletUser');
    }
  };

  const value: AuthContextType = {
    user,
    login,
    logout,
    isLoading,
    currentOutlet,
    isOutletUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
