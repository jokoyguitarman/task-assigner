import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, AuthContextType, Outlet, Organization } from '../types';
import { authAPI, outletsAPI } from '../services/supabaseService';
import { supabase } from '../lib/supabase';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentOutlet, setCurrentOutlet] = useState<Outlet | null>(null);
  const [isOutletUser, setIsOutletUser] = useState(false);
  const [organization, setOrganization] = useState<Organization | null>(null);

  useEffect(() => {
    // Check for existing session on app load
    const checkSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Error getting session:', error);
          setIsLoading(false);
          return;
        }

        if (session?.user) {
          console.log('🔐 Session found, user:', session.user.id);
          console.log('🔐 User metadata:', session.user.user_metadata);
          // Create user object directly from session to avoid database calls
          const sessionUser: User = {
            id: session.user.id,
            email: session.user.email || '',
            name: session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'User',
            role: 'admin' as const,
            organizationId: session.user.user_metadata?.organization_id || '00000000-0000-0000-0000-000000000001',
            isPrimaryAdmin: session.user.user_metadata?.is_primary_admin || false,
            createdAt: new Date(),
            updatedAt: new Date(),
            currentStreak: 0,
            longestStreak: 0
          };
          console.log('🔐 Using session user data:', sessionUser);
          setUser(sessionUser);
          
          // Load organization data (non-blocking)
          console.log('🔐 Loading organization data...');
          loadOrganizationData(sessionUser.organizationId).catch(error => {
            console.error('🔐 Error loading organization:', error);
          });
          
          // Set loading to false immediately - organization will load in background
          console.log('🔐 Setting loading to false immediately');
          setIsLoading(false);
        } else {
          console.log('🔐 No session found');
          // Fallback to localStorage for backward compatibility
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
        }
      } catch (error) {
        console.error('Error checking session:', error);
        setIsLoading(false);
      }
    };

    checkSession();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('🔐 Auth state changed:', event, session?.user?.id);
      
      if (event === 'SIGNED_IN' && session?.user) {
        console.log('🔐 SIGNED_IN event, user:', session.user.id);
        // Create user object directly from session
        const sessionUser: User = {
          id: session.user.id,
          email: session.user.email || '',
          name: session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'User',
          role: 'admin' as const,
          organizationId: session.user.user_metadata?.organization_id || '00000000-0000-0000-0000-000000000001',
          isPrimaryAdmin: session.user.user_metadata?.is_primary_admin || false,
          createdAt: new Date(),
          updatedAt: new Date(),
          currentStreak: 0,
          longestStreak: 0
        };
        setUser(sessionUser);
        
                          // Load organization data (non-blocking)
        console.log('🔐 Loading organization data on SIGNED_IN...');
        loadOrganizationData(sessionUser.organizationId).catch(error => {
          console.error('🔐 Error loading organization on SIGNED_IN:', error);
        });
        // Note: isLoading is not set here as it's handled in the main session check
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setCurrentOutlet(null);
        setIsOutletUser(false);
        setOrganization(null);
        localStorage.removeItem('user');
        localStorage.removeItem('currentOutlet');
        localStorage.removeItem('isOutletUser');
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);


  // Function to load organization data
  const loadOrganizationData = async (organizationId: string) => {
    // Set default organization immediately to avoid blocking
    const defaultOrg: Organization = {
      id: organizationId,
      name: 'Cucina Ilocana', // Use the actual organization name
      domain: undefined,
      subscriptionTier: 'professional', // Set to highest tier
      subscriptionStatus: 'active',
      maxAdmins: 5,
      maxRestaurants: 7,
      maxEmployees: 70,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    setOrganization(defaultOrg);
    console.log('🏢 Set default organization immediately');
    
    try {
      console.log('🏢 Loading organization data for ID:', organizationId);
      
      // Reduced timeout to 2 seconds for faster fallback
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Organization loading timeout')), 2000)
      );
      
      const queryPromise = supabase
        .from('organizations')
        .select('*')
        .eq('id', organizationId)
        .single();
      
      const { data, error } = await Promise.race([queryPromise, timeoutPromise]) as any;

      if (error) {
        console.error('❌ Error loading organization:', error);
        // Don't return early, set a default organization
        const defaultOrg: Organization = {
          id: organizationId,
          name: 'Default Organization',
          domain: undefined,
          subscriptionTier: 'free',
          subscriptionStatus: 'active',
          maxAdmins: 1,
          maxRestaurants: 1,
          maxEmployees: 10,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        setOrganization(defaultOrg);
        return;
      }

      if (data) {
        console.log('✅ Organization data loaded:', data);
        const org: Organization = {
          id: data.id,
          name: data.name,
          domain: data.domain,
          subscriptionTier: data.subscription_tier,
          subscriptionStatus: data.subscription_status,
          maxAdmins: data.max_admins,
          maxRestaurants: data.max_restaurants,
          maxEmployees: data.max_employees,
          createdAt: new Date(data.created_at),
          updatedAt: new Date(data.updated_at),
        };
        setOrganization(org);
      } else {
        console.log('⚠️ No organization data found, using default');
        const defaultOrg: Organization = {
          id: organizationId,
          name: 'Default Organization',
          domain: undefined,
          subscriptionTier: 'free',
          subscriptionStatus: 'active',
          maxAdmins: 1,
          maxRestaurants: 1,
          maxEmployees: 10,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        setOrganization(defaultOrg);
      }
    } catch (error) {
      console.error('❌ Error loading organization data:', error);
      // Set a default organization even on error
      const defaultOrg: Organization = {
        id: organizationId,
        name: 'Default Organization',
        domain: undefined,
        subscriptionTier: 'free',
        subscriptionStatus: 'active',
        maxAdmins: 1,
        maxRestaurants: 1,
        maxEmployees: 10,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      setOrganization(defaultOrg);
      console.log('✅ Default organization set due to error');
    }
  };

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
    organization,
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
